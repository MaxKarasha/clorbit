// Subscription-limit forecast: regression, resets, thin data, token proxy, edge cases.
import { describe, expect, it } from 'vitest';
import type { Limits, LimitsPoint } from '../api';
import {
  forecastLimits, forecastSeverity, forecastWarns, forecastWindow, linearFit, resetMarkers, splitWindows, tokensBetween, weightTokens,
  windowSeries, type UsageBucket, type WindowPoint,
} from '../forecast';

const H = 3_600_000;
const MIN = 60_000;
const NOW = Date.UTC(2026, 10, 18, 12, 0);

/** A 5 h window that started `ago` ms before NOW, sampled every `step` ms at `rate` %/h from `start` %. */
function ramp(ago: number, step: number, rate: number, start = 0, resetsAt = NOW - ago + 5 * H): WindowPoint[] {
  const out: WindowPoint[] = [];
  for (let t = NOW - ago; t <= NOW; t += step) out.push({ ts: t, pct: start + (rate * (t - (NOW - ago))) / H, resetsAt });
  return out;
}
const cur = (p: WindowPoint) => ({ pct: p.pct, resetsAt: p.resetsAt, ts: p.ts });

describe('linearFit', () => {
  it('recovers a line and handles degenerate input', () => {
    const f = linearFit([{ x: 0, y: 1, w: 1 }, { x: 1, y: 3, w: 1 }, { x: 2, y: 5, w: 1 }])!;
    expect(f.slope).toBeCloseTo(2);
    expect(f.intercept).toBeCloseTo(1);
    expect(f.r2).toBeCloseTo(1);
    expect(linearFit([{ x: 1, y: 1, w: 1 }])).toBeNull();
    expect(linearFit([{ x: 1, y: 1, w: 1 }, { x: 1, y: 2, w: 1 }])).toBeNull();
  });
});

describe('windows and resets', () => {
  const rows: LimitsPoint[] = [
    { ts: 1 * H, fiveHourPct: 10, sevenDayPct: 5, fiveHourResetsAt: 5 * H, sevenDayResetsAt: 100 * H },
    { ts: 2 * H, fiveHourPct: 40, sevenDayPct: 8, fiveHourResetsAt: 5 * H + 20_000, sevenDayResetsAt: 100 * H },
    { ts: 6 * H, fiveHourPct: 3, sevenDayPct: 9, fiveHourResetsAt: 11 * H, sevenDayResetsAt: 100 * H },
    { ts: 7 * H, fiveHourPct: 20, sevenDayPct: 11, fiveHourResetsAt: 11 * H, sevenDayResetsAt: 100 * H },
    { ts: 8 * H, fiveHourPct: 25, sevenDayPct: null },
  ];
  it('splits at a moved reset time but not at jitter', () => {
    const w = splitWindows(windowSeries(rows, '5h'), '5h');
    expect(w.map((x) => x.map((p) => p.pct))).toEqual([[10, 40], [3, 20, 25]]);
    expect(splitWindows(windowSeries(rows, '7d'), '7d')).toHaveLength(1);
  });
  it('a drop in % alone marks a new window (old rows without reset times)', () => {
    const s: WindowPoint[] = [{ ts: 1, pct: 50, resetsAt: null }, { ts: 2, pct: 60, resetsAt: null }, { ts: 3, pct: 2, resetsAt: null }];
    expect(splitWindows(s, '5h')).toHaveLength(2);
  });
  it('reset markers sit at the old reset time', () => {
    expect(resetMarkers(rows, '5h')).toEqual([5 * H + 20_000]);
    expect(resetMarkers(rows, '7d')).toEqual([]);
  });
});

