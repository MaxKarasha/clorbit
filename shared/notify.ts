// Notification detection: turns live snapshots and live events into "notify the user" events.
// Pure and deterministic (time comes from the inputs), shared by the web app (sound, browser
// notifications, toasts) and the server (system notifications).
import type { AgentNode, ClorbitEvent, Limits, NotifyEventType, SessionStatus } from './api';

/** The part of a LiveSession the detector needs. */
export interface DetectSession {
  sessionId: string;
  alive: boolean;
  status: SessionStatus;
  project: string;
  contextTokens: number | null;
  contextLimit: number | null;
  statusCode?: string | null;
  statusArg?: string | null;
  root?: AgentNode;
}

export interface DetectSnapshot {
  now: number;
  sessions: DetectSession[];
  limits: Limits | null;
}

export type WaitKind = 'permission' | 'input' | 'you';

export interface NotifyEvent {
  type: NotifyEventType;
  ts: number;
  sessionId: string | null;
  project: string | null;
  /** session_waiting: what the session waits for, and the tool for a permission prompt. */
  wait?: WaitKind;
  tool?: string | null;
  /** subagent_*: the agent type ('Explore', ...), when known. */
  agentType?: string | null;
  /** context_high / limit_high: the fill in percent; limit_high: which window. */
  pct?: number;
  window?: '5h' | '7d';
  /** How many events were merged into this one (bursts of finished subagents). */
  count?: number;
}

export interface DetectResult {
  events: NotifyEvent[];
  /** Sessions that stopped waiting (their "waiting" notifications can go away). */
  resolved: string[];
}

export const CONTEXT_HIGH = 0.85;
export const CONTEXT_REARM = 0.75;
export const LIMIT_HIGH = 80;
export const LIMIT_REARM = 75;

/** Status reason code → what the session waits for. */
export function waitKind(code: string | null | undefined): WaitKind {
  if (code === 'waitingInput') return 'input';
  if (code === 'waitingPermission' || code === 'probablyPermission' || code === 'waitingPermissionAny') return 'permission';
  return 'you';
}

interface SessState {
  status: SessionStatus;
  statusTs: number;
  alive: boolean;
  project: string;
  code: string | null;
  arg: string | null;
  waitNotified: boolean;
  ctxNotified: boolean;
}

type StatusEvent = Extract<ClorbitEvent, { kind: 'status' }>;

/**
 * Rules:
 * - the first snapshot is a baseline: nothing fires for what is already going on (events before it are ignored);
 * - only sessions with a live process notify;
 * - → waiting: once per wait (re-armed when the session leaves `waiting`);
 * - working → idle: the answer is ready;
 * - spawn / finish / compact events (each deduplicated: hooks and transcripts may report the same thing);
 * - context fill crossing 85% (once until it drops below 75%);
 * - a subscription window crossing 80% (once per window, identified by its reset time).
 * A snapshot older than the latest status event of a session does not override that status.
 */
export class NotifyDetector {
  private sessions = new Map<string, SessState>();
  private baseline = false;
  private limitNotified: { '5h': string | null; '7d': string | null } = { '5h': null, '7d': null };
  private agentTypes = new Map<string, string>();
  private seen = new Map<string, number>(); // dedupe keys → ts

  get ready(): boolean { return this.baseline; }

  onSnapshot(snap: DetectSnapshot): DetectResult {
    const res: DetectResult = { events: [], resolved: [] };
    const now = snap.now;
    for (const s of snap.sessions) if (s.root) this.learnAgents(s.sessionId, s.root);
    if (!this.baseline) {
      for (const s of snap.sessions) {
        const fill = s.contextTokens && s.contextLimit ? s.contextTokens / s.contextLimit : 0;
        this.sessions.set(s.sessionId, {
          status: s.status, statusTs: now, alive: s.alive, project: s.project, code: s.statusCode ?? null, arg: s.statusArg ?? null,
          waitNotified: s.status === 'waiting', ctxNotified: fill > CONTEXT_HIGH,
        });
      }
      for (const w of ['5h', '7d'] as const) {
        const { pct, key } = this.limitOf(snap.limits, w);
        if (pct != null && pct > LIMIT_HIGH) this.limitNotified[w] = key;
      }
      this.baseline = true;
      return res;
    }
    const present = new Set<string>();
    for (const s of snap.sessions) {
      present.add(s.sessionId);
      let st = this.sessions.get(s.sessionId);
      if (!st) {
        // A session that appeared after the baseline starts from "idle" so a first "waiting" still notifies.
        st = { status: 'idle', statusTs: 0, alive: s.alive, project: s.project, code: null, arg: null, waitNotified: false, ctxNotified: false };
        this.sessions.set(s.sessionId, st);
      }
      st.alive = s.alive;
      st.project = s.project;
      if (now >= st.statusTs) this.applyStatus(s.sessionId, st, s.status, now, s.statusCode ?? null, s.statusArg ?? null, res);
      const fill = s.contextTokens && s.contextLimit ? s.contextTokens / s.contextLimit : 0;
      if (fill > CONTEXT_HIGH && !st.ctxNotified && st.alive) {
        st.ctxNotified = true;
        res.events.push({ type: 'context_high', ts: now, sessionId: s.sessionId, project: st.project, pct: Math.round(fill * 100) });
      } else if (fill < CONTEXT_REARM) st.ctxNotified = false;
    }
    for (const [sid, st] of this.sessions) {
      if (present.has(sid)) continue;
      if (st.status === 'waiting') res.resolved.push(sid);
      this.sessions.delete(sid);
    }
    for (const w of ['5h', '7d'] as const) {
      const { pct, key } = this.limitOf(snap.limits, w);
      if (pct == null) continue;
      if (pct > LIMIT_HIGH && this.limitNotified[w] !== key) {
        this.limitNotified[w] = key;
        res.events.push({ type: 'limit_high', ts: now, sessionId: null, project: null, pct: Math.round(pct), window: w });
      } else if (pct < LIMIT_REARM) this.limitNotified[w] = null;
    }
    this.gc(now);
    return res;
  }

