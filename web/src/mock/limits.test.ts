// Demo limits: believable history and a forecast that shows the feature.
import { describe, expect, it } from 'vitest';
import { forecastWarns, resetMarkers } from '@shared/forecast';
import { mockLimits, mockLimitsHistory } from './limits';

describe('demo limits', () => {
  const now = new Date(2026, 10, 18, 15, 7).getTime();
  const m = mockLimits(now);

  it('history is ordered, within 0..100, with resets', () => {
    for (let i = 1; i < m.points.length; i++) expect(m.points[i].ts).toBeGreaterThan(m.points[i - 1].ts);
    for (const p of m.points) {
      expect(p.fiveHourPct).toBeGreaterThanOrEqual(0);
      expect(p.fiveHourPct).toBeLessThanOrEqual(100);
      expect(p.sevenDayPct).toBeLessThanOrEqual(100);
    }
    expect(resetMarkers(m.points, '5h').length).toBeGreaterThan(10);
    expect(resetMarkers(m.points, '7d').length).toBeGreaterThanOrEqual(3);
    expect(mockLimitsHistory(now - 86_400_000, now, now).length).toBeGreaterThan(5);
  });

  it('the 5 h window runs out before its reset; the 7 d one lasts', () => {
    const f = m.forecast;
    expect(f.source).toBe('statusline');
    expect(f.fiveHour.basis).toBe('limits');
    expect(forecastWarns(f.fiveHour)).toBe(true);
    expect(f.fiveHour.pct).toBeGreaterThan(45);
    expect(f.sevenDay.hitsAt).toBeNull();
    expect(f.sevenDay.pctAtReset!).toBeGreaterThan(f.sevenDay.pct!);
    expect(m.limits.sevenDayPct).toBeGreaterThan(30);
    expect(m.limits.sevenDayPct).toBeLessThan(60);
  });
});
