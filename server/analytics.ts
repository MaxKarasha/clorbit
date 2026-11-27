// Analytics over a date range: everything is computed in memory from file summaries.
import type {
  AnalyticsOverview, AttributionReport, DailyPoint, Range, SessionSummary, UsageRow,
} from '../shared/api.ts';
import type { Store } from './store';
import type { DayBucket, FileSummary, UsageAgg } from './types';
import { startupKind, startupLabel, type Lang } from './i18n';
import { addDays, addT4, dateRange, estTokens, localDate, mcpKey, mcpSplit, projectOf, sumT4, toTokens, weekdayOf, zeroT4, type T4 } from './util';
import { sessionTitle } from './titles';

export function parseRange(q: URLSearchParams): Range {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const today = localDate(Date.now());
  let to = q.get('to') ?? '';
  let from = q.get('from') ?? '';
  if (!re.test(to)) to = today;
  if (!re.test(from)) from = addDays(to, -13);
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

interface RowAcc { t: T4; turns: number; calls: number; sessions: Set<string>; last: number; group?: string; extra: Record<string, number> }

class Rows {
  m = new Map<string, RowAcc>();
  get(key: string): RowAcc {
    let r = this.m.get(key);
    if (!r) this.m.set(key, (r = { t: zeroT4(), turns: 0, calls: 0, sessions: new Set(), last: 0, extra: {} }));
    return r;
  }
  addAgg(key: string, a: UsageAgg, sid: string) {
    const r = this.get(key);
    addT4(r.t, a.t); r.turns += a.turns; r.sessions.add(sid); if (a.last > r.last) r.last = a.last;
    return r;
  }
  rows(label: (k: string) => string = (k) => k, sortBy: 'total' | 'calls' = 'total'): UsageRow[] {
    const out: UsageRow[] = [];
    for (const [k, r] of this.m) {
      const row: UsageRow = {
        key: k, label: label(k), tokens: toTokens(r.t), total: sumT4(r.t), turns: r.turns, calls: r.calls,
        sessions: r.sessions.size,
      };
      if (r.group) row.group = r.group;
      if (r.last) row.lastUsed = r.last;
      if (Object.keys(r.extra).length) row.extra = { ...r.extra };
      out.push(row);
    }
    out.sort((a, b) => (sortBy === 'total' ? b.total - a.total || b.calls - a.calls : b.calls - a.calls || b.total - a.total));
    return out;
  }
}

/** Traversal context: a session's project is taken from its main transcript. */
export class Ctx {
  projectOfSession = new Map<string, string>();
  constructor(public store: Store) {
    for (const s of store.files.values()) {
      if (s.agentId === null) this.projectOfSession.set(s.sessionId, projectOf(s.cwd, s.projectDir));
    }
    for (const s of store.files.values()) {
      if (!this.projectOfSession.has(s.sessionId)) this.projectOfSession.set(s.sessionId, projectOf(s.cwd, s.projectDir));
    }
  }
  project(s: FileSummary) { return this.projectOfSession.get(s.sessionId) ?? projectOf(s.cwd, s.projectDir); }
  *days(range: Range): Generator<{ s: FileSummary; date: string; b: DayBucket }> {
    for (const s of this.store.files.values()) {
      if (!s.lastTs || localDate(s.lastTs) < range.from || localDate(s.firstTs || s.lastTs) > range.to) continue;
      for (const [date, b] of Object.entries(s.days)) if (date >= range.from && date <= range.to) yield { s, date, b };
    }
  }
}

// Result cache keyed by the store version.
const memo = new Map<string, { version: number; v: unknown }>();
export function memoize<T>(store: Store, key: string, fn: () => T): T {
  const m = memo.get(key);
  if (m && m.version === store.version) return m.v as T;
  const v = fn();
  memo.set(key, { version: store.version, v });
  if (memo.size > 200) memo.delete(memo.keys().next().value!);
  return v;
}

export function overview(store: Store, range: Range): AnalyticsOverview {
  return memoize(store, `ov:${range.from}:${range.to}`, () => {
    const ctx = new Ctx(store);
    const daily = new Map<string, DailyPoint & { _s: Set<string> }>();
    for (const d of dateRange(range.from, range.to)) {
      daily.set(d, { date: d, tokens: toTokens(zeroT4()), byModel: {}, byProject: {}, sessions: 0, subagents: 0, toolCalls: 0, _s: new Set() });
    }
    const tot = zeroT4();
    let toolCalls = 0, compactions = 0;
    const sessions = new Set<string>();
    const subagents = new Set<string>();
    const projects = new Rows();
    const models = new Rows();
    const hourly = new Array<number>(24).fill(0);
    const heat = new Map<string, number>();
    for (const { s, date, b } of ctx.days(range)) {
      const dp = daily.get(date);
      if (!dp) continue;
      const total = sumT4(b.t);
      const proj = ctx.project(s);
      dp.tokens.input += b.t[0]; dp.tokens.output += b.t[1]; dp.tokens.cacheRead += b.t[2]; dp.tokens.cacheWrite += b.t[3];
      if (total > 0) dp.byProject[proj] = (dp.byProject[proj] ?? 0) + total;
      for (const [m, a] of Object.entries(b.models)) {
        dp.byModel[m] = (dp.byModel[m] ?? 0) + sumT4(a.t);
        models.addAgg(m, a, s.sessionId);
      }
      dp.toolCalls += b.toolCalls;
      if (b.turns > 0) dp._s.add(s.sessionId);
      addT4(tot, b.t);
      toolCalls += b.toolCalls;
      compactions += b.compactions;
      if (b.turns > 0) sessions.add(s.sessionId);
      const pr = projects.get(proj);
      addT4(pr.t, b.t); pr.turns += b.turns; pr.calls += b.toolCalls; if (b.turns) pr.sessions.add(s.sessionId);
      if (s.lastTs > pr.last) pr.last = s.lastTs;
      const wd = weekdayOf(date);
      for (const [h, t] of Object.entries(b.hours)) {
        const v = sumT4(t);
        hourly[Number(h)] += v;
        const k = `${wd}:${h}`;
        heat.set(k, (heat.get(k) ?? 0) + v);
      }
    }
    // Subagents are counted by the date they appeared.
    for (const s of store.files.values()) {
      if (!s.agentId || !s.firstTs) continue;
      const dp = daily.get(localDate(s.firstTs));
      if (dp) { dp.subagents++; subagents.add(s.path); }
    }
    for (const dp of daily.values()) { dp.sessions = dp._s.size; delete (dp as any)._s; }
    const projRows = projects.rows();
    for (const r of projRows) {
      r.extra = { ...(r.extra ?? {}), share: tot[0] + tot[1] + tot[2] + tot[3] ? r.total / sumT4(tot) : 0 };
    }
    const heatmap: AnalyticsOverview['heatmap'] = [];
    for (let wd = 0; wd < 7; wd++) for (let h = 0; h < 24; h++) heatmap.push({ weekday: wd, hour: h, total: heat.get(`${wd}:${h}`) ?? 0 });
    return {
      range,
      totals: { ...toTokens(tot), total: sumT4(tot), sessions: sessions.size, subagents: subagents.size, toolCalls, compactions, projects: projRows.filter((r) => r.total > 0).length },
      daily: [...daily.values()],
      projects: projRows,
      models: models.rows(),
      hourly,
      heatmap,
    };
  });
}

/** Files that started within the range (main file; for subagents, when they appeared). */
function startupBySession(ctx: Ctx, range: Range) {
  const out: { s: FileSummary; date: string }[] = [];
  for (const s of ctx.store.files.values()) {
    if (!s.firstTs) continue;
    const date = localDate(s.firstTs);
    if (date >= range.from && date <= range.to) out.push({ s, date });
  }
  return out;
}

/** MCP server display names by normalized key (from MCP instructions and attribution). */
export function mcpDisplayNames(store: Store): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of store.files.values()) {
    for (const k of Object.keys(s.mcpBlocks)) m.set(mcpKey(k), k);
    for (const b of Object.values(s.days)) for (const k of Object.keys(b.mcpServers)) m.set(mcpKey(k), k);
  }
  return m;
}