  onEvent(e: ClorbitEvent): DetectResult {
    const res: DetectResult = { events: [], resolved: [] };
    if (!this.baseline) return res;
    const st = this.sessions.get(e.sessionId);
    if (e.kind === 'spawn') this.agentTypes.set(`${e.sessionId}:${e.agentId}`, e.agentType);
    if (!st || !st.alive) {
      // Still track statuses of known sessions so a later snapshot does not replay them.
      if (st && e.kind === 'status') this.applyStatus(e.sessionId, st, e.status, e.ts, (e as StatusEvent).code ?? null, (e as StatusEvent).arg ?? null, res);
      return res;
    }
    const base = { ts: e.ts, sessionId: e.sessionId, project: st.project };
    switch (e.kind) {
      case 'status':
        this.applyStatus(e.sessionId, st, e.status, e.ts, e.code ?? null, e.arg ?? null, res);
        break;
      case 'spawn':
        if (this.once(`spawn:${e.sessionId}:${e.agentId}`, e.ts)) res.events.push({ type: 'subagent_spawned', ...base, agentType: e.agentType });
        break;
      case 'finish':
        if (this.once(`finish:${e.sessionId}:${e.agentId}`, e.ts)) {
          res.events.push({ type: 'subagent_finished', ...base, agentType: this.agentTypes.get(`${e.sessionId}:${e.agentId}`) ?? null });
        }
        break;
      case 'compact': {
        // PreCompact (hook) and the transcript's compaction boundary describe the same compaction.
        const last = this.seen.get(`compact:${e.sessionId}`);
        this.seen.set(`compact:${e.sessionId}`, e.ts);
        if (last == null || Math.abs(e.ts - last) > 120_000) res.events.push({ type: 'compaction', ...base });
        break;
      }
    }
    return res;
  }

  private applyStatus(sid: string, st: SessState, status: SessionStatus, ts: number, code: string | null, arg: string | null, res: DetectResult) {
    if (ts < st.statusTs) return;
    const prev = st.status;
    st.statusTs = ts;
    if (status === prev) {
      // Same status, maybe a more precise reason (e.g. the tool of a permission prompt).
      if (code) { st.code = code; st.arg = arg; }
      return;
    }
    st.status = status;
    st.code = code;
    st.arg = arg;
    if (prev === 'waiting') {
      st.waitNotified = false;
      res.resolved.push(sid);
    }
    if (!st.alive) return;
    if (status === 'waiting' && !st.waitNotified) {
      st.waitNotified = true;
      res.events.push({ type: 'session_waiting', ts, sessionId: sid, project: st.project, wait: waitKind(code), tool: arg });
    } else if (prev === 'working' && status === 'idle') {
      res.events.push({ type: 'session_done', ts, sessionId: sid, project: st.project });
    }
  }

  private limitOf(l: Limits | null, w: '5h' | '7d'): { pct: number | null; key: string } {
    if (!l) return { pct: null, key: '' };
    const pct = w === '5h' ? l.fiveHourPct : l.sevenDayPct;
    const at = w === '5h' ? l.fiveHourResetsAt : l.sevenDayResetsAt;
    // Reset times jitter by a few seconds between captures: round to the minute.
    return { pct, key: at ? String(Math.round(at / 60_000)) : 'unknown' };
  }

  private learnAgents(sid: string, n: AgentNode) {
    if (n.depth > 0) this.agentTypes.set(`${sid}:${n.id}`, n.type);
    for (const c of n.children) this.learnAgents(sid, c);
  }

  private once(key: string, ts: number): boolean {
    if (this.seen.has(key)) return false;
    this.seen.set(key, ts);
    return true;
  }

  private gc(now: number) {
    if (this.seen.size > 4000) for (const [k, ts] of this.seen) if (now - ts > 3_600_000) this.seen.delete(k);
    if (this.agentTypes.size > 4000) this.agentTypes.clear();
  }
}
