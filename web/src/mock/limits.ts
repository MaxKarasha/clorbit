// Demo subscription limits: a believable 4-week history of the 5-hour and 7-day windows (work
// days, lunch breaks, quiet weekends) ending in a busy current 5 h window that is on course to run
// out about an hour before its reset, and a 7-day window that lasts. The forecast is computed by
// the real model (shared/forecast.ts), so the demo shows exactly what a user would see.
import type { AboutInfo, Limits, LimitsForecast, LimitsPoint, Plan } from '@shared/api';
import { forecastLimits } from '@shared/forecast';
import { rng } from './rng';

const MIN = 60_000;
const H = 60 * MIN;
const DAY = 24 * H;
const STEP = 10 * MIN;
const HISTORY = 28 * DAY;

/** The demo subscription plan. */
export const MOCK_PLAN: Plan = { name: 'Max', tier: '20×', type: 'claude_max', since: '2026-02-03T09:00:00Z' };

/** GET /api/about in demo mode (the Overview's limits panel reads the plan from it). */
export function mockAbout(now = Date.now()): AboutInfo {
  return {
    version: 'demo',
    dataDir: '~/.clorbit',
    hooks: { pluginEnabled: true, eventsReceived: true, lastEventAt: now - 4_000 },
    limits: { capture: true, updatedAt: mockLimits(now).limits.updatedAt },
    store: { enabled: true, fileSummaries: 1430, archived: 212, hookEvents: 18_400, limits: 2_016 },
    system: { available: false, tool: null, platform: 'demo' },
    plan: MOCK_PLAN,
  };
}

export interface MockLimits { points: LimitsPoint[]; limits: Limits; forecast: LimitsForecast }

let cache: { key: number; v: MockLimits } | null = null;

/** The demo limits as of `now` (recomputed once a minute). */
export function mockLimits(now = Date.now()): MockLimits {
  const key = Math.floor(now / MIN);
  if (cache && cache.key === key) return cache.v;
  const v = build(key * MIN);
  cache = { key, v };
  return v;
}

/** History rows in [from, to] (epoch ms). */
export function mockLimitsHistory(from: number, to: number, now = Date.now()): LimitsPoint[] {
  return mockLimits(now).points.filter((p) => p.ts >= from && p.ts <= to);
}

interface Raw { t: number; five: number; reset5: number; d: number }

function build(now: number): MockLimits {
  // The current 5 h window started 2.6 h ago (resets in 2.4 h); the weekly one resets in ~3.2 days.
  const curStart = now - 2.6 * H;
  const reset5 = curStart + 5 * H;
  const reset7 = Math.ceil((now + 3.2 * DAY) / H) * H;
  const prevStart = curStart - 5 * H;
  const start = Math.floor((now - HISTORY) / STEP) * STEP;

  // 1) Usage in "5 h %" units, step by step. Generic days first; no generic window may still be
  //    open when the scripted morning window starts.
  const raw: Raw[] = [];
  let win: { reset: number; pct: number } | null = null;
  for (let t = start; t < prevStart; t += STEP) {
    const d = new Date(t);
    const day = rng(`lim-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const h = d.getHours() + d.getMinutes() / 60;
    const startH = 8.5 + day.range(0, 1.5);
    const endH = weekend ? startH + day.range(0, 2.5) : 17.5 + day.range(0, 2.5);
    const intensity = (weekend ? 0.8 : 1.8) + day.range(0, weekend ? 1.2 : 2.6);
    if (win && t >= win.reset) win = null;
    const active = h >= startH && h < endH && !(h >= 13 && h < 14) && (!weekend || day.next() < 0.6);
    if (!active) continue;
    if (!win) {
      if (t + 5 * H > prevStart) continue;
      win = { reset: t + 5 * H, pct: 0 };
    }
    const step = rng(t).range(0.3, 1.7) * intensity;
    const dd = Math.min(100 - win.pct, step);
    win.pct += dd;
    raw.push({ t, five: win.pct, reset5: win.reset, d: dd });
  }
  // The scripted morning window (~45%), then the current one: 8 %/h for an hour, then 30 %/h.
  const script = (from: number, to: number, reset: number, rate: (t: number) => number) => {
    let pct = 0;
    for (let t = from; t <= to; t += STEP) {
      const dd = Math.min(100 - pct, (rate(t) * STEP) / H);
      pct += dd;
      raw.push({ t, five: pct, reset5: reset, d: dd });
    }
  };
  script(prevStart, curStart - 30 * MIN, curStart, () => 10);
  script(curStart, now, reset5, (t) => (t < curStart + H ? 8 : 30));

  // 2) The weekly window: a share of each 5 h % (scaled so the current week sits near 41%).
  const weekStart = (t: number) => reset7 - Math.ceil((reset7 - t) / (7 * DAY)) * 7 * DAY;
  const thisWeek = raw.filter((r) => r.t >= reset7 - 7 * DAY).reduce((a, r) => a + r.d, 0);
  const factor = Math.min(0.14, Math.max(0.03, 41 / Math.max(1, thisWeek)));

  // 3) Rows on change, like the server records them.
  const points: LimitsPoint[] = [];
  let week = 0;
  let wk = -Infinity;
  let last: LimitsPoint | null = null;
  for (const r of raw) {
    const ws = weekStart(r.t + 1);
    if (ws !== wk) { wk = ws; week = 0; }
    week += r.d * factor;
    const p: LimitsPoint = {
      ts: r.t + (r.t % 7) * 1000,
      fiveHourPct: Math.round(r.five),
      sevenDayPct: Math.round(Math.min(100, week)),
      fiveHourResetsAt: r.reset5,
      sevenDayResetsAt: ws + 7 * DAY,
    };
    if (last && last.fiveHourPct === p.fiveHourPct && last.sevenDayPct === p.sevenDayPct && last.fiveHourResetsAt === p.fiveHourResetsAt) continue;
    points.push(p);
    last = p;
  }
  const end = points[points.length - 1];
  const limits: Limits = {
    fiveHourPct: end.fiveHourPct,
    fiveHourResetsAt: reset5,
    sevenDayPct: end.sevenDayPct,
    sevenDayResetsAt: reset7,
    updatedAt: now - 20_000,
    fiveHourWindow: 'present',
  };
  return { points, limits, forecast: forecastLimits({ now, limits, history: points }) };
}