export function attribution(store: Store, range: Range, lang: Lang = 'en'): AttributionReport {
  return memoize(store, `attr:${lang}:${range.from}:${range.to}`, () => {
    const ctx = new Ctx(store);
    const skills = new Rows(), plugins = new Rows(), mcpServers = new Rows(), mcpTools = new Rows(), tools = new Rows();
    const subTypes = new Rows();
    let unattributed = 0;
    const mcpByKey = mcpDisplayNames(store); // normalized key → display name
    for (const { s, b } of ctx.days(range)) {
      const sid = s.sessionId;
      unattributed += b.unattributed;
      for (const [k, a] of Object.entries(b.skills)) {
        const r = skills.addAgg(k, a, sid);
        if (k.includes(':')) r.group = k.split(':')[0];
      }
      for (const [k, n] of Object.entries(b.skillLoads)) {
        const r = skills.get(k);
        r.calls += n; r.sessions.add(sid);
        r.extra.loads = (r.extra.loads ?? 0) + n;
        if (k.includes(':')) r.group = k.split(':')[0];
      }
      for (const [k, a] of Object.entries(b.plugins)) plugins.addAgg(k, a, sid);
      for (const [k, a] of Object.entries(b.mcpServers)) mcpServers.addAgg(k, a, sid);
      for (const [k, a] of Object.entries(b.mcpTools)) {
        const [server, tool] = k.split('\u0001');
        const r = mcpTools.addAgg(`${server} · ${tool}`, a, sid);
        r.group = server;
      }
      for (const [name, t] of Object.entries(b.tools)) {
        const r = tools.get(name);
        r.calls += t.calls; r.sessions.add(sid); if (t.last > r.last) r.last = t.last;
        r.extra.resultTokens = (r.extra.resultTokens ?? 0) + t.res;
        r.extra.resultCount = (r.extra.resultCount ?? 0) + t.resN;
        r.extra.maxResult = Math.max(r.extra.maxResult ?? 0, t.max);
        r.t[0] += t.res;
        const m = mcpSplit(name);
        if (m) {
          r.group = m.server;
          const key = mcpByKey.get(m.server) ?? m.server;
          const sr = mcpServers.get(key);
          sr.calls += t.calls; sr.sessions.add(sid);
          sr.extra.resultTokens = (sr.extra.resultTokens ?? 0) + t.res;
          const tr = mcpTools.get(`${key} · ${m.tool}`);
          tr.calls += t.calls; tr.group = key; tr.sessions.add(sid);
          tr.extra.resultTokens = (tr.extra.resultTokens ?? 0) + t.res;
        }
      }
    }
    // Merge MCP rows whose tool-name key later matched a display name.
    for (const [k, r] of [...mcpServers.m]) {
      const disp = mcpByKey.get(k);
      if (disp && disp !== k) {
        const into = mcpServers.get(disp);
        addT4(into.t, r.t); into.turns += r.turns; into.calls += r.calls;
        r.sessions.forEach((x) => into.sessions.add(x));
        into.extra.resultTokens = (into.extra.resultTokens ?? 0) + (r.extra.resultTokens ?? 0);
        mcpServers.m.delete(k);
      }
    }
    for (const r of tools.m.values()) {
      const n = r.extra.resultCount || 0;
      r.extra.avgResult = n ? Math.round((r.extra.resultTokens ?? 0) / n) : 0;
    }
    // Plugins: add the plugin's skill calls.
    for (const [k, r] of skills.m) {
      if (!r.group) continue;
      const pr = plugins.get(r.group);
      pr.calls += r.extra.loads ?? 0;
      r.sessions.forEach((x) => pr.sessions.add(x));
      pr.extra.skills = (pr.extra.skills ?? 0) + 1;
      void k;
    }
    // Subagents by type (by the date they appeared).
    const sub = new Map<string, { n: number; dur: number; maxDepth: number }>();
    const startup = new Rows();
    const startupSessions = new Map<string, Set<string>>();
    for (const { s } of startupBySession(ctx, range)) {
      if (s.agentId) {
        const type = s.meta?.agentType ?? 'general-purpose';
        const r = subTypes.get(type);
        addT4(r.t, s.total); r.turns += s.turns; r.calls++; r.sessions.add(s.sessionId);
        if (s.lastTs > r.last) r.last = s.lastTs;
        const a = sub.get(type) ?? { n: 0, dur: 0, maxDepth: 0 };
        a.n++; a.dur += Math.max(0, s.lastTs - s.firstTs); a.maxDepth = Math.max(a.maxDepth, s.meta?.spawnDepth ?? 1);
        sub.set(type, a);
      }
      for (const [label, chars] of Object.entries(s.startup)) {
        const r = startup.get(label);
        const tok = estTokens(chars);
        if (s.agentId) { r.extra.subagentTokens = (r.extra.subagentTokens ?? 0) + tok; r.extra.subagentRuns = (r.extra.subagentRuns ?? 0) + 1; }
        else {
          r.t[0] += tok; r.calls++; r.sessions.add(s.sessionId);
          const set = startupSessions.get(label) ?? new Set(); set.add(s.sessionId); startupSessions.set(label, set);
        }
        if (s.firstTs > r.last) r.last = s.firstTs;
      }
    }
    for (const [type, a] of sub) {
      const r = subTypes.get(type);
      r.extra.avgTokens = Math.round(sumT4(r.t) / a.n);
      r.extra.avgDurationMs = Math.round(a.dur / a.n);
      r.extra.maxDepth = a.maxDepth;
    }
    for (const r of startup.m.values()) {
      r.extra.perSession = r.calls ? Math.round(r.t[0] / r.calls) : 0;
      if (r.extra.subagentRuns) r.extra.perSubagent = Math.round((r.extra.subagentTokens ?? 0) / r.extra.subagentRuns);
      // Total cost, subagents included.
      r.t[0] += r.extra.subagentTokens ?? 0;
    }
    return {
      range,
      skills: skills.rows(),
      plugins: plugins.rows(),
      mcpServers: mcpServers.rows(),
      mcpTools: mcpTools.rows(),
      tools: tools.rows((k) => k, 'calls'),
      subagentTypes: subTypes.rows(),
      startupContext: startup.rows((k) => startupLabel(k, lang)).map((r) => {
        r.extra = { ...r.extra, kind: startupKind(r.key) };
        if (r.key.startsWith('hook:plugin:')) r.group = r.key.slice('hook:plugin:'.length);
        return r;
      }),
      unattributedTotal: unattributed,
    };
  });
}

