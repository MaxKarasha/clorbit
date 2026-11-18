// The subscription-limit forecast on the server: limits history (SQLite) + the latest reading +
// transcript token usage, fed into the pure model in shared/forecast.ts.
import type { Limits, LimitsForecast, LimitsPoint } from '../shared/api.ts';
import { forecastLimits, TOKEN_WEIGHTS, type UsageBucket } from '../shared/forecast';
import type { FileSummary } from './types';
import { localDate, sumT4, type T4 } from './util';

const H = 3_600_000;
const MIN = 60_000;
/** History the forecast looks at: one 7-day window plus a day of margin. */
export const FORECAST_LOOKBACK_MS = 8 * 24 * H;
/** A forecast is recomputed when the reading changes, or at least this often. */
export const FORECAST_TTL_MS = 15_000;

const weightT4 = (t: T4) => t[0] * TOKEN_WEIGHTS.input + t[1] * TOKEN_WEIGHTS.output + t[2] * TOKEN_WEIGHTS.cacheRead + t[3] * TOKEN_WEIGHTS.cacheWrite;

/**
 * Weighted token usage since `from`, as non-overlapping buckets: hourly buckets (from the summaries'
 * per-hour aggregates) up to one hour ago, then one-minute buckets (the per-minute burn of the last
 * hour). Minute buckets only hold totals, so each file's token mix converts them to weighted tokens.
 */
export function usageBuckets(files: Iterable<FileSummary>, from: number, now: number): UsageBucket[] {
  const cut = now - H;
  const cutMin = Math.floor(cut / MIN);
  const byStart = new Map<number, { end: number; tokens: number }>();
  const add = (start: number, end: number, tokens: number) => {
    if (!(tokens > 0) || end <= start) return;
    const b = byStart.get(start);
    if (b) b.tokens += tokens;
    else byStart.set(start, { end, tokens });
  };
  const fromDate = localDate(from);
  for (const s of files) {
    if (s.lastTs < from) continue;
    for (const [date, day] of Object.entries(s.days)) {
      if (date < fromDate) continue;
      const [y, m, d] = date.split('-').map(Number);
      for (const [h, t] of Object.entries(day.hours)) {
        const start = new Date(y, m - 1, d, Number(h)).getTime();
        const end = start + H;
        if (end <= from || start >= cut) continue;
        // The part after `cut` is counted from minute buckets below.
        const keep = end > cut ? (cut - start) / H : 1;
        add(start, Math.min(end, cut), weightT4(t) * keep);
      }
    }
    const total = sumT4(s.total);
    const mix = total > 0 ? weightT4(s.total) / total : 1;
    for (const [k, v] of Object.entries(s.minutes)) {
      const mk = Number(k);
      if (mk < cutMin || mk * MIN > now) continue;
      const start = Math.max(mk * MIN, cut);
      add(start, mk * MIN + MIN, v * mix);
    }
  }
  return [...byStart].map(([start, b]) => ({ start, end: b.end, tokens: b.tokens })).sort((a, b) => a.start - b.start);
}

/** Computes the forecast on demand, cached until the reading changes or FORECAST_TTL_MS passes. */
export class LimitsForecaster {
  private cache: { at: number; key: string; v: LimitsForecast } | null = null;

  constructor(
    private history: (from: number, to: number) => LimitsPoint[],
    private files: () => Iterable<FileSummary>,
  ) {}

  get(limits: Limits | null, now = Date.now()): LimitsForecast {
    const key = JSON.stringify(limits);
    const c = this.cache;
    if (c && c.key === key && now - c.at < FORECAST_TTL_MS && now >= c.at) return c.v;
    let v: LimitsForecast;
    if (!limits || (limits.fiveHourPct == null && limits.sevenDayPct == null)) {
      v = forecastLimits({ now, limits: null, history: [] });
    } else {
      const from = now - FORECAST_LOOKBACK_MS;
      v = forecastLimits({ now, limits, history: this.history(from, now), usage: usageBuckets(this.files(), from, now) });
    }
    this.cache = { at: now, key, v };
    return v;
  }
}
