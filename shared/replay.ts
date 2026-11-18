// Time machine: the pure model behind session replays (GET /api/session/:id/replay and the galaxy's replay mode).
// Deterministic: the state at time t is a function of the event list and t only (`replayStateAt`), so a replay can
// be played, seeked and stepped, and rendered frame by frame later (video export). Used by the server (ordering,
// capping) and the web app (state, time map, markers, density).
import type { AgentNode, AgentStatus, LiveSession, ReplayEvent, ReplayEventKind, SessionReplay, SessionStatus } from './api';

/** At most this many events per replay; structural ones (spawn, finish, prompt, compact, status) are never dropped. */
export const REPLAY_MAX_EVENTS = 20_000;

type T4 = [number, number, number, number];
const STRUCTURAL = new Set<ReplayEventKind>(['spawn', 'finish', 'prompt', 'compact', 'status']);

/** Tie-break for events with the same timestamp: a birth before anything the agent does, a return after it; a status after the call or text that caused it. */
const KIND_ORDER: Record<ReplayEventKind, number> = { spawn: 0, prompt: 1, tool: 2, text: 3, status: 4, tokens: 5, compact: 6, finish: 7 };

/** Time order; equal timestamps by kind (spawn first, finish last), then by input order (stable). */
export function sortReplayEvents(events: readonly ReplayEvent[]): ReplayEvent[] {
  return events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.ts - b.e.ts || KIND_ORDER[a.e.kind] - KIND_ORDER[b.e.kind] || a.i - b.i)
    .map((x) => x.e);
}

/** The agent an event belongs to (spawn/finish: the subagent itself), or null for session-level events. */
export function agentOfEvent(e: ReplayEvent): string | null {
  switch (e.kind) {
    case 'spawn': case 'finish': case 'tool': case 'text': case 'tokens': return e.agentId;
    default: return null;
  }
}

/**
 * Makes a raw list consistent: sorted; one spawn and at most one finish per subagent (the first of each);
 * a spawn moves back to the agent's first activity and a finish forward to its last one, so an agent is
 * never seen acting before it is born or after it returned. Events of the main agent never spawn or finish it.
 */
export function normalizeReplayEvents(events: readonly ReplayEvent[]): ReplayEvent[] {
  const sorted = sortReplayEvents(events);
  const first = new Map<string, number>();
  const last = new Map<string, number>();
  for (const e of sorted) {
    if (e.kind !== 'tool' && e.kind !== 'text' && e.kind !== 'tokens') continue;
    if (!first.has(e.agentId)) first.set(e.agentId, e.ts);
    last.set(e.agentId, e.ts);
  }
  const spawned = new Set<string>();
  const finished = new Set<string>();
  const out: ReplayEvent[] = [];
  for (const e of sorted) {
    if (e.kind === 'spawn') {
      if (e.agentId === 'main' || spawned.has(e.agentId)) continue;
      spawned.add(e.agentId);
      out.push({ ...e, ts: Math.min(e.ts, first.get(e.agentId) ?? e.ts) });
    } else if (e.kind === 'finish') {
      if (e.agentId === 'main' || finished.has(e.agentId)) continue;
      finished.add(e.agentId);
      out.push({ ...e, ts: Math.max(e.ts, last.get(e.agentId) ?? e.ts) });
    } else out.push(e);
  }
  return sortReplayEvents(out);
}

/** Keeps `keep` of `n` items, evenly spread (deterministic). */
function strideKeep<T>(items: T[], keep: number): T[] {
  if (keep >= items.length) return items;
  if (keep <= 0) return [];
  const out: T[] = [];
  const n = items.length;
  for (let i = 0; i < n; i++) if (Math.floor(((i + 1) * keep) / n) > Math.floor((i * keep) / n)) out.push(items[i]);
  return out;
}