describe('forecastWindow — limits basis', () => {
  it('a steady burn: rate, time to 100% and % at reset', () => {
    // 20 %/h for 2 h → 40% now; resets in 3 h → would reach 100% in 3 h → exactly at the reset: lasts.
    const h = ramp(2 * H, 10 * MIN, 20);
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(h[h.length - 1]), history: h });
    expect(f.basis).toBe('limits');
    expect(f.ratePerHour).toBeCloseTo(20, 1);
    expect(f.pct).toBeCloseTo(40);
    expect(f.confidence).toBe('high');
    expect(f.hitsAt).toBeNull();
    expect(f.pctAtReset).toBe(100);
  });

  it('runs out before the reset', () => {
    const h = ramp(2 * H, 10 * MIN, 30); // 60% now, 30 %/h → 100% in 80 min; reset in 3 h
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(h[h.length - 1]), history: h });
    expect(f.hitsAt! - NOW).toBeGreaterThan(75 * MIN);
    expect(f.hitsAt! - NOW).toBeLessThan(85 * MIN);
    expect(f.pctAtReset).toBe(100);
    expect(forecastSeverity(f, NOW)).toBe('warn');
    expect(forecastWarns(f)).toBe(true);
  });

  it('recent points weigh more than old ones', () => {
    // 2 %/h for 2 h, then 40 %/h for the last 40 min.
    const slow = ramp(2 * H + 40 * MIN, 10 * MIN, 2).filter((p) => p.ts <= NOW - 40 * MIN);
    const base = slow[slow.length - 1].pct;
    const fast = ramp(40 * MIN, 10 * MIN, 40, base, slow[0].resetsAt!).slice(1);
    const h = [...slow, ...fast];
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(h[h.length - 1]), history: h });
    expect(f.ratePerHour).toBeGreaterThan(15);
  });

  it('ignores the previous window', () => {
    const old = ramp(7 * H, 10 * MIN, 25, 0, NOW - 2 * H).filter((p) => p.ts < NOW - 2 * H);
    const now = ramp(H, 10 * MIN, 6, 0, NOW + 4 * H);
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(now[now.length - 1]), history: [...old, ...now] });
    expect(f.points).toBe(now.length);
    expect(f.ratePerHour).toBeCloseTo(6, 1);
    expect(f.hitsAt).toBeNull();
    expect(f.pctAtReset).toBeCloseTo(30, 0);
  });

  it('zero rate: lasts until the reset at the current %', () => {
    const h = ramp(H, 10 * MIN, 0, 42);
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(h[h.length - 1]), history: h });
    expect(f.ratePerHour).toBe(0);
    expect(f.hitsAt).toBeNull();
    expect(f.pctAtReset).toBe(42);
    expect(forecastSeverity(f, NOW)).toBe('ok');
    expect(forecastWarns(f)).toBe(false);
  });

  it('a stale reading is projected from now with lower confidence', () => {
    const h = ramp(2 * H, 10 * MIN, 10).map((p) => ({ ...p, ts: p.ts - H })); // last reading 1 h ago, resets in 3 h
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(h[h.length - 1]), history: h });
    expect(f.confidence).toBe('medium');
    // 20% an hour ago; projected from now (idle since): 20 + 3 h × 10 = 50%, not 60%.
    expect(f.hitsAt).toBeNull();
    expect(f.pctAtReset).toBeCloseTo(50, 0);
  });
});

describe('forecastWindow — thin history and the token proxy', () => {
  const usage = (perMin: number, from = NOW - 3 * H): UsageBucket[] => {
    const out: UsageBucket[] = [];
    for (let t = from; t < NOW; t += MIN) out.push({ start: t, end: t + MIN, tokens: perMin });
    return out;
  };
  const two: WindowPoint[] = [
    { ts: NOW - 6 * MIN, pct: 10, resetsAt: NOW + 4 * H },
    { ts: NOW - MIN, pct: 15, resetsAt: NOW + 4 * H },
  ];

  it('one point: no forecast', () => {
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(two[1]), history: [two[1]], usage: usage(1000) });
    expect(f.basis).toBe('none');
    expect(f.hitsAt).toBeNull();
    expect(f.pctAtReset).toBeNull();
    expect(f.pct).toBe(15);
  });

  it('two close points: calibrated by tokens', () => {
    const u = [...usage(1000, NOW - 3 * H).filter((b) => b.start < NOW - 30 * MIN), ...usage(2000, NOW - 30 * MIN)];
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(two[1]), history: two, usage: u });
    expect(f.basis).toBe('tokens');
    // The 5 calibration minutes ran at 2000/min: 5% / 10 000 tokens × 120 000 tokens/h (the last 30 min) = 60 %/h.
    expect(f.ratePerHour).toBeCloseTo(60, 0);
    expect(f.hitsAt! - NOW).toBeGreaterThan(80 * MIN);
    expect(f.hitsAt! - NOW).toBeLessThan(90 * MIN);
    // Five minutes of calibration is too short to trust.
    expect(f.confidence).toBe('low');
  });

  it('two points 12 min apart: medium confidence', () => {
    const pts: WindowPoint[] = [{ ts: NOW - 13 * MIN, pct: 10, resetsAt: NOW + 4 * H }, { ts: NOW - MIN, pct: 15, resetsAt: NOW + 4 * H }];
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(pts[1]), history: pts, usage: usage(2000) });
    expect(f.basis).toBe('tokens');
    expect(f.ratePerHour).toBeCloseTo(25, 0); // 5% / 24 000 tokens × 120 000/h
    expect(f.confidence).toBe('medium');
    expect(f.hitsAt! - NOW).toBeGreaterThan(200 * MIN);
    expect(f.hitsAt! - NOW).toBeLessThan(210 * MIN);
  });

  it('two close points, idle now: lasts until reset', () => {
    const u = usage(1000, NOW - 3 * H).filter((b) => b.start < NOW - 40 * MIN);
    const old = two.map((p) => ({ ...p, ts: p.ts - 40 * MIN }));
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(old[1]), history: old, usage: u });
    expect(f.basis).toBe('tokens');
    expect(f.ratePerHour).toBe(0);
    expect(f.hitsAt).toBeNull();
  });

  it('two close points without tokens: the trend itself, low confidence', () => {
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(two[1]), history: two });
    expect(f.basis).toBe('limits');
    expect(f.confidence).toBe('low');
    expect(forecastWarns(f)).toBe(false);
  });
});

