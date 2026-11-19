// Session detail: parses a session's files on demand (timeline, full tree, token series), with an in-memory LRU.
import type { SessionDetail, TimelineItem, UsageRow } from '../shared/api.ts';
import { readLines, parseLine, type LineSink } from './lines';
import type { Store } from './store';
import { buildTree, type PidStatus } from './tree';
import type { FileSummary } from './types';
import { estTokens, parseTs, sumT4, toolLabel, trimText, toTokens, zeroT4, addT4 } from './util';
import { summarizeSession, Ctx } from './analytics';
import { detailText, startupLabel, type Lang } from './i18n';

const MAX_TIMELINE = 2000;
const MAX_SERIES = 1500;
const TOOL_RESULT = Buffer.from('"tool_use_id"');

class DetailSink implements LineSink {
  items: TimelineItem[] = [];
  series: { ts: number; total: number; context: number }[] = [];
  private recent: string[] = [];
  private cum = 0;
  private sinceTurn = 0;
  private lastTs = 0;
  constructor(private agentId: string, private isMain: boolean, private txt: ReturnType<typeof detailText>) {}

  skipped() { /* large service lines are not needed */ }

  line(buf: Buffer) {
    // Tool results are not needed for the timeline, so they are not parsed.
    if (buf.indexOf(TOOL_RESULT) >= 0 && buf.indexOf('"type":"assistant"') < 0) return;
    const d = parseLine(buf);
    if (!d) return;
    const ts = parseTs(d.timestamp) ?? this.lastTs;
    if (ts) this.lastTs = ts;
    const side = this.isMain && d.isSidechain === true;
    if (d.type === 'assistant' && d.message) {
      const msg = d.message;
      if (msg.model === '<synthetic>') return;
      const key = d.requestId || msg.id;
      if (key && msg.usage && !this.recent.includes(key)) {
        this.recent.push(key);
        if (this.recent.length > 64) this.recent.shift();
        const u = msg.usage;
        const total = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        this.cum += total;
        this.sinceTurn += total;
        if (this.isMain && !side) {
          this.series.push({ ts, total: this.cum, context: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) });
        }
      }
      if (side) return;
      for (const b of Array.isArray(msg.content) ? msg.content : []) {
        if (b?.type === 'tool_use') {
          const name = String(b.name ?? '');
          if (name === 'Agent' || name === 'Task') {
            const inp = b.input ?? {};
            this.items.push({ ts, agentId: this.agentId, kind: 'spawn', label: `${toolLabel(name, inp)}${inp.description ? ': ' + trimText(String(inp.description), 80) : ''}` });
          } else {
            this.items.push({ ts, agentId: this.agentId, kind: 'tool', label: toolLabel(name, b.input) });
          }
        } else if (b?.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
          this.items.push({ ts, agentId: this.agentId, kind: 'text', label: trimText(b.text, 160) });
        }
      }
    } else if (d.type === 'user' && d.message && !d.isMeta && !side) {
      const c = d.message.content;
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((x: any) => x?.type === 'text').map((x: any) => x.text).join(' ') : '';
      const hasResult = Array.isArray(c) && c.some((x: any) => x?.type === 'tool_result');
      if (text && !hasResult && !d.sourceToolUseID) {
        this.items.push({ ts, agentId: this.agentId, kind: 'prompt', label: trimText(text, 160) });
      }
    } else if (d.type === 'system') {
      if (d.subtype === 'compact_boundary') {
        const auto = d.compactMetadata?.trigger === 'auto';
        this.items.push({ ts, agentId: this.agentId, kind: 'compact', label: auto ? this.txt.autoCompact : this.txt.compact, tokens: d.compactMetadata?.preTokens });
      } else if (d.subtype === 'turn_duration' && !side) {
        const sec = Math.round((d.durationMs ?? 0) / 1000);
        this.items.push({ ts, agentId: this.agentId, kind: 'turn', label: this.txt.turnDone(sec), tokens: this.sinceTurn });
        this.sinceTurn = 0;
      }
    }
  }
}

const lru = new Map<string, { sig: string; v: SessionDetail }>();
const lruKey = (id: string, lang: Lang) => `${id}:${lang}`;