/** Merges each agent's consecutive token turns into groups, so at most `keep` remain; sums are kept exactly. */
function mergeTokens(items: Extract<ReplayEvent, { kind: 'tokens' }>[], keep: number): ReplayEvent[] {
  if (keep >= items.length) return items;
  const per = new Map<string, Extract<ReplayEvent, { kind: 'tokens' }>[]>();
  for (const e of items) {
    const l = per.get(e.agentId);
    if (l) l.push(e);
    else per.set(e.agentId, [e]);
  }
  let g = Math.max(2, Math.ceil(items.length / Math.max(1, keep)));
  const count = (gg: number) => [...per.values()].reduce((a, l) => a + Math.ceil(l.length / gg), 0);
  while (count(g) > keep && g < items.length) g = Math.ceil(g * 1.25);
  const out: ReplayEvent[] = [];
  for (const l of per.values()) {
    for (let i = 0; i < l.length; i += g) {
      const chunk = l.slice(i, i + g);
      const t: T4 = [0, 0, 0, 0];
      let context: number | undefined;
      for (const c of chunk) {
        t[0] += c.t[0]; t[1] += c.t[1]; t[2] += c.t[2]; t[3] += c.t[3];
        if (c.context !== undefined) context = c.context;
      }
      const lastE = chunk[chunk.length - 1];
      out.push(context === undefined ? { kind: 'tokens', ts: lastE.ts, agentId: lastE.agentId, t } : { kind: 'tokens', ts: lastE.ts, agentId: lastE.agentId, t, context });
    }
  }
  return out;
}

/**
 * Caps a (sorted) list at `max` events. Structural events are all kept; the rest of the budget is shared by
 * tool calls (50%), token turns (35%) and texts (15%), unused shares going to the others. Tool calls and texts
 * are sampled evenly; token turns are merged per agent (totals stay exact).
 */
export function capReplayEvents(events: readonly ReplayEvent[], max = REPLAY_MAX_EVENTS): { events: ReplayEvent[]; sampled?: SessionReplay['sampled'] } {
  if (events.length <= max) return { events: [...events] };
  const structural: ReplayEvent[] = [];
  const tool: ReplayEvent[] = [];
  const text: ReplayEvent[] = [];
  const tokens: Extract<ReplayEvent, { kind: 'tokens' }>[] = [];
  for (const e of events) {
    if (STRUCTURAL.has(e.kind)) structural.push(e);
    else if (e.kind === 'tool') tool.push(e);
    else if (e.kind === 'text') text.push(e);
    else if (e.kind === 'tokens') tokens.push(e);
  }
  let budget = Math.max(0, max - structural.length);
  const want = { tool: tool.length, tokens: tokens.length, text: text.length };
  const share = { tool: 0.5, tokens: 0.35, text: 0.15 };
  const alloc = { tool: 0, tokens: 0, text: 0 };
  // Water-filling: a kind that needs less than its share gives the rest away.
  let open = (Object.keys(want) as (keyof typeof want)[]).filter((k) => want[k] > 0);
  while (open.length && budget > 0) {
    const w = open.reduce((a, k) => a + share[k], 0);
    let gave = false;
    for (const k of open) {
      const part = Math.floor((budget * share[k]) / w);
      if (want[k] - alloc[k] <= part) { budget -= want[k] - alloc[k]; alloc[k] = want[k]; gave = true; }
    }
    open = open.filter((k) => alloc[k] < want[k]);
    if (!gave) {
      const w2 = open.reduce((a, k) => a + share[k], 0);
      for (const k of open) alloc[k] += Math.floor((budget * share[k]) / w2);
      break;
    }
  }
  const kept = [...structural, ...strideKeep(tool, alloc.tool), ...strideKeep(text, alloc.text), ...mergeTokens(tokens, alloc.tokens)];
  const out = sortReplayEvents(kept);
  const n = (k: ReplayEventKind) => out.reduce((a, e) => a + (e.kind === k ? 1 : 0), 0);
  return { events: out, sampled: { tool: [n('tool'), tool.length], text: [n('text'), text.length], tokens: [n('tokens'), tokens.length] } };
}

// ---------- state at time t ----------

export interface ReplayAgent {
  id: string;
  type: string;
  description: string | null;
  /** As recorded at the spawn; the tree attaches to the nearest spawned ancestor. 'main' for the manager's children. */
  parentId: string | null;
  model: string | null;
  effort: string | null;
  spawnedAt: number;
  finishedAt: number | null;
  lastActivity: number;
  tokens: T4;
  toolCalls: number;
  currentTool: string | null;
  lastText: string | null;
  finishedChildren: number;
  /** Spawn order (tie-break for equal spawn times). */
  order: number;
}

export interface ReplayState {
  /** Events with ts <= t are applied. */
  t: number;
  /** Index of the next event to apply. */
  next: number;
  agents: Map<string, ReplayAgent>;
  status: SessionStatus;
  statusSince: number;
  reason: string | null;
  code: string | null;
  arg: string | null;
  tokens: T4;
  contextTokens: number | null;
  compactions: number;
  prompts: number;
  toolCalls: number;
  subagentsTotal: number;
  subagentsActive: number;
  lastActivity: number;
}

