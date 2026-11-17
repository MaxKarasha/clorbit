// Hook event log: trimmed payloads in SQLite, 90-day retention, and "waiting for
// the user" intervals derived from the event stream.
import type { ClorbitDb } from './db';

export const HOOK_RETENTION_MS = 90 * 24 * 3_600_000;
export const MAX_PAYLOAD_BYTES = 4096;
/** A single wait longer than this is treated as "walked away", and capped. */
export const WAIT_CAP_MS = 6 * 3_600_000;

export interface HookRow {
  ts: number;
  sessionId: string | null;
  event: string;
  tool: string | null;
  agentId: string | null;
  notificationType: string | null;
  payload: string;
}

const str = (v: unknown, n: number) => {
  const s = String(v);
  return s.length > n ? s.slice(0, n) + '…' : s;
};

function trimShallow(v: unknown, maxStr: number, maxKeys: number): unknown {
  if (typeof v === 'string') return str(v, maxStr);
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return `[array:${v.length}]`;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (++n > maxKeys) { out._more = true; break; }
    out[k] = typeof x === 'string' ? str(x, maxStr) : x !== null && typeof x === 'object' ? (Array.isArray(x) ? `[array:${x.length}]` : '[object]') : x;
  }
  return out;
}

/**
 * Keeps the useful, small part of a hook payload: top-level scalars, a shallow
 * tool_input with short strings, and only the size of tool_response. The result
 * is guaranteed to be at most MAX_PAYLOAD_BYTES of UTF-8.
 */
export function trimHookPayload(body: Record<string, unknown>): string {
  const build = (maxStr: number, withInput: boolean) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (k === 'tool_response') {
        let size = 0;
        try { size = JSON.stringify(v)?.length ?? 0; } catch { /* circular — impossible for JSON input */ }
        out.tool_response_chars = size;
      } else if (k === 'tool_input') {
        if (withInput) out.tool_input = trimShallow(v, Math.min(maxStr, 200), 12);
      } else {
        out[k] = trimShallow(v, maxStr, 12);
      }
    }
    return JSON.stringify(out);
  };
  for (const [maxStr, withInput] of [[500, true], [120, true], [120, false], [40, false]] as const) {
    const s = build(maxStr, withInput);
    if (Buffer.byteLength(s) <= MAX_PAYLOAD_BYTES) return s;
  }
  return JSON.stringify({ hook_event_name: str(body.hook_event_name ?? '', 64), session_id: str(body.session_id ?? '', 64), truncated: true });
}

export function toHookRow(body: any, ts = Date.now()): HookRow | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const event = String(body.hook_event_name ?? body.hookEventName ?? '');
  if (!event) return null;
  return {
    ts,
    sessionId: body.session_id ? str(body.session_id, 64) : null,
    event: str(event, 64),
    tool: body.tool_name ? str(body.tool_name, 200) : null,
    agentId: body.agent_id ? str(body.agent_id, 64) : null,
    notificationType: body.notification_type ? str(body.notification_type, 64) : null,
    payload: trimHookPayload(body),
  };
}

// ---------- wait intervals ----------

export interface WaitEvent {
  ts: number;
  sessionId: string;
  event: string;
  tool: string | null;
  notificationType: string | null;
  message: string | null;
}

export interface WaitInterval {
  sessionId: string;
  start: number;
  end: number;
  kind: 'permission' | 'input';
  tool: string | null;
}

