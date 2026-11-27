// Session replay (time machine): a time-ordered list of what happened in a session, parsed on demand from its
// transcripts (main + subagents), with an in-memory LRU. Archived transcripts contribute what their stored
// summaries allow: agents with their lifetimes and hourly tokens. The model of the replay is shared/replay.ts.
import type { ReplayEvent, SessionReplay } from '../shared/api.ts';
import { capReplayEvents, normalizeReplayEvents, REPLAY_MAX_EVENTS } from '../shared/replay';
import { readLines, parseLine, type LineSink } from './lines';
import type { Store } from './store';
import { buildTree, WAIT_MS } from './tree';
import type { FileSummary } from './types';
import { contextLimitFor, parseTs, projectOf, sumT4, toolLabel, trimText, type T4 } from './util';
import { reasonText, type Lang, type Reason } from './i18n';
import { sessionTitle } from './titles';

const TOOL_USE_ID = Buffer.from('"tool_use_id":"');
/** Transcripts read at the same time. */
const READ_PARALLEL = 4;
/** How far into a line its kind is decided (record keys come first; message content later). */
const HEAD = 640;
const TIMESTAMP = Buffer.from('"timestamp":"');
const PERMISSION = Buffer.from('"permissionDecision":');
const SIDECHAIN = Buffer.from('"isSidechain":true');
/** Tools that wait for the user by design. */
const ASKS_USER = new Set(['AskUserQuestion', 'ExitPlanMode']);

/** A raw status change; sorted and deduplicated after every file is read. */
interface StatusMark { ts: number; status: 'working' | 'waiting' | 'idle'; reason: Reason | null }
interface Wait { from: number; to: number; reason: Reason; heuristic: boolean }

/** A tool call waiting for its result (to find waits). */
interface Call { ts: number; name: string; label: string; nextTs: number | null }

function stringAt(buf: Buffer, at: number): string | null {
  const end = buf.indexOf(0x22, at);
  return end > at ? buf.toString('latin1', at, end) : null;
}

/**
 * Reads one transcript into replay events. Tool results are never JSON-parsed (they are most of the bytes):
 * only their tool_use_id, timestamp and permission decision are picked out of the raw line.
 */
export class ReplaySink implements LineSink {
  events: ReplayEvent[] = [];
  marks: StatusMark[] = [];
  waits: Wait[] = [];
  private recent: string[] = [];
  private calls = new Map<string, Call>();
  private lastTs = 0;
  private mode: string | null;
  constructor(private agentId: string, private isMain: boolean, permissionMode: string | null) {
    this.mode = permissionMode;
  }

  skipped() { /* large service lines are not needed */ }

  /** The first record written after a tool call (strictly later): when the session moved on. */
  private touch(ts: number) {
    for (const c of this.calls.values()) if (c.nextTs === null && ts > c.ts) c.nextTs = ts;
  }