type ReplayMeta = Pick<SessionReplay, 'sessionId' | 'project' | 'cwd' | 'title' | 'model' | 'effort' | 'contextLimit' | 'startedAt' | 'endedAt' | 'events'>;

export function initialReplayState(r: Pick<SessionReplay, 'model' | 'effort' | 'startedAt'>): ReplayState {
  const main: ReplayAgent = {
    id: 'main', type: 'main', description: null, parentId: null, model: r.model, effort: r.effort, spawnedAt: r.startedAt, finishedAt: null,
    lastActivity: r.startedAt, tokens: [0, 0, 0, 0], toolCalls: 0, currentTool: null, lastText: null, finishedChildren: 0, order: 0,
  };
  return {
    t: -Infinity, next: 0, agents: new Map([['main', main]]), status: 'idle', statusSince: r.startedAt, reason: null, code: null, arg: null,
    tokens: [0, 0, 0, 0], contextTokens: null, compactions: 0, prompts: 0, toolCalls: 0, subagentsTotal: 0, subagentsActive: 0, lastActivity: r.startedAt,
  };
}

/** Applies one event (in list order). Events of agents that were never spawned only count for the session. */
export function applyReplayEvent(s: ReplayState, e: ReplayEvent): void {
  s.lastActivity = Math.max(s.lastActivity, e.ts);
  switch (e.kind) {
    case 'spawn': {
      if (s.agents.has(e.agentId)) return;
      s.agents.set(e.agentId, {
        id: e.agentId, type: e.agentType, description: e.description, parentId: e.parentId || 'main', model: e.model ?? null, effort: e.effort ?? null,
        spawnedAt: e.ts, finishedAt: null, lastActivity: e.ts, tokens: [0, 0, 0, 0], toolCalls: 0, currentTool: null, lastText: null,
        finishedChildren: 0, order: s.agents.size,
      });
      s.subagentsTotal++;
      s.subagentsActive++;
      // The parent's own action: an Agent call (it flashes on the scene like any tool call).
      const p = s.agents.get(e.parentId);
      if (p && p.finishedAt === null) { p.currentTool = `Agent → ${e.agentType}`; p.lastActivity = e.ts; }
      return;
    }
    case 'finish': {
      const a = s.agents.get(e.agentId);
      if (!a || a.finishedAt !== null || a.id === 'main') return;
      a.finishedAt = e.ts;
      a.lastActivity = e.ts;
      s.subagentsActive--;
      const p = a.parentId ? s.agents.get(a.parentId) : undefined;
      (p ?? s.agents.get('main')!).finishedChildren++;
      return;
    }
    case 'tool': {
      s.toolCalls++;
      const a = s.agents.get(e.agentId);
      if (a) { a.toolCalls++; a.currentTool = e.label; a.lastActivity = e.ts; }
      return;
    }
    case 'text': {
      const a = s.agents.get(e.agentId);
      if (a) { a.lastText = e.text; a.lastActivity = e.ts; }
      return;
    }
    case 'tokens': {
      for (let i = 0; i < 4; i++) s.tokens[i] += e.t[i];
      const a = s.agents.get(e.agentId);
      if (a) { for (let i = 0; i < 4; i++) a.tokens[i] += e.t[i]; a.lastActivity = e.ts; }
      if (e.agentId === 'main' && e.context !== undefined) s.contextTokens = e.context;
      return;
    }
    case 'prompt':
      s.prompts++;
      return;
    case 'compact':
      s.compactions++;
      return;
    case 'status':
      if (e.status !== s.status) s.statusSince = e.ts;
      s.status = e.status;
      s.reason = e.reason;
      s.code = e.code;
      s.arg = e.arg;
      return;
  }
}

/** Applies every event with ts <= t that is not applied yet; returns them (for animation and the console). */
function advance(s: ReplayState, events: readonly ReplayEvent[], t: number): ReplayEvent[] {
  const from = s.next;
  let i = from;
  while (i < events.length && events[i].ts <= t) applyReplayEvent(s, events[i++]);
  s.next = i;
  s.t = t;
  return events.slice(from, i) as ReplayEvent[];
}

/** The state at time t: every event with ts <= t applied, in list order. Pure. */
export function replayStateAt(r: ReplayMeta, t: number): ReplayState {
  const s = initialReplayState(r);
  advance(s, r.events, t);
  return s;
}

