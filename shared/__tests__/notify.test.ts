// Transition detection and deduplication of notification events.
import { describe, expect, it } from 'vitest';
import type { AgentNode, ForecastConfidence, Limits, LimitsForecast, SessionStatus, WindowForecast } from '../api';
import { NotifyDetector, waitKind, type DetectSession, type DetectSnapshot } from '../notify';

const root = (children: AgentNode[] = []): AgentNode => ({
  id: 'main', type: 'main', description: null, depth: 0, status: 'working', model: null, effort: null, currentTool: null, lastText: null,
  startedAt: 0, lastActivity: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, toolCalls: 0, finishedChildren: 0, children,
});
const sess = (id: string, status: SessionStatus, extra: Partial<DetectSession> = {}): DetectSession => ({
  sessionId: id, alive: true, status, project: `proj-${id}`, contextTokens: null, contextLimit: null, ...extra,
});
const snap = (now: number, sessions: DetectSession[], limits: Limits | null = null): DetectSnapshot => ({ now, sessions, limits });
const types = (r: { events: { type: string }[] }) => r.events.map((e) => e.type);

describe('NotifyDetector', () => {
  it('the first snapshot is a baseline: nothing fires for what is already going on', () => {
    const d = new NotifyDetector();
    expect(d.onEvent({ kind: 'compact', ts: 1, sessionId: 'a' }).events).toEqual([]);
    const r = d.onSnapshot(snap(1000, [sess('a', 'waiting'), sess('b', 'idle', { contextTokens: 190_000, contextLimit: 200_000 })]));
    expect(r.events).toEqual([]);
    // Still waiting, still full: no notification on the next snapshot either.
    expect(d.onSnapshot(snap(2000, [sess('a', 'waiting'), sess('b', 'idle', { contextTokens: 190_000, contextLimit: 200_000 })])).events).toEqual([]);
  });

  it('notifies once per wait and re-arms when the session leaves waiting', () => {
    const d = new NotifyDetector();
    d.onSnapshot(snap(1000, [sess('a', 'working')]));
    const r1 = d.onSnapshot(snap(2000, [sess('a', 'waiting', { statusCode: 'waitingPermission', statusArg: 'Bash' })]));
    expect(r1.events).toEqual([{ type: 'session_waiting', ts: 2000, sessionId: 'a', project: 'proj-a', wait: 'permission', tool: 'Bash' }]);
    // The same wait reported again by an SSE event and later snapshots: no duplicates.
    expect(d.onEvent({ kind: 'status', ts: 2500, sessionId: 'a', status: 'waiting', reason: 'x', code: 'waitingPermission', arg: 'Bash' }).events).toEqual([]);
    expect(d.onSnapshot(snap(3000, [sess('a', 'waiting')])).events).toEqual([]);
    const r2 = d.onSnapshot(snap(4000, [sess('a', 'working')]));
    expect(r2.events).toEqual([]);
    expect(r2.resolved).toEqual(['a']);
    expect(types(d.onSnapshot(snap(5000, [sess('a', 'waiting')])))).toEqual(['session_waiting']);
  });

  it('working → idle is "answer ready"; idle → idle and waiting → idle are not', () => {
    const d = new NotifyDetector();
    d.onSnapshot(snap(1000, [sess('a', 'working'), sess('b', 'waiting')]));
    const r = d.onSnapshot(snap(2000, [sess('a', 'idle'), sess('b', 'idle')]));
    expect(types(r)).toEqual(['session_done']);
    expect(r.events[0].sessionId).toBe('a');
    expect(r.resolved).toEqual(['b']);
  });

  it('ignores sessions without a live process', () => {
    const d = new NotifyDetector();
    d.onSnapshot(snap(1000, [sess('a', 'working', { alive: false })]));
    expect(d.onSnapshot(snap(2000, [sess('a', 'waiting', { alive: false })])).events).toEqual([]);
    expect(d.onEvent({ kind: 'compact', ts: 2100, sessionId: 'a' }).events).toEqual([]);
    expect(d.onEvent({ kind: 'compact', ts: 2100, sessionId: 'unknown' }).events).toEqual([]);
  });

  it('a stale snapshot does not undo a newer status event', () => {
    const d = new NotifyDetector();
    d.onSnapshot(snap(1000, [sess('a', 'working')]));
    expect(types(d.onEvent({ kind: 'status', ts: 3000, sessionId: 'a', status: 'waiting', reason: null, code: 'waitingInput' }))).toEqual(['session_waiting']);
    // Computed before the event: says "working". Must not re-arm the wait.
    const stale = d.onSnapshot(snap(2900, [sess('a', 'working')]));
    expect(stale.resolved).toEqual([]);
    expect(d.onSnapshot(snap(3100, [sess('a', 'waiting')])).events).toEqual([]);
  });

  it('a session that appears waiting after the baseline notifies', () => {
    const d = new NotifyDetector();
    d.onSnapshot(snap(1000, []));
    const r = d.onSnapshot(snap(2000, [sess('n', 'waiting', { statusCode: 'waitingInput' })]));
    expect(r.events).toMatchObject([{ type: 'session_waiting', wait: 'input' }]);
  });

  it('spawn, finish and compaction are deduplicated (hooks and transcripts report the same thing)', () => {
    const d = new NotifyDetector();
    d.onSnapshot(snap(1000, [sess('a', 'working', { root: root([{ ...root(), id: 'x1', type: 'Explore', depth: 1 }]) })]));
    expect(d.onEvent({ kind: 'finish', ts: 1100, sessionId: 'a', agentId: 'x1', parentId: 'main', tokens: 0 }).events)
      .toEqual([{ type: 'subagent_finished', ts: 1100, sessionId: 'a', project: 'proj-a', agentType: 'Explore' }]);
    expect(d.onEvent({ kind: 'finish', ts: 1200, sessionId: 'a', agentId: 'x1', parentId: 'main', tokens: 5 }).events).toEqual([]);
    const sp = { kind: 'spawn', ts: 1300, sessionId: 'a', parentId: 'main', agentId: 'x2', agentType: 'Plan', description: null } as const;
    expect(d.onEvent(sp).events).toMatchObject([{ type: 'subagent_spawned', agentType: 'Plan' }]);
    expect(d.onEvent({ ...sp, ts: 1400 }).events).toEqual([]);
    expect(types(d.onEvent({ kind: 'compact', ts: 10_000, sessionId: 'a' }))).toEqual(['compaction']);
    expect(types(d.onEvent({ kind: 'compact', ts: 12_000, sessionId: 'a' }))).toEqual([]);
    expect(types(d.onEvent({ kind: 'compact', ts: 500_000, sessionId: 'a' }))).toEqual(['compaction']);
  });

  it('context fill crossing 85% fires once until it drops below 75%', () => {
    const d = new NotifyDetector();
    const at = (now: number, used: number) => d.onSnapshot(snap(now, [sess('a', 'working', { contextTokens: used, contextLimit: 100_000 })]));
    at(1000, 50_000);
    expect(at(2000, 86_000).events).toMatchObject([{ type: 'context_high', pct: 86 }]);
    expect(at(3000, 90_000).events).toEqual([]);
    expect(at(4000, 80_000).events).toEqual([]);
    expect(at(5000, 88_000).events).toEqual([]);
    at(6000, 30_000);
    expect(types(at(7000, 87_000))).toEqual(['context_high']);
  });

  it('limits crossing 80% fire once per window', () => {
    const d = new NotifyDetector();
    const lim = (five: number, at: number, seven = 10): Limits => ({ fiveHourPct: five, fiveHourResetsAt: at, sevenDayPct: seven, sevenDayResetsAt: 9e12, updatedAt: 0 });
    d.onSnapshot(snap(1000, [], lim(50, 1e12)));
    expect(d.onSnapshot(snap(2000, [], lim(81, 1e12))).events).toEqual([{ type: 'limit_high', ts: 2000, sessionId: null, project: null, pct: 81, window: '5h' }]);
    expect(d.onSnapshot(snap(3000, [], lim(95, 1e12 + 2000))).events).toEqual([]); // reset time jitter, same window
    expect(types(d.onSnapshot(snap(4000, [], lim(85, 1e12 + 5 * 3_600_000))))).toEqual(['limit_high']); // next window
    expect(types(d.onSnapshot(snap(5000, [], lim(85, 1e12 + 5 * 3_600_000, 82))))).toEqual(['limit_high']); // 7 d
    // Without limits data nothing happens.
    expect(d.onSnapshot(snap(6000, [], null)).events).toEqual([]);
  });

  it('limits already above 80% at load do not fire', () => {
    const d = new NotifyDetector();
    const l: Limits = { fiveHourPct: 90, fiveHourResetsAt: 1e12, sevenDayPct: 10, sevenDayResetsAt: null, updatedAt: 0 };
    d.onSnapshot(snap(1000, [], l));
    expect(d.onSnapshot(snap(2000, [], l)).events).toEqual([]);
  });

  it('the limit forecast warns once per 5 h window', () => {
    const d = new NotifyDetector();
    const H = 3_600_000;
    const wf = (resetsAt: number, hitsAt: number | null, confidence: ForecastConfidence = 'medium', pct = 60): WindowForecast => ({
      window: '5h', pct, resetsAt, ratePerHour: 20, hitsAt, pctAtReset: hitsAt ? 100 : 80, confidence, basis: 'limits', points: 8,
    });
    const fc = (five: WindowForecast): LimitsForecast => ({ source: 'statusline', now: 0, updatedAt: 0, fiveHour: five, sevenDay: { ...five, window: '7d', hitsAt: null } });
    const at = (now: number, f: WindowForecast) => d.onSnapshot({ ...snap(now, []), limitsForecast: fc(f) });
    const R = 1e12;
    at(1000, wf(R, null)); // baseline: lasts until reset
    // Runs out only 10 min before the reset: not worth a warning.
    expect(at(2000, wf(R, R - 10 * 60_000)).events).toEqual([]);
    // Low confidence: no warning.
    expect(at(3000, wf(R, R - H, 'low')).events).toEqual([]);
    // 1 h early with medium confidence: one warning, with the times.
    expect(at(4000, wf(R, R - H)).events).toEqual([{ type: 'limit_forecast', ts: 4000, sessionId: null, project: null, pct: 60, window: '5h', at: R - H, resetsAt: R }]);
    // The same window (reset time jitters), the forecast wobbles: no repeat.
    expect(at(5000, wf(R + 3000, null)).events).toEqual([]);
    expect(at(6000, wf(R + 5000, R - 2 * H)).events).toEqual([]);
    // The next window warns again.
    expect(types(at(7000, wf(R + 5 * H, R + 3 * H)))).toEqual(['limit_forecast']);
    // Without a forecast nothing happens.
    expect(d.onSnapshot(snap(8000, [], null)).events).toEqual([]);
  });

  it('a forecast that already warns at load does not fire', () => {
    const d = new NotifyDetector();
    const five: WindowForecast = { window: '5h', pct: 70, resetsAt: 1e12, ratePerHour: 30, hitsAt: 1e12 - 3_600_000, pctAtReset: 100, confidence: 'high', basis: 'limits', points: 9 };
    const s = { ...snap(1000, []), limitsForecast: { source: 'statusline' as const, now: 0, updatedAt: 0, fiveHour: five, sevenDay: { ...five, window: '7d' as const } } };
    d.onSnapshot(s);
    expect(d.onSnapshot({ ...s, now: 2000 }).events).toEqual([]);
  });

  it('maps reason codes to wait kinds', () => {
    expect(waitKind('waitingInput')).toBe('input');
    expect(waitKind('probablyPermission')).toBe('permission');
    expect(waitKind('waitingYou')).toBe('you');
    expect(waitKind(null)).toBe('you');
  });

  it('automated sessions never notify unless included', () => {
    let include = false;
    const d = new NotifyDetector(() => include);
    const auto = (status: SessionStatus) => sess('ci', status, { kind: 'automated' });
    d.onSnapshot(snap(1000, [auto('working'), sess('a', 'working')]));
    const r = d.onSnapshot(snap(2000, [auto('waiting'), sess('a', 'idle')]));
    expect(r.events.map((e) => [e.type, e.sessionId])).toEqual([['session_done', 'a']]);
    expect(d.onEvent({ kind: 'spawn', ts: 2100, sessionId: 'ci', parentId: 'main', agentId: 'x', agentType: 'Explore', description: null }).events).toEqual([]);
    expect(d.onEvent({ kind: 'compact', ts: 2200, sessionId: 'ci' }).events).toEqual([]);
    // The setting is read on every decision.
    include = true;
    d.onSnapshot(snap(3000, [auto('working'), sess('a', 'idle')]));
    expect(types(d.onSnapshot(snap(4000, [auto('idle'), sess('a', 'idle')])))).toEqual(['session_done']);
    expect(types(d.onEvent({ kind: 'compact', ts: 4100, sessionId: 'ci' }))).toEqual(['compaction']);
  });
});