  /**
   * A tool result. Its bytes are scanned as little as possible (results are most of a transcript): the id from
   * the head of the line, the timestamp (one scan up to it), the permission decision from the tail.
   * `ids`/`parsedTs` when the line was parsed anyway.
   */
  private result(buf: Buffer, parsedIds?: string[], parsedTs?: number | null) {
    if (this.isMain && buf.subarray(0, HEAD).indexOf(SIDECHAIN) >= 0) return;
    let ts = parsedTs ?? null;
    if (ts == null) {
      const at = buf.indexOf(TIMESTAMP);
      ts = at >= 0 ? parseTs(stringAt(buf, at + TIMESTAMP.length)) : null;
    }
    ts ??= this.lastTs;
    // Who decided about the permission: the config (no wait) or the user (the session waited for them).
    // The decision is one of the last keys of the record.
    const tailFrom = Math.max(0, buf.length - 4096);
    const p = buf.subarray(tailFrom).lastIndexOf(PERMISSION);
    let src: string | null = null;
    if (p >= 0) {
      const m = /"source":"([^"]+)"/.exec(buf.toString('latin1', tailFrom + p, Math.min(buf.length, tailFrom + p + 400)));
      src = m ? m[1] : 'config';
    }
    let ids = parsedIds;
    if (!ids) {
      // Claude Code writes one result per record; its id is at the start of the message.
      const h = buf.subarray(0, HEAD * 2);
      const i = h.indexOf(TOOL_USE_ID);
      const id = i >= 0 ? stringAt(buf, i + TOOL_USE_ID.length) : null;
      ids = id ? [id] : [];
    }
    for (const id of ids) {
      const c = this.calls.get(id);
      if (!c) continue;
      this.calls.delete(id);
      this.settle(c, ts, src);
    }
    if (ts) { this.touch(ts); this.lastTs = Math.max(this.lastTs, ts); }
  }

  /** A finished call: did the session wait for the user meanwhile? */
  private settle(c: Call, end: number, src: string | null) {
    if (end <= c.ts) return;
    if (ASKS_USER.has(c.name)) { this.waits.push({ from: c.ts, to: end, reason: { k: 'waitingInput' }, heuristic: false }); return; }
    if (src !== null) {
      if (/^user/.test(src)) this.waits.push({ from: c.ts, to: end, reason: { k: 'waitingPermission', a: c.name }, heuristic: false });
      return;
    }
    // Older transcripts: no decision recorded. The live heuristic: nothing written for > 10 s after the call.
    if (!this.isMain || this.mode === 'bypassPermissions') return;
    const next = c.nextTs ?? end;
    if (next - c.ts > WAIT_MS) this.waits.push({ from: c.ts + WAIT_MS, to: next, reason: { k: 'probablyPermission', a: c.name }, heuristic: true });
  }

  /** Calls still open at the end of a live session's transcript. */
  finish(alive: boolean, now: number) {
    if (!alive) { this.calls.clear(); return; }
    for (const c of this.calls.values()) {
      if (ASKS_USER.has(c.name)) this.waits.push({ from: c.ts, to: now, reason: { k: 'waitingInput' }, heuristic: false });
      else if (this.isMain && this.mode !== 'bypassPermissions' && (c.nextTs === null) && now - c.ts > WAIT_MS) {
        this.waits.push({ from: c.ts + WAIT_MS, to: now, reason: { k: 'probablyPermission', a: c.name }, heuristic: true });
      }
    }
    this.calls.clear();
  }

  line(buf: Buffer) {
    // Decide from the head of the line, without parsing: most bytes are tool results and attachments.
    const head = buf.toString('latin1', 0, Math.min(buf.length, HEAD));
    const lead = /^\{"type":"([\w-]+)"/.exec(head)?.[1];
    // Service records (titles, modes, queue operations, …): only the permission mode matters.
    if (lead && lead !== 'permission-mode' && lead !== 'user' && lead !== 'assistant' && lead !== 'system') return;
    if (head.includes('"attachment":{')) return;
    else if (head.includes('"type":"user"') && head.includes('"tool_use_id"')) return this.result(buf);
    // System records: only compactions; a subagent's own prompts are its task (already on the spawn).
    else if (head.includes('"type":"system"') && !head.includes('"compact_boundary"')) return;
    else if (!this.isMain && head.includes('"type":"user"')) return;
    const d = parseLine(buf);
    if (!d) return;
    if (d.type === 'user' && Array.isArray(d.message?.content) && d.message.content.some((x: any) => x?.type === 'tool_result')) {
      const ids = d.message.content.filter((x: any) => x?.type === 'tool_result' && x.tool_use_id).map((x: any) => String(x.tool_use_id));
      if (this.isMain && d.isSidechain === true) return;
      return this.result(buf, ids, parseTs(d.timestamp));
    }
    if (d.type === 'permission-mode' && d.permissionMode) { this.mode = String(d.permissionMode); return; }
    if (typeof d.permissionMode === 'string') this.mode = d.permissionMode;
    const ts = parseTs(d.timestamp) ?? this.lastTs;
    if (!ts) return;
    this.lastTs = Math.max(this.lastTs, ts);
    const side = this.isMain && d.isSidechain === true;
    if (side) return;
    this.touch(ts);
    const me = this.agentId;
    if (d.type === 'assistant' && d.message) {
      const msg = d.message;
      if (msg.model === '<synthetic>') return;
      const key = d.requestId || msg.id;
      if (key && msg.usage && !this.recent.includes(key)) {
        this.recent.push(key);
        if (this.recent.length > 64) this.recent.shift();
        const u = msg.usage;
        const t: T4 = [u.input_tokens || 0, u.output_tokens || 0, u.cache_read_input_tokens || 0, u.cache_creation_input_tokens || 0];
        this.events.push(this.isMain ? { kind: 'tokens', ts, agentId: me, t, context: t[0] + t[2] + t[3] } : { kind: 'tokens', ts, agentId: me, t });
      }
      for (const b of Array.isArray(msg.content) ? msg.content : []) {
        if (b?.type === 'tool_use') {
          const name = String(b.name ?? '');
          if (b.id) this.calls.set(String(b.id), { ts, name, label: toolLabel(name, b.input), nextTs: null });
          // Agent calls become spawns (from the subagents' own files).
          if (name !== 'Agent' && name !== 'Task') this.events.push({ kind: 'tool', ts, agentId: me, label: toolLabel(name, b.input) });
        } else if (b?.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
          this.events.push({ kind: 'text', ts, agentId: me, text: trimText(b.text, 160) });
        }
      }
      if (this.isMain) {
        if (msg.stop_reason === 'end_turn') this.marks.push({ ts, status: 'idle', reason: { k: 'answerReady' } });
        else this.marks.push({ ts, status: 'working', reason: { k: 'working' } });
      }
    } else if (d.type === 'user' && d.message && !d.isMeta && this.isMain) {
      const c = d.message.content;
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((x: any) => x?.type === 'text').map((x: any) => x.text).join(' ') : '';
      if (text && !d.sourceToolUseID) {
        this.events.push({ kind: 'prompt', ts, text: trimText(text, 160) });
        this.marks.push({ ts, status: 'working', reason: { k: 'gotPrompt' } });
      }
    } else if (d.type === 'system' && d.subtype === 'compact_boundary') {
      const pre = d.compactMetadata?.preTokens;
      this.events.push({ kind: 'compact', ts, auto: d.compactMetadata?.trigger === 'auto', preTokens: typeof pre === 'number' ? pre : null });
    }
  }
}