const toTokens = (t: T4) => ({ input: t[0], output: t[1], cacheRead: t[2], cacheWrite: t[3] });

/**
 * The agent tree at a state: unfinished agents, plus finished ones that still have unfinished descendants
 * (status 'done', like the live view). Each agent hangs under its nearest spawned ancestor; children are
 * sorted by spawn time. Fresh objects every call.
 */
export function replayTree(s: ReplayState): AgentNode {
  const agents = s.agents;
  // A parent that was never spawned (e.g. an out-of-order or sampled list): hang under the manager.
  const attach = (a: ReplayAgent): string => (a.parentId && agents.has(a.parentId) ? a.parentId : 'main');
  const visible = new Set<string>(['main']);
  for (const a of agents.values()) {
    if (a.id === 'main' || a.finishedAt !== null) continue;
    let cur: ReplayAgent | undefined = a;
    let guard = 0;
    while (cur && cur.id !== 'main' && !visible.has(cur.id) && guard++ < 64) {
      visible.add(cur.id);
      cur = agents.get(attach(cur));
    }
  }
  const kids = new Map<string, ReplayAgent[]>();
  for (const a of agents.values()) {
    if (a.id === 'main' || !visible.has(a.id)) continue;
    const p = attach(a);
    const l = kids.get(p);
    if (l) l.push(a);
    else kids.set(p, [a]);
  }
  const mainStatus: AgentStatus = s.status === 'waiting' ? 'waiting' : s.status === 'working' ? 'working' : 'idle';
  const build = (a: ReplayAgent, depth: number): AgentNode => {
    const ch = (kids.get(a.id) ?? []).sort((x, y) => x.spawnedAt - y.spawnedAt || x.order - y.order);
    return {
      id: a.id, type: a.type, description: a.description, depth,
      status: a.id === 'main' ? mainStatus : a.finishedAt !== null ? 'done' : 'working',
      model: a.model, effort: a.effort, currentTool: a.currentTool, lastText: a.lastText,
      startedAt: a.spawnedAt, lastActivity: a.lastActivity, tokens: toTokens(a.tokens), toolCalls: a.toolCalls,
      finishedChildren: a.finishedChildren, children: ch.map((c) => build(c, depth + 1)),
    };
  };
  return build(agents.get('main')!, 0);
}

/** The session as the galaxy draws it at a state (a LiveSession whose star grows with the tokens spent so far). */
export function replaySession(s: ReplayState, r: ReplayMeta): LiveSession {
  const total = s.tokens[0] + s.tokens[1] + s.tokens[2] + s.tokens[3];
  return {
    sessionId: r.sessionId, pid: null, alive: true, title: r.title, name: null, cwd: r.cwd, project: r.project, gitBranch: null,
    model: r.model, effort: r.effort, permissionMode: null, status: s.status, statusSince: s.statusSince, statusReason: s.reason,
    statusCode: s.code, statusArg: s.arg, startedAt: r.startedAt, lastActivity: s.lastActivity, tokens: toTokens(s.tokens), tokens24h: total,
    contextTokens: s.contextTokens, contextLimit: r.contextLimit, subagentsTotal: s.subagentsTotal, subagentsActive: s.subagentsActive,
    compactions: s.compactions, root: replayTree(s), kind: 'interactive',
  };
}

/**
 * Incremental access to replayStateAt: moving forward applies only the events in between (and returns them);
 * moving backward refolds from the start. `state` always equals replayStateAt(r, t).
 */
export class ReplayCursor {
  state: ReplayState;
  constructor(private r: ReplayMeta) {
    this.state = initialReplayState(r);
  }
  get replay() { return this.r; }
  /** Returns the events crossed going forward, or `snapped` when it had to rebuild (a seek backward). */
  moveTo(t: number): { crossed: ReplayEvent[]; snapped: boolean } {
    if (t < this.state.t) {
      this.state = initialReplayState(this.r);
      advance(this.state, this.r.events, t);
      return { crossed: [], snapped: true };
    }
    return { crossed: advance(this.state, this.r.events, t), snapped: false };
  }
}

// ---------- time map: idle-gap compression ----------

/** Gaps longer than this are compressed in "auto" mode. */
export const IDLE_GAP_MS = 30_000;
/** A compressed gap is IDLE_GAP_MS plus at most this much, however long it was. */
export const GAP_EXTRA_MS = 6_000;
/** How fast a compressed gap saturates. */
const GAP_TAU_MS = 10 * 60_000;

