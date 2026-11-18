// Plans without a 5-hour window (Ultra): detected from the status line, filled in from the plan table
// while there is no reading, overridden by data, and switched back when a 5-hour reading reappears.
import { describe, expect, it } from 'vitest';
import type { Plan } from '../../shared/api';
import { forecastLimits, forecastWarns } from '../../shared/forecast';
import { NotifyDetector } from '../../shared/notify';
import { dataFiveHour, fiveHourWindow, planWindows } from '../../shared/plan';
import { limitsFromStatusline } from '../live';

const H = 3_600_000;
const now = Date.parse('2026-11-18T12:00:00Z');
const sec = (ms: number) => Math.round(ms / 1000);
const ULTRA: Plan = { name: 'Ultra', tier: '20×', type: 'claude_max', since: '2026-03-19T11:48:14Z' };
const MAX: Plan = { name: 'Max', tier: '20×', type: 'claude_max', since: null };

/** Status-line inputs: only the weekly window (Ultra), both windows (Max). */
const weeklyOnly = { model: { display_name: 'Opus' }, rate_limits: { seven_day: { used_percentage: 38, resets_at: sec(now + 3 * 24 * H) } } };
const weeklyNull5h = { rate_limits: { five_hour: null, seven_day: { used_percentage: 38, resets_at: sec(now + 3 * 24 * H) } } };
const both = { rate_limits: { five_hour: { used_percentage: 92, resets_at: sec(now + 2 * H) }, seven_day: { used_percentage: 38, resets_at: sec(now + 3 * 24 * H) } } };

describe('5-hour window from the status line', () => {
  it('is "none" when only the 7-day window is reported (absent or null)', () => {
    for (const j of [weeklyOnly, weeklyNull5h]) {
      const l = limitsFromStatusline(j, now);
      expect(l.fiveHourWindow).toBe('none');
      expect(l.fiveHourPct).toBeNull();
      expect(l.sevenDayPct).toBe(38);
    }
  });

  it('is "present" with a 5-hour reading and "unknown" without any rate limits', () => {
    expect(limitsFromStatusline(both, now).fiveHourWindow).toBe('present');
    expect(limitsFromStatusline({ model: {} }, now).fiveHourWindow).toBe('unknown');
    expect(limitsFromStatusline(null, now).fiveHourWindow).toBe('unknown');
  });

  it('gives the 5 h forecast no basis and the noWindow flag, and never warns', () => {
    const f = forecastLimits({ now, limits: limitsFromStatusline(weeklyOnly, now), history: [] });
    expect(f.source).toBe('statusline');
    expect(f.fiveHour).toMatchObject({ basis: 'none', pct: null, hitsAt: null, noWindow: true });
    expect(f.sevenDay.pct).toBe(38);
    expect(forecastWarns(f.fiveHour)).toBe(false);
    // An older 5 h history does not resurrect a forecast.
    const hist = [{ ts: now - 2 * H, fiveHourPct: 10, sevenDayPct: 30, fiveHourResetsAt: now + 2 * H, sevenDayResetsAt: null }];
    expect(forecastLimits({ now, limits: limitsFromStatusline(weeklyOnly, now), history: hist }).fiveHour.basis).toBe('none');
  });

  it('sends no 5 h notifications while the window is absent, and resumes once it is back', () => {
    const d = new NotifyDetector();
    const ev = (t: number, j: unknown) => {
      const limits = limitsFromStatusline(j, t);
      return d.onSnapshot({ now: t, sessions: [], limits, limitsForecast: forecastLimits({ now: t, limits, history: [] }) }).events;
    };
    expect(ev(now, weeklyOnly)).toEqual([]); // baseline
    expect(ev(now + 1000, weeklyOnly)).toEqual([]);
    expect(ev(now + 2000, both).map((e) => `${e.type}:${e.window}`)).toEqual(['limit_high:5h']);
  });
});

describe('5-hour window: plan table and override', () => {
  it('knows Ultra has only the weekly window; other plans are unknown', () => {
    expect(planWindows(ULTRA)).toEqual({ fiveHour: 'none', sevenDay: 'present' });
    expect(planWindows(MAX)).toEqual({ fiveHour: 'unknown', sevenDay: 'unknown' });
    expect(planWindows(null).fiveHour).toBe('unknown');
  });

  it('falls back to the plan without a reading', () => {
    expect(fiveHourWindow(dataFiveHour(null), ULTRA)).toEqual({ state: 'none', from: 'plan' });
    expect(fiveHourWindow(dataFiveHour(null), MAX)).toEqual({ state: 'unknown', from: null });
    // A capture without rate limits says nothing: the plan still decides.
    expect(fiveHourWindow(dataFiveHour(limitsFromStatusline({}, now)), ULTRA)).toEqual({ state: 'none', from: 'plan' });
  });

  it('lets the status line override the table, both ways', () => {
    expect(fiveHourWindow(dataFiveHour(limitsFromStatusline(both, now)), ULTRA)).toEqual({ state: 'present', from: 'data' });
    expect(fiveHourWindow(dataFiveHour(limitsFromStatusline(weeklyOnly, now)), MAX)).toEqual({ state: 'none', from: 'data' });
  });

  it('switches back automatically when a 5-hour reading reappears', () => {
    const seq = [weeklyOnly, weeklyOnly, both, weeklyNull5h].map((j) => fiveHourWindow(dataFiveHour(limitsFromStatusline(j, now)), ULTRA).state);
    expect(seq).toEqual(['none', 'none', 'present', 'none']);
  });

  it('reads servers older than 0.3 (no fiveHourWindow) from the percentage', () => {
    const old = { fiveHourPct: 40, fiveHourResetsAt: null, sevenDayPct: 10, sevenDayResetsAt: null, updatedAt: now };
    expect(dataFiveHour(old)).toBe('present');
    expect(dataFiveHour({ ...old, fiveHourPct: null })).toBe('unknown');
  });
});
