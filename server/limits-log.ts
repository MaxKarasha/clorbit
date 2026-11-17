// Subscription-limit history: a row whenever the statusline-captured values change.
import type { Limits, LimitsPoint } from '../shared/api.ts';
import type { ClorbitDb } from './db';

export const LIMITS_POLL_MS = 30_000;

type Key = [number | null, number | null, number | null, number | null];
const keyOf = (l: Limits): Key => [l.fiveHourPct, l.fiveHourResetsAt, l.sevenDayPct, l.sevenDayResetsAt];
const sameKey = (a: Key, b: Key) => a.every((v, i) => v === b[i]);

export class LimitsLog {
  private last: { ts: number; key: Key } | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private db: ClorbitDb | null, private read: () => Limits | null) {
    if (!db) return;
    const r = db.stmt('SELECT ts, five_pct, five_resets_at, week_pct, week_resets_at FROM limits ORDER BY ts DESC LIMIT 1').get() as
      | { ts: number; five_pct: number | null; five_resets_at: number | null; week_pct: number | null; week_resets_at: number | null }
      | undefined;
    if (r) this.last = { ts: r.ts, key: [r.five_pct, r.five_resets_at, r.week_pct, r.week_resets_at] };
  }

  start(intervalMs = LIMITS_POLL_MS) {
    this.poll();
    this.timer = setInterval(() => this.poll(), intervalMs);
    this.timer.unref?.();
  }

  stop() { if (this.timer) clearInterval(this.timer); }

  poll(): boolean {
    try { return this.record(this.read()); } catch (e) {
      console.error('[clorbit] could not record limits:', (e as Error).message);
      return false;
    }
  }

  /** Inserts a row only when any of the four values differs from the last recorded row. */
  record(l: Limits | null): boolean {
    if (!this.db || !l) return false;
    if (l.fiveHourPct === null && l.sevenDayPct === null) return false;
    const key = keyOf(l);
    if (this.last && sameKey(this.last.key, key)) return false;
    // ts is when the statusline wrote the values; keep it strictly increasing.
    const ts = Math.max(Math.round(l.updatedAt || Date.now()), (this.last?.ts ?? 0) + 1);
    this.db.stmt('INSERT OR IGNORE INTO limits(ts, five_pct, five_resets_at, week_pct, week_resets_at) VALUES(?, ?, ?, ?, ?)').run(ts, ...key);
    this.last = { ts, key };
    return true;
  }

  history(from: number, to: number): LimitsPoint[] {
    if (!this.db) return [];
    const rows = this.db.stmt('SELECT ts, five_pct, week_pct FROM limits WHERE ts >= ? AND ts <= ? ORDER BY ts').all(from, to) as
      { ts: number; five_pct: number | null; week_pct: number | null }[];
    return rows.map((r) => ({ ts: r.ts, fiveHourPct: r.five_pct, sevenDayPct: r.week_pct }));
  }
}

/** Parses ?from&to: local 'YYYY-MM-DD' (inclusive day) or epoch ms. Defaults to the last 7 days. */
export function parseTsRange(q: URLSearchParams, now = Date.now()): { from: number; to: number } {
  const parse = (v: string | null, end: boolean): number | null => {
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + (end ? 1 : 0)).getTime();
      return end ? d - 1 : d;
    }
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  let to = parse(q.get('to'), true) ?? now;
  let from = parse(q.get('from'), false) ?? to - 7 * 24 * 3_600_000;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}