/** Hourly tokens of an archived transcript (its stored summary keeps per-hour buckets). */
function hourlyTokens(f: FileSummary, agentId: string): ReplayEvent[] {
  const out: ReplayEvent[] = [];
  for (const [date, b] of Object.entries(f.days)) {
    const [y, m, d] = date.split('-').map(Number);
    for (const [h, t] of Object.entries(b.hours)) {
      const ts = Math.min(f.lastTs, Math.max(f.firstTs, new Date(y, m - 1, d, Number(h), 30).getTime()));
      out.push({ kind: 'tokens', ts, agentId, t: [...t] as T4 });
    }
  }
  return out;
}

export interface ReplayMeta { sessionId: string; project: string; cwd: string; title: string | null; model: string | null; effort: string | null }

/**
 * Builds a session's replay from its file summaries: transcripts on disk are read, archived ones (isMissing)
 * contribute their summaries. Waits come from permission decisions recorded by Claude Code (the user decided),
 * questions to the user (AskUserQuestion, ExitPlanMode) and, for older transcripts, the live heuristic
 * (nothing written for > 10 s after a tool call, unless another agent was busy meanwhile).
 */
export async function buildReplay(
  files: FileSummary[], meta: ReplayMeta,
  opts: { alive: boolean; lang: Lang; now?: number; isMissing?: (path: string) => boolean; max?: number },
): Promise<SessionReplay> {
  const now = opts.now ?? Date.now();
  const missing = opts.isMissing ?? (() => false);
  const main = files.find((f) => f.agentId === null) ?? null;
  const subs = files.filter((f) => f.agentId !== null).sort((a, b) => (a.firstTs - b.firstTs) || a.path.localeCompare(b.path));
  const tree = buildTree(main, subs, now, opts.alive, true);
  const parentOf = new Map<string, string>();
  const walk = (n: { id: string; children: { id: string; children: any[] }[] }) => { for (const c of n.children) { parentOf.set(c.id, n.id); walk(c); } };
  walk(tree.root);
  const spawnTs = new Map<string, number>();
  for (const f of files) for (const [id, sp] of Object.entries(f.spawns)) spawnTs.set(id, sp.ts);
  const finished = new Map(tree.finished.map((x) => [x.s.agentId!, x.s]));

  let events: ReplayEvent[] = [];
  const marks: StatusMark[] = [];
  const waits: Wait[] = [];
  const archived = files.length > 0 && files.every((f) => missing(f.path));

  const ordered = [...(main ? [main] : []), ...subs];
  // Transcripts are read a few at a time (I/O overlaps parsing); results are merged in file order.
  const sinks = new Array<ReplaySink | null>(ordered.length).fill(null);
  let nextFile = 0;
  const worker = async () => {
    for (let i = nextFile++; i < ordered.length; i = nextFile++) {
      const f = ordered[i];
      if (missing(f.path)) continue;
      const sink = new ReplaySink(f.agentId ?? 'main', f.agentId === null, f.permissionMode);
      try { await readLines(f.path, 0, sink); } catch { continue; }
      sink.finish(opts.alive, now);
      sinks[i] = sink;
    }
  };
  await Promise.all(Array.from({ length: Math.min(READ_PARALLEL, ordered.length) }, worker));
  ordered.forEach((f, i) => {
    const id = f.agentId ?? 'main';
    if (f.agentId) {
      const sp = f.meta?.toolUseId ? spawnTs.get(f.meta.toolUseId) : undefined;
      const known = [sp, f.firstTs].filter((x): x is number => !!x && x > 0);
      const node = findNode(tree.root, f.agentId);
      events.push({
        kind: 'spawn', ts: known.length ? Math.min(...known) : f.lastTs, agentId: f.agentId, parentId: parentOf.get(f.agentId) ?? 'main',
        agentType: node?.type ?? f.meta?.agentType ?? 'general-purpose', description: node?.description ?? f.meta?.description ?? null,
        model: f.model, effort: f.effort,
      });
      const done = finished.get(f.agentId);
      if (done) events.push({ kind: 'finish', ts: done.lastTs, agentId: f.agentId, tokens: sumT4(done.total) });
    }
    if (missing(f.path)) {
      events.push(...hourlyTokens(f, id));
      if (!f.agentId && f.firstTs) {
        marks.push({ ts: f.firstTs, status: 'working', reason: { k: 'working' } });
        if (!opts.alive) marks.push({ ts: f.lastTs, status: 'idle', reason: { k: 'sessionEnded' } });
      }
      return;
    }
    const sink = sinks[i];
    if (!sink) return;
    for (const e of sink.events) events.push(e);
    for (const m of sink.marks) marks.push(m);
    for (const w of sink.waits) waits.push(w);
  });

  events = normalizeReplayEvents(events);
  // Heuristic waits are dropped where another agent was busy: the session was working, not waiting.
  const busy = events.filter((e) => (e.kind === 'tool' || e.kind === 'tokens' || e.kind === 'text') && e.agentId !== 'main').map((e) => e.ts);
  const busyIn = (a: number, b: number) => {
    let lo = 0, hi = busy.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (busy[m] < a) lo = m + 1; else hi = m; }
    return lo < busy.length && busy[lo] <= b;
  };
  for (const w of waits) {
    if (w.heuristic && busyIn(w.from, w.to)) continue;
    marks.push({ ts: w.from, status: 'waiting', reason: w.reason });
    if (w.to < now || !opts.alive) marks.push({ ts: w.to, status: 'working', reason: { k: 'working' } });
  }
  const startedAt = Math.min(...files.map((f) => f.firstTs || Infinity), events.length ? events[0].ts : Infinity);
  const lastTs = Math.max(0, ...files.map((f) => f.lastTs), events.length ? events[events.length - 1].ts : 0);
  const endedAt = opts.alive ? Math.max(lastTs, now) : lastTs;
  if (!opts.alive && marks.length) marks.push({ ts: lastTs, status: 'idle', reason: { k: 'sessionEnded' } });
  // Status changes: in time order (stable), consecutive duplicates dropped.
  marks.sort((a, b) => a.ts - b.ts);
  let cur: string | null = null;
  for (const m of marks) {
    const key = `${m.status}|${m.reason?.k ?? ''}|${m.reason && 'a' in m.reason ? m.reason.a : ''}`;
    // An answer is "ready" only once; the rest of the turn's working records do not flip it back and forth.
    if (key === cur || (m.status === (cur?.split('|')[0] ?? '') && m.status !== 'waiting')) continue;
    cur = key;
    const r = m.reason;
    events.push({ kind: 'status', ts: m.ts, status: m.status, reason: reasonText(r, opts.lang), code: r?.k ?? null, arg: r && 'a' in r ? String(r.a) : null });
  }
  events = normalizeReplayEvents(events);
  const capped = capReplayEvents(events, opts.max ?? REPLAY_MAX_EVENTS);
  const out: SessionReplay = {
    ...meta,
    contextLimit: main ? contextLimitFor(main.model, main.requestedModel, main.carry.maxCtx) : null,
    startedAt: Number.isFinite(startedAt) ? startedAt : now,
    endedAt: Number.isFinite(startedAt) ? endedAt : now,
    live: opts.alive,
    generatedAt: now,
    events: capped.events,
  };
  if (archived) out.archived = true;
  if (capped.sampled) out.sampled = capped.sampled;
  return out;
}

