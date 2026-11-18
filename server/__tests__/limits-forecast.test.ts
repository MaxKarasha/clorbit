// The server side of the limits forecast: usage buckets from summaries, the forecaster and its API shape.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Limits, LimitsForecast } from '../../shared/api';
import { ClorbitDb } from '../db';
import { LimitsForecaster, usageBuckets } from '../limits-forecast';
import { LimitsLog } from '../limits-log';
import { scanText } from '../scanner';

const H = 3_600_000;
const MIN = 60_000;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-forecast-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const rec = (ts: number, req: string, out = 100) => JSON.stringify({
  type: 'assistant', isSidechain: false, requestId: req, timestamp: new Date(ts).toISOString(),
  message: { model: 'claude-opus-5-5', content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: out, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 } },
});

describe('usageBuckets', () => {
  it('hourly buckets before the last hour, minute buckets inside it, weighted, no overlap', () => {
    const now = new Date(2026, 10, 18, 12, 30).getTime();
    const lines = [rec(now - 3 * H, 'a'), rec(now - 2 * H, 'b'), rec(now - 10 * MIN, 'c'), rec(now - 5 * MIN, 'd')];
    const s = scanText('/m', { sessionId: 's', agentId: null, projectDir: 'p' }, lines.join('\n'), { knownPlugins: [] });
    const u = usageBuckets([s], now - 8 * H, now);
    // Each record weighs 10 + 100 × 5 + 1000 × 0.1 = 610.
    const total = u.reduce((a, b) => a + b.tokens, 0);
    expect(total).toBeCloseTo(4 * 610, 0);
    for (let i = 1; i < u.length; i++) expect(u[i].start).toBeGreaterThanOrEqual(u[i - 1].end);
    expect(u.filter((b) => b.end - b.start === MIN)).toHaveLength(2);
  });
});

describe('LimitsForecaster', () => {
  it('no reading: source none, both windows without a forecast', () => {
    const f = new LimitsForecaster(() => [], () => []).get(null, 1e12);
    expect(f).toEqual({
      source: 'none', now: 1e12, updatedAt: null,
      fiveHour: { window: '5h', pct: null, resetsAt: null, ratePerHour: 0, hitsAt: null, pctAtReset: null, confidence: 'low', basis: 'none', points: 0 },
      sevenDay: { window: '7d', pct: null, resetsAt: null, ratePerHour: 0, hitsAt: null, pctAtReset: null, confidence: 'low', basis: 'none', points: 0 },
    } satisfies LimitsForecast);
  });

  it('history from SQLite + the latest reading; cached until the reading changes', () => {
    const db = ClorbitDb.open(path.join(tmp, 'f.db'));
    const now = Date.now();
    const reset5 = now + 2 * H;
    const reset7 = now + 3 * 24 * H;
    const log = new LimitsLog(db, () => null);
    for (let i = 0; i <= 9; i++) {
      log.record({ fiveHourPct: 20 + i * 4, fiveHourResetsAt: reset5, sevenDayPct: 50 + i * 0.02, sevenDayResetsAt: reset7, updatedAt: now - 90 * MIN + i * 10 * MIN });
    }
    let calls = 0;
    const fc = new LimitsForecaster((a, b) => { calls++; return log.history(a, b); }, () => []);
    const lim: Limits = { fiveHourPct: 56, fiveHourResetsAt: reset5, sevenDayPct: 50.2, sevenDayResetsAt: reset7, updatedAt: now };
    const f = fc.get(lim, now);
    expect(f.source).toBe('statusline');
    expect(Object.keys(f.fiveHour).sort()).toEqual(['basis', 'confidence', 'hitsAt', 'pct', 'pctAtReset', 'points', 'ratePerHour', 'resetsAt', 'window']);
    expect(f.fiveHour).toMatchObject({ basis: 'limits', confidence: 'high', pct: 56 });
    expect(f.fiveHour.ratePerHour).toBeCloseTo(24, 0);
    expect(f.fiveHour.hitsAt).not.toBeNull(); // 44% left at 24 %/h ≈ 1 h 50 min < 2 h
    expect(f.sevenDay.hitsAt).toBeNull();
    fc.get(lim, now + 1000);
    expect(calls).toBe(1);
    fc.get({ ...lim, fiveHourPct: 57 }, now + 2000);
    expect(calls).toBe(2);
    db.close();
  });
});
