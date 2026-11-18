// Subscription-limit forecast: when will the 5-hour and 7-day windows run out?
// Pure and deterministic (time comes from the inputs); used by the server (API, live snapshot,
// notifications) and by the web app's demo mode.
//
// Model, per window:
// 1. The window's series is the limits history (one point per recorded change) plus the latest
//    reading. A new window starts where the reset time moves or the used % drops; only the
//    current window is used, so resets never bend the trend.
// 2. Basis "limits": a recency-weighted linear regression of % over time (half-life 30 min for 5 h,
//    2 days for 7 d, so the day-night rhythm averages out). Used when the window has enough points over a long enough span.
// 3. Basis "tokens" (thin history): the % gained between the window's first and last point is
//    divided by the weighted transcript tokens spent in the same interval; that ratio times the
//    recent token rate (last 30 min) is the burn. Needs at least two points in the window.
// 4. Otherwise no forecast. The projection starts at the latest reading (or now, when that reading
//    is stale: the status line only writes while Claude Code is active, so silence means idle).
import type { ForecastBasis, ForecastConfidence, Limits, LimitsForecast, LimitsPoint, LimitWindow, Tokens, WindowForecast } from './api';

const H = 3_600_000;
const MIN = 60_000;

export const WINDOW_MS: Record<LimitWindow, number> = { '5h': 5 * H, '7d': 7 * 24 * H };

/** Tuning per window. */
export const FORECAST_TUNING: Record<LimitWindow, {
  halfLife: number;      // regression weight halves every halfLife (ms) into the past
  minSpan: number;       // the limits basis needs points spread over at least this
  goodSpan: number;      // ... and this much for high confidence
  stale: number;         // a reading older than this is projected from now (idle since then)
  resetTolerance: number; // reset times closer than this are the same window (they jitter)
  recent: number;        // token proxy: the recent token rate is measured over this
}> = {
  '5h': { halfLife: 30 * MIN, minSpan: 10 * MIN, goodSpan: 45 * MIN, stale: 20 * MIN, resetTolerance: 10 * MIN, recent: 30 * MIN },
  '7d': { halfLife: 48 * H, minSpan: 2 * H, goodSpan: 12 * H, stale: 6 * H, resetTolerance: H, recent: 3 * H },
};

/** Relative weight of token kinds against subscription limits (roughly their price ratio to input). */
export const TOKEN_WEIGHTS: Tokens = { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 };

export function weightTokens(t: Tokens): number {
  return t.input * TOKEN_WEIGHTS.input + t.output * TOKEN_WEIGHTS.output + t.cacheRead * TOKEN_WEIGHTS.cacheRead + t.cacheWrite * TOKEN_WEIGHTS.cacheWrite;
}

/** Weighted transcript tokens spent in [start, end). Buckets must not overlap. */
export interface UsageBucket { start: number; end: number; tokens: number }

/** One point of one window: used % at ts, with the window's reset time when known. */
export interface WindowPoint { ts: number; pct: number; resetsAt: number | null }