export interface TimeMap {
  start: number;
  end: number;
  /** Length of the play axis, ms. */
  duration: number;
  /** Original time → play time (0..duration). Monotonic. */
  toPlay(t: number): number;
  /** Play time → original time. Inverse of toPlay. */
  toReal(p: number): number;
  /** Compressed gaps (original time). */
  gaps: { from: number; to: number }[];
}

const gapPlay = (g: number) => (g <= IDLE_GAP_MS ? g : IDLE_GAP_MS + GAP_EXTRA_MS * (1 - Math.exp(-(g - IDLE_GAP_MS) / GAP_TAU_MS)));
const gapReal = (p: number) => {
  if (p <= IDLE_GAP_MS) return p;
  const f = Math.min(1 - 1e-12, (p - IDLE_GAP_MS) / GAP_EXTRA_MS);
  return IDLE_GAP_MS - GAP_TAU_MS * Math.log(1 - f);
};

/**
 * Maps original time to play time. Without compression it is a shift (play = t - start). With compression,
 * every stretch between consecutive timestamps longer than IDLE_GAP_MS is shortened: it keeps its first 30 s
 * and the rest saturates at GAP_EXTRA_MS (strictly increasing, so the map is invertible).
 */
export function buildTimeMap(timestamps: readonly number[], start: number, end: number, compress: boolean): TimeMap {
  end = Math.max(end, start);
  if (!compress) {
    return {
      start, end, duration: end - start, gaps: [],
      toPlay: (t) => Math.min(end, Math.max(start, t)) - start,
      toReal: (p) => start + Math.min(end - start, Math.max(0, p)),
    };
  }
  const knots: number[] = [start];
  for (const t of [...timestamps].sort((a, b) => a - b)) if (t > knots[knots.length - 1] && t < end) knots.push(t);
  if (end > knots[knots.length - 1]) knots.push(end);
  const play: number[] = [0];
  const gaps: { from: number; to: number }[] = [];
  for (let i = 1; i < knots.length; i++) {
    const g = knots[i] - knots[i - 1];
    if (g > IDLE_GAP_MS) gaps.push({ from: knots[i - 1], to: knots[i] });
    play.push(play[i - 1] + gapPlay(g));
  }
  const duration = play[play.length - 1];
  const seg = (arr: number[], v: number) => {
    let lo = 0, hi = arr.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; }
    return lo;
  };
  return {
    start, end, duration, gaps,
    toPlay(t) {
      if (knots.length < 2 || t <= start) return 0;
      if (t >= end) return duration;
      const i = seg(knots, t);
      return Math.min(play[i + 1], play[i] + gapPlay(t - knots[i]));
    },
    toReal(p) {
      if (knots.length < 2 || p <= 0) return start;
      if (p >= duration) return end;
      const i = seg(play, p);
      return Math.min(knots[i + 1], knots[i] + gapReal(p - play[i]));
    },
  };
}

/** Bins of the export warp (see buildTargetMap). */
const WARP_BINS = 240;
/** Box-filter radius (bins) that smooths the activity profile, so the playback speed changes gradually. */
const WARP_SMOOTH = 4;

/**
 * A time map whose play axis lasts `targetMs` (video export: "make this run a 30-second clip"). Idle gaps are
 * compressed first (as in "auto"); the compressed axis is then warped so that busy stretches get more of the
 * clip than quiet ones: each of WARP_BINS bins gets a share 0.4 + 0.6·min(3, √(activity / mean)) of the time,
 * smoothed over neighbouring bins. The result is continuous, strictly increasing and invertible, starts at 0,
 * ends exactly at `targetMs`, and its local speed never varies by more than 5.5× across the clip.
 * A run that is already shorter than the target (after gap compression) is not slowed down: the map is
 * returned as is, and the clip is shorter. `targetMs` null: gap compression only (real speed).
 */