export async function sessionDetail(store: Store, sessionId: string, alive: boolean, lang: Lang = 'en', pidStatus: PidStatus = null): Promise<SessionDetail | null> {
  const files = store.sessionFiles(sessionId);
  if (!files.length) return null;
  const sig = files.map((f) => `${f.path}:${f.size}:${store.isMissing(f.path) ? 'gone' : ''}`).sort().join('|') + `:${alive}:${pidStatus}:${lang}`;
  const key = lruKey(sessionId, lang);
  const hit = lru.get(key);
  if (hit && hit.sig === sig) { lru.delete(key); lru.set(key, hit); return hit.v; }
  const txt = detailText(lang);

  const main = files.find((f) => f.agentId === null) ?? null;
  const subs = files.filter((f) => f.agentId !== null);
  const now = Date.now();
  const tree = buildTree(main, subs, now, alive, true, pidStatus);
  let timeline: TimelineItem[] = [];
  let series: SessionDetail['tokensSeries'] = [];
  // Archived transcripts (deleted from disk) only have their stored summary: no timeline/series from them.
  const archived = files.every((f) => store.isMissing(f.path));
  for (const f of files) {
    if (store.isMissing(f.path)) continue;
    const sink = new DetailSink(f.agentId ?? 'main', f.agentId === null, txt);
    try { await readLines(f.path, 0, sink); } catch { continue; }
    timeline.push(...sink.items);
    if (f.agentId === null) series = sink.series;
    if (f.agentId && tree.finished.some((x) => x.s === f)) {
      timeline.push({ ts: f.lastTs, agentId: f.agentId, kind: 'finish', label: txt.finished(f.meta?.agentType ?? null), tokens: sumT4(f.total) });
    }
    if (timeline.length > MAX_TIMELINE * 4) {
      timeline.sort((a, b) => a.ts - b.ts);
      timeline = timeline.slice(-MAX_TIMELINE * 2);
    }
  }
  timeline.sort((a, b) => a.ts - b.ts);
  if (timeline.length > MAX_TIMELINE) timeline = timeline.slice(-MAX_TIMELINE);
  if (series.length > MAX_SERIES) {
    const step = series.length / MAX_SERIES;
    const out: typeof series = [];
    for (let i = 0; i < MAX_SERIES; i++) out.push(series[Math.floor(i * step)]);
    out.push(series[series.length - 1]);
    series = out;
  }
  const ctx = new Ctx(store);
  const summary = summarizeSession(store, sessionId, ctx)!;
  const context = main
    ? Object.entries(main.startup).map(([key, chars]) => ({ key, label: startupLabel(key, lang), tokens: estTokens(chars) })).sort((a, b) => b.tokens - a.tokens)
    : [];
  const v: SessionDetail = { summary, tree: tree.root, timeline, context, tools: sessionTools(files), tokensSeries: series };
  if (archived) v.archived = true;
  lru.set(key, { sig, v });
  if (lru.size > 8) lru.delete(lru.keys().next().value!);
  return v;
}

/** The session's tools across all its files. */
function sessionTools(files: FileSummary[]): UsageRow[] {
  const m = new Map<string, { calls: number; res: number; n: number; max: number; last: number; agents: Set<string> }>();
  for (const f of files) {
    for (const b of Object.values(f.days)) {
      for (const [name, t] of Object.entries(b.tools)) {
        const r = m.get(name) ?? { calls: 0, res: 0, n: 0, max: 0, last: 0, agents: new Set<string>() };
        r.calls += t.calls; r.res += t.res; r.n += t.resN; r.max = Math.max(r.max, t.max); r.last = Math.max(r.last, t.last);
        r.agents.add(f.agentId ?? 'main');
        m.set(name, r);
      }
    }
  }
  const rows: UsageRow[] = [];
  for (const [name, r] of m) {
    const t = zeroT4(); t[0] = r.res;
    rows.push({
      key: name, label: name, tokens: toTokens(addT4(zeroT4(), t)), total: r.res, turns: 0, calls: r.calls, sessions: 1,
      lastUsed: r.last || undefined,
      extra: { resultTokens: r.res, avgResult: r.n ? Math.round(r.res / r.n) : 0, maxResult: r.max, agents: r.agents.size },
    });
  }
  return rows.sort((a, b) => b.calls - a.calls);
}