/** The series of one window type from history rows, oldest first (rows without a value are skipped). */
export function windowSeries(points: LimitsPoint[], w: LimitWindow): WindowPoint[] {
  const out: WindowPoint[] = [];
  for (const p of points) {
    const pct = w === '5h' ? p.fiveHourPct : p.sevenDayPct;
    if (pct == null || !Number.isFinite(pct)) continue;
    const r = w === '5h' ? p.fiveHourResetsAt : p.sevenDayResetsAt;
    out.push({ ts: p.ts, pct, resetsAt: r ?? null });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

/** Does `b` start a new window after `a`? A moved reset time or a drop in % marks it. */
export function isNewWindow(a: WindowPoint, b: WindowPoint, w: LimitWindow): boolean {
  if (a.resetsAt != null && b.resetsAt != null && Math.abs(b.resetsAt - a.resetsAt) > FORECAST_TUNING[w].resetTolerance) return true;
  // A reset that happened between the two readings (the old reset time is already behind b).
  if (a.resetsAt != null && b.ts >= a.resetsAt && b.resetsAt == null) return true;
  return b.pct < a.pct - 0.5;
}

/** Splits a series into windows (oldest first). */
export function splitWindows(series: WindowPoint[], w: LimitWindow): WindowPoint[][] {
  const out: WindowPoint[][] = [];
  let cur: WindowPoint[] = [];
  for (const p of series) {
    if (cur.length && isNewWindow(cur[cur.length - 1], p, w)) { out.push(cur); cur = []; }
    cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** When resets happened (for chart markers): the old reset time when it lies between the two windows, else the new window's first point. */
export function resetMarkers(points: LimitsPoint[], w: LimitWindow): number[] {
  const wins = splitWindows(windowSeries(points, w), w);
  const out: number[] = [];
  for (let i = 1; i < wins.length; i++) {
    const prev = wins[i - 1][wins[i - 1].length - 1];
    const next = wins[i][0];
    const at = prev.resetsAt != null && prev.resetsAt > prev.ts && prev.resetsAt <= next.ts ? prev.resetsAt : next.ts;
    out.push(at);
  }
  return out;
}

/** Weighted least squares y = a + b·x. Null for fewer than two distinct x. */
export function linearFit(pts: { x: number; y: number; w: number }[]): { slope: number; intercept: number; r2: number } | null {
  let sw = 0, sx = 0, sy = 0;
  for (const p of pts) { sw += p.w; sx += p.w * p.x; sy += p.w * p.y; }
  if (pts.length < 2 || !(sw > 0)) return null;
  const mx = sx / sw, my = sy / sw;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) {
    const dx = p.x - mx, dy = p.y - my;
    sxx += p.w * dx * dx; sxy += p.w * dx * dy; syy += p.w * dy * dy;
  }
  if (!(sxx > 0)) return null;
  const slope = sxy / sxx;
  const r2 = syy > 0 ? Math.min(1, (sxy * sxy) / (sxx * syy)) : 1;
  return { slope, intercept: my - slope * mx, r2 };
}

/** Weighted tokens spent in [a, b), prorating partially covered buckets. */
export function tokensBetween(usage: UsageBucket[], a: number, b: number): number {
  if (!(b > a)) return 0;
  let sum = 0;
  for (const u of usage) {
    const len = u.end - u.start;
    if (len <= 0 || u.end <= a || u.start >= b) continue;
    sum += u.tokens * ((Math.min(b, u.end) - Math.max(a, u.start)) / len);
  }
  return sum;
}

export interface WindowInput {
  window: LimitWindow;
  now: number;
  /** The latest reading (from the capture file); null without a source. */
  current: { pct: number | null; resetsAt: number | null; ts: number } | null;
  /** Recorded history of this window type (any windows, any order). */
  history: WindowPoint[];
  /** Weighted transcript tokens over time (for the token proxy); optional. */
  usage?: UsageBucket[];
}

const none = (window: LimitWindow, pct: number | null, resetsAt: number | null, points = 0): WindowForecast => ({
  window, pct, resetsAt, ratePerHour: 0, hitsAt: null, pctAtReset: null, confidence: 'low', basis: 'none', points,
});

const LOWER: Record<ForecastConfidence, ForecastConfidence> = { high: 'medium', medium: 'low', low: 'low' };
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The forecast of one window. */
export function forecastWindow(inp: WindowInput): WindowForecast {
  const { window: w, now } = inp;
  const cfg = FORECAST_TUNING[w];
  const cur = inp.current;
  if (!cur || cur.pct == null || !Number.isFinite(cur.pct)) return none(w, null, null);
  // Clock skew: a reading "from the future" (file mtime ahead of this clock) counts as now.
  const curTs = Math.min(Number.isFinite(cur.ts) ? cur.ts : now, now);
  const pctNow = Math.max(0, cur.pct);
  const resetsAt = cur.resetsAt != null && Number.isFinite(cur.resetsAt) ? cur.resetsAt : null;
  // The window is over: the reading belongs to the previous window and the new one has not been seen yet.
  if (resetsAt != null && now >= resetsAt) return { ...none(w, 0, null), reset: true };

  // The current window's points: history plus the latest reading, split at resets.
  const series = inp.history.filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.pct)).map((p) => ({ ...p, ts: Math.min(p.ts, now) }));
  series.sort((a, b) => a.ts - b.ts);
  const last = series[series.length - 1];
  const latest: WindowPoint = { ts: curTs, pct: pctNow, resetsAt };
  if (!last || last.ts < curTs || last.pct !== pctNow || last.resetsAt !== resetsAt) {
    // Keep the series ordered when the reading is not newer than history (equal timestamps).
    if (last && last.ts >= curTs) latest.ts = last.ts;
    series.push(latest);
  }
  const wins = splitWindows(series, w);
  let seg = wins[wins.length - 1];
  // Points before the window could have started belong to an older window with the same reset (cannot happen
  // for well-formed data, but keeps a garbled history from leaking in).
  if (resetsAt != null) seg = seg.filter((p) => p.ts >= resetsAt - WINDOW_MS[w] - cfg.resetTolerance);
  if (!seg.length) seg = [latest];
  const n = seg.length;
  const anchor = seg[n - 1];
  const span = anchor.ts - seg[0].ts;

  // Already exhausted.
  if (anchor.pct >= 100) {
    const first = seg.find((p) => p.pct >= 100) ?? anchor;
    return { window: w, pct: anchor.pct, resetsAt, ratePerHour: 0, hitsAt: Math.min(first.ts, now), pctAtReset: 100, confidence: 'high', basis: 'limits', points: n, exhausted: true };
  }

  let rate = 0;
  let basis: ForecastBasis = 'none';
  let confidence: ForecastConfidence = 'low';
  const fit = linearFit(seg.map((p) => ({ x: (p.ts - anchor.ts) / H, y: p.pct, w: Math.pow(0.5, (anchor.ts - p.ts) / cfg.halfLife) })));
  const rise = anchor.pct - seg[0].pct;
  const limitsOk = !!fit && ((n >= 3 && span >= cfg.minSpan) || (n === 2 && span >= 3 * cfg.minSpan));
  if (limitsOk && fit) {
    basis = 'limits';
    rate = Math.max(0, fit.slope);
    confidence = n >= 6 && span >= cfg.goodSpan && (fit.r2 >= 0.5 || rise <= 2) ? 'high' : n >= 3 && span >= 1.5 * cfg.minSpan ? 'medium' : 'low';
  } else if (n >= 2) {
    // Thin history: calibrate transcript tokens against the % gained in this window.
    const spent = inp.usage ? tokensBetween(inp.usage, seg[0].ts, anchor.ts) : 0;
    const recentFrom = now - cfg.recent;
    const recent = inp.usage ? tokensBetween(inp.usage, recentFrom, now) : 0;
    if (rise > 0 && spent > 0) {
      basis = 'tokens';
      rate = (rise / spent) * (recent / (cfg.recent / H));
      confidence = rise >= 3 && span >= cfg.minSpan ? 'medium' : 'low';
    } else if (fit) {
      // Two close points without usable tokens: the trend itself, with low confidence.
      basis = 'limits';
      rate = Math.max(0, fit.slope);
      confidence = 'low';
    }
  }
  if (basis === 'none') return none(w, anchor.pct, resetsAt, n);
  if (!Number.isFinite(rate) || rate < 0) rate = 0;

  // Project from the latest reading, or from now when it is stale (the status line was silent: idle).
  let from = anchor.ts;
  if (now - anchor.ts > cfg.stale) {
    from = now;
    if (basis === 'limits') confidence = LOWER[confidence];
  }
  const at = (t: number) => Math.min(100, anchor.pct + (rate * Math.max(0, t - from)) / H);
  let hitsAt: number | null = null;
  if (rate > 1e-9) {
    hitsAt = Math.max(now, from + ((100 - anchor.pct) / rate) * H);
    const horizon = resetsAt ?? now + WINDOW_MS[w];
    if (hitsAt >= horizon) hitsAt = null;
  }
  return {
    window: w,
    pct: anchor.pct,
    resetsAt,
    ratePerHour: round2(rate),
    hitsAt: hitsAt == null ? null : Math.round(hitsAt),
    pctAtReset: resetsAt == null ? null : round2(at(resetsAt)),
    confidence,
    basis,
    points: n,
  };
}

export interface ForecastInput {
  now: number;
  limits: Limits | null;
  history: LimitsPoint[];
  usage?: UsageBucket[];
}

/** The forecast of both windows. Without a reading the source is 'none'. */
export function forecastLimits({ now, limits, history, usage }: ForecastInput): LimitsForecast {
  const has = !!limits && (limits.fiveHourPct != null || limits.sevenDayPct != null);
  const cur = (w: LimitWindow) => (has && limits ? {
    pct: w === '5h' ? limits.fiveHourPct : limits.sevenDayPct,
    resetsAt: w === '5h' ? limits.fiveHourResetsAt : limits.sevenDayResetsAt,
    ts: limits.updatedAt || now,
  } : null);
  // A plan without a 5-hour window: no forecast for it, whatever an older history says.
  const no5h = has && limits?.fiveHourWindow === 'none';
  return {
    source: has ? 'statusline' : 'none',
    now,
    updatedAt: has && limits ? limits.updatedAt : null,
    fiveHour: no5h ? { ...none('5h', null, null), noWindow: true } : forecastWindow({ window: '5h', now, current: cur('5h'), history: windowSeries(history, '5h'), usage }),
    sevenDay: forecastWindow({ window: '7d', now, current: cur('7d'), history: windowSeries(history, '7d'), usage }),
  };
}

/** How urgent a forecast looks: 'out' (exhausted or runs out within 30 min), 'warn' (runs out before the reset), 'ok'. */
export function forecastSeverity(f: WindowForecast, now: number): 'out' | 'warn' | 'ok' {
  if (f.exhausted) return 'out';
  if (f.hitsAt == null) return 'ok';
  return f.hitsAt - now <= 30 * MIN ? 'out' : 'warn';
}

/** The early-warning rule: the 5 h window runs out more than `margin` before its reset, with at least medium confidence. */
export const FORECAST_MARGIN_MS = 20 * MIN;
export function forecastWarns(f: WindowForecast | null | undefined, margin = FORECAST_MARGIN_MS): boolean {
  return !!f && !f.noWindow && !f.exhausted && f.hitsAt != null && f.resetsAt != null && f.resetsAt - f.hitsAt > margin && f.confidence !== 'low';
}