export function buildTargetMap(timestamps: readonly number[], start: number, end: number, targetMs: number | null): TimeMap {
  end = Math.max(end, start);
  const inRange = timestamps.filter((t) => t >= start && t <= end);
  const base = buildTimeMap(inRange, start, end, true);
  if (targetMs == null || !(targetMs > 0) || base.duration <= targetMs) return base;
  const n = WARP_BINS;
  const bw = base.duration / n;
  const cnt = new Array<number>(n).fill(0);
  for (const t of inRange) cnt[Math.min(n - 1, Math.floor(base.toPlay(t) / bw))]++;
  const sm = cnt.map((_, i) => {
    let s = 0, k = 0;
    for (let j = Math.max(0, i - WARP_SMOOTH); j <= Math.min(n - 1, i + WARP_SMOOTH); j++) { s += cnt[j]; k++; }
    return s / k;
  });
  const mean = sm.reduce((a, v) => a + v, 0) / n;
  const w = sm.map((v) => (mean > 0 ? 0.4 + 0.6 * Math.min(3, Math.sqrt(v / mean)) : 1));
  const cum: number[] = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + w[i]);
  const k = targetMs / cum[n];
  const toVideo = (p: number) => {
    const x = Math.min(n, Math.max(0, p / bw));
    const i = Math.min(n - 1, Math.floor(x));
    return Math.min(targetMs, (cum[i] + w[i] * (x - i)) * k);
  };
  const toBase = (v: number) => {
    const c = Math.min(cum[n], Math.max(0, v / k));
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= c) lo = m; else hi = m; }
    return Math.min(base.duration, (lo + (c - cum[lo]) / w[lo]) * bw);
  };
  return {
    start, end, duration: targetMs, gaps: base.gaps,
    toPlay: (t) => (t <= start ? 0 : t >= end ? targetMs : toVideo(base.toPlay(t))),
    toReal: (v) => (v <= 0 ? start : v >= targetMs ? end : base.toReal(toBase(v))),
  };
}

/** Playback rate of "auto": the compressed replay takes about this long (clamped to 1×..60×). */
export const AUTO_TARGET_MS = 150_000;
export function autoRate(duration: number): number {
  return Math.min(60, Math.max(1, Math.round(duration / AUTO_TARGET_MS)));
}

// ---------- markers and density ----------

export type MarkerKind = 'spawn' | 'wait' | 'compact' | 'prompt';
export interface ReplayMarker { ts: number; kind: MarkerKind; label: string }

/** Track markers: spawns, waits (the start of each waiting stretch), compactions and prompts, in time order. */
export function extractMarkers(events: readonly ReplayEvent[]): ReplayMarker[] {
  const out: ReplayMarker[] = [];
  let waiting = false;
  for (const e of events) {
    if (e.kind === 'spawn') out.push({ ts: e.ts, kind: 'spawn', label: e.description ? `${e.agentType}: ${e.description}` : e.agentType });
    else if (e.kind === 'compact') out.push({ ts: e.ts, kind: 'compact', label: '' });
    else if (e.kind === 'prompt') out.push({ ts: e.ts, kind: 'prompt', label: e.text });
    else if (e.kind === 'status') {
      if (e.status === 'waiting' && !waiting) out.push({ ts: e.ts, kind: 'wait', label: e.reason ?? '' });
      waiting = e.status === 'waiting';
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

/** The first marker strictly after t (dir 1) or strictly before t (dir -1), or null. */
export function nearestMarker(markers: readonly ReplayMarker[], t: number, dir: 1 | -1, eps = 1): ReplayMarker | null {
  if (dir > 0) return markers.find((m) => m.ts > t + eps) ?? null;
  for (let i = markers.length - 1; i >= 0; i--) if (markers[i].ts < t - eps) return markers[i];
  return null;
}

/** The first event strictly after t (dir 1) or the last one strictly before t (dir -1): ←/→ stepping. */
export function nearestEventTs(events: readonly ReplayEvent[], t: number, dir: 1 | -1): number | null {
  let lo = 0, hi = events.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (events[m].ts <= t) lo = m + 1; else hi = m; }
  // lo: first index with ts > t
  if (dir > 0) return lo < events.length ? events[lo].ts : null;
  for (let i = lo - 1; i >= 0; i--) if (events[i].ts < t) return events[i].ts;
  return null;
}

/** Activity per bin along the play axis (tool calls, spawns, texts), normalized to 0..1. */
export function densityBins(events: readonly ReplayEvent[], map: Pick<TimeMap, 'toPlay' | 'duration'>, bins: number): number[] {
  const out = new Array<number>(Math.max(1, bins)).fill(0);
  const d = Math.max(1, map.duration);
  for (const e of events) {
    if (e.kind !== 'tool' && e.kind !== 'spawn' && e.kind !== 'text') continue;
    const i = Math.min(out.length - 1, Math.floor((map.toPlay(e.ts) / d) * out.length));
    out[i] += e.kind === 'spawn' ? 2 : 1;
  }
  const max = Math.max(...out);
  return max > 0 ? out.map((v) => v / max) : out;
}