function findNode(n: { id: string; type: string; description: string | null; children: any[] }, id: string): { type: string; description: string | null } | null {
  if (n.id === id) return n;
  for (const c of n.children) { const r = findNode(c, id); if (r) return r; }
  return null;
}

const lru = new Map<string, { sig: string; v: SessionReplay }>();

/** GET /api/session/:id/replay. Null when the session is unknown. */
export async function sessionReplay(store: Store, sessionId: string, alive: boolean, lang: Lang = 'en', now = Date.now()): Promise<SessionReplay | null> {
  const files = store.sessionFiles(sessionId);
  if (!files.length) return null;
  // A live session's replay ends "now": rebuilt when a transcript grows (or every 10 s while it waits).
  const sig = files.map((f) => `${f.path}:${f.size}:${store.isMissing(f.path) ? 'gone' : ''}`).sort().join('|') + `:${alive}:${lang}:${alive ? Math.floor(now / 10_000) : ''}`;
  const key = `${sessionId}:${lang}`;
  const hit = lru.get(key);
  if (hit && hit.sig === sig) { lru.delete(key); lru.set(key, hit); return hit.v; }
  const main = files.find((f) => f.agentId === null) ?? null;
  const any = main ?? files[0];
  const v = await buildReplay(files, {
    sessionId, project: projectOf(any.cwd, any.projectDir), cwd: main?.cwd ?? any.cwd ?? '', title: sessionTitle(main),
    model: main?.model ?? null, effort: main?.effort ?? null,
  }, { alive, lang, now, isMissing: (p) => store.isMissing(p) });
  lru.set(key, { sig, v });
  if (lru.size > 6) lru.delete(lru.keys().next().value!);
  return v;
}