const WAIT_END = new Set(['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'UserPromptSubmit', 'Stop', 'SessionEnd']);

function waitStart(e: WaitEvent): { kind: WaitInterval['kind']; tool: string | null } | null {
  if (e.event === 'PermissionRequest') return { kind: 'permission', tool: e.tool };
  if (e.event !== 'Notification') return null;
  const type = e.notificationType ?? '';
  const msg = e.message ?? '';
  if (type === 'idle_prompt' || /waiting for your input/i.test(msg)) return { kind: 'input', tool: null };
  const m = /permission to use ([\w:.-]+)/i.exec(msg);
  if (type === 'permission_prompt' || m) return { kind: 'permission', tool: m ? m[1] : null };
  return null;
}

/**
 * The session waited for the user from a Notification (permission/idle) or a
 * PermissionRequest until the next PreToolUse / PostToolUse(Failure) /
 * UserPromptSubmit / Stop / SessionEnd of that session. Repeated wait signals
 * while already waiting extend nothing (the earliest start wins); a wait never
 * closed by a later event is dropped. Intervals are capped at WAIT_CAP_MS.
 */
export function deriveWaits(events: WaitEvent[], cap = WAIT_CAP_MS): WaitInterval[] {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const open = new Map<string, { start: number; kind: WaitInterval['kind']; tool: string | null }>();
  const out: WaitInterval[] = [];
  for (const e of sorted) {
    const w = waitStart(e);
    const cur = open.get(e.sessionId);
    if (w) {
      if (!cur) open.set(e.sessionId, { start: e.ts, ...w });
      else {
        // A permission request outranks a generic idle notice; fill a missing tool name.
        if (w.kind === 'permission' && cur.kind === 'input') cur.kind = 'permission';
        if (!cur.tool && w.tool) cur.tool = w.tool;
      }
      continue;
    }
    if (cur && WAIT_END.has(e.event)) {
      open.delete(e.sessionId);
      const tool = cur.tool ?? (cur.kind === 'permission' && e.event.startsWith('PostToolUse') ? e.tool : null);
      out.push({ sessionId: e.sessionId, start: cur.start, end: Math.min(e.ts, cur.start + cap), kind: cur.kind, tool });
    }
  }
  return out;
}

// ---------- storage ----------

export class HookLog {
  version = 0;
  private queue: HookRow[] = [];
  private timer: NodeJS.Timeout | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;

  constructor(private db: ClorbitDb | null) {}

  /** Starts retention: once now, then daily. */
  start() {
    this.prune();
    this.pruneTimer = setInterval(() => this.prune(), 24 * 3_600_000);
    this.pruneTimer.unref?.();
  }

  stop() {
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.flush();
  }

  /** Queues a hook body; rows are written in one transaction shortly after. */
  record(body: unknown, ts = Date.now()) {
    if (!this.db) return;
    const row = toHookRow(body, ts);
    if (!row) return;
    this.queue.push(row);
    if (this.queue.length >= 200) this.flush();
    else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 1000);
      this.timer.unref?.();
    }
  }

  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.db || !this.queue.length) return;
    const rows = this.queue.splice(0);
    const st = this.db.stmt('INSERT INTO hook_events(ts, session_id, event, tool, agent_id, notification_type, payload_json) VALUES(?, ?, ?, ?, ?, ?, ?)');
    try {
      this.db.tx(() => { for (const r of rows) st.run(r.ts, r.sessionId, r.event, r.tool, r.agentId, r.notificationType, r.payload); });
      this.version++;
    } catch (e) {
      console.error('[clorbit] could not write hook events:', (e as Error).message);
    }
  }

  prune(now = Date.now()): number {
    if (!this.db) return 0;
    try {
      const r = this.db.stmt('DELETE FROM hook_events WHERE ts < ?').run(now - HOOK_RETENTION_MS);
      if (r.changes) this.version++;
      return Number(r.changes);
    } catch (e) {
      console.error('[clorbit] could not prune old hook events:', (e as Error).message);
      return 0;
    }
  }

  /** Whether any hook event exists in [from, to). */
  hasEvents(from: number, to: number): boolean {
    if (!this.db) return false;
    this.flush();
    return !!this.db.stmt('SELECT 1 AS x FROM hook_events WHERE ts >= ? AND ts < ? LIMIT 1').get(from, to);
  }

  /** Wait-relevant events in [from, to), with the Notification message pulled from the payload. */
  waitEvents(from: number, to: number): WaitEvent[] {
    if (!this.db) return [];
    this.flush();
    const rows = this.db.stmt(`SELECT ts, session_id, event, tool, notification_type,
        CASE WHEN event = 'Notification' THEN json_extract(payload_json, '$.message') END AS message
      FROM hook_events
      WHERE ts >= ? AND ts < ? AND session_id IS NOT NULL
        AND event IN ('Notification', 'PermissionRequest', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'UserPromptSubmit', 'Stop', 'SessionEnd')
      ORDER BY ts, id`).all(from, to) as { ts: number; session_id: string; event: string; tool: string | null; notification_type: string | null; message: string | null }[];
    return rows.map((r) => ({ ts: r.ts, sessionId: r.session_id, event: r.event, tool: r.tool, notificationType: r.notification_type, message: r.message }));
  }
}