describe('forecastWindow — edge cases', () => {
  it('no reading: nothing', () => {
    expect(forecastWindow({ window: '7d', now: NOW, current: null, history: [] })).toMatchObject({ pct: null, basis: 'none', hitsAt: null });
    expect(forecastWindow({ window: '7d', now: NOW, current: { pct: null, resetsAt: null, ts: NOW }, history: [] }).basis).toBe('none');
  });

  it('already at 100%', () => {
    const h = ramp(2 * H, 10 * MIN, 60).map((p) => ({ ...p, pct: Math.min(100, p.pct) }));
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(h[h.length - 1]), history: h });
    expect(f.exhausted).toBe(true);
    expect(f.pctAtReset).toBe(100);
    expect(f.hitsAt).toBeLessThanOrEqual(NOW);
    expect(forecastSeverity(f, NOW)).toBe('out');
    expect(forecastWarns(f)).toBe(false);
  });

  it('the reset time has passed', () => {
    const h = ramp(5 * H, 10 * MIN, 15, 0, NOW - MIN);
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(h[h.length - 1]), history: h });
    expect(f).toMatchObject({ reset: true, pct: 0, resetsAt: null, hitsAt: null, basis: 'none' });
  });

  it('clock skew: readings from the future count as now', () => {
    const h = ramp(2 * H, 10 * MIN, 30).map((p) => ({ ...p, ts: p.ts + 5 * MIN }));
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(h[h.length - 1]), history: h });
    expect(Number.isFinite(f.ratePerHour)).toBe(true);
    expect(f.hitsAt!).toBeGreaterThanOrEqual(NOW);
  });

  it('a falling trend never gives a negative rate', () => {
    const h: WindowPoint[] = [
      { ts: NOW - 40 * MIN, pct: 30, resetsAt: NOW + H },
      { ts: NOW - 20 * MIN, pct: 30.2, resetsAt: NOW + H },
      { ts: NOW, pct: 30, resetsAt: NOW + H },
    ];
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(h[2]), history: h });
    expect(f.ratePerHour).toBeGreaterThanOrEqual(0);
    expect(f.hitsAt).toBeNull();
  });

  it('unknown reset time: no % at reset, hits only within one window length', () => {
    const h = ramp(H, 10 * MIN, 30).map((p) => ({ ...p, resetsAt: null }));
    const f = forecastWindow({ window: '5h', now: NOW, current: cur(h[h.length - 1]), history: h });
    expect(f.pctAtReset).toBeNull();
    expect(f.hitsAt).not.toBeNull();
  });
});

describe('forecastLimits', () => {
  it('no source', () => {
    const f = forecastLimits({ now: NOW, limits: null, history: [] });
    expect(f.source).toBe('none');
    expect(f.updatedAt).toBeNull();
    expect(f.fiveHour.basis).toBe('none');
    expect(f.sevenDay.basis).toBe('none');
  });

  it('both windows from history rows plus the latest reading', () => {
    const rows: LimitsPoint[] = [];
    for (let i = 0; i <= 12; i++) {
      rows.push({ ts: NOW - 2 * H + i * 10 * MIN, fiveHourPct: i * 4, sevenDayPct: 40 + i * 0.1, fiveHourResetsAt: NOW + 3 * H, sevenDayResetsAt: NOW + 3 * 24 * H });
    }
    const limits: Limits = { fiveHourPct: 48, fiveHourResetsAt: NOW + 3 * H, sevenDayPct: 41.2, sevenDayResetsAt: NOW + 3 * 24 * H, updatedAt: NOW };
    const f = forecastLimits({ now: NOW, limits, history: rows });
    expect(f.source).toBe('statusline');
    expect(f.fiveHour.ratePerHour).toBeCloseTo(24, 0);
    expect(f.fiveHour.hitsAt).not.toBeNull();
    expect(f.sevenDay.basis).toBe('limits');
    expect(f.sevenDay.hitsAt).toBeNull();
  });
});

describe('helpers', () => {
  it('tokensBetween prorates partial buckets', () => {
    const u: UsageBucket[] = [{ start: 0, end: 100, tokens: 100 }, { start: 100, end: 200, tokens: 50 }];
    expect(tokensBetween(u, 50, 150)).toBeCloseTo(75);
    expect(tokensBetween(u, 150, 50)).toBe(0);
  });
  it('weightTokens favours output over cache reads', () => {
    expect(weightTokens({ input: 0, output: 1, cacheRead: 0, cacheWrite: 0 })).toBeGreaterThan(weightTokens({ input: 0, output: 0, cacheRead: 10, cacheWrite: 0 }));
  });
});