/** Summary of one session from all its files. */
export function summarizeSession(store: Store, sessionId: string, ctx?: Ctx): SessionSummary | null {
  const files = store.sessionFiles(sessionId);
  if (!files.length) return null;
  const main = files.find((f) => f.agentId === null) ?? null;
  const t = zeroT4();
  let toolCalls = 0, start = Infinity, end = 0;
  for (const f of files) {
    addT4(t, f.total); toolCalls += f.toolCalls;
    if (f.firstTs && f.firstTs < start) start = f.firstTs;
    if (f.lastTs > end) end = f.lastTs;
  }
  if (!Number.isFinite(start)) start = end;
  const any = main ?? files[0];
  return {
    sessionId,
    project: ctx ? ctx.project(any) : projectOf(any.cwd, any.projectDir),
    cwd: main?.cwd ?? any.cwd ?? '',
    title: sessionTitle(main),
    startedAt: start,
    endedAt: end,
    model: main?.model ?? null,
    effort: main?.effort ?? null,
    tokens: toTokens(t),
    total: sumT4(t),
    subagents: files.length - (main ? 1 : 0),
    toolCalls,
    compactions: main?.compactions ?? 0,
    durationMs: Math.max(0, end - start),
  };
}

export function sessions(store: Store, range: Range, project: string | null): SessionSummary[] {
  return memoize(store, `ss:${range.from}:${range.to}:${project ?? ''}`, () => {
    const ctx = new Ctx(store);
    const ids = new Set<string>();
    for (const { s, b } of ctx.days(range)) if (b.turns > 0) ids.add(s.sessionId);
    const out: SessionSummary[] = [];
    for (const id of ids) {
      const sum = summarizeSession(store, id, ctx);
      if (!sum) continue;
      if (project && sum.project !== project) continue;
      out.push(sum);
    }
    out.sort((a, b) => b.endedAt - a.endedAt);
    return out;
  });
}
