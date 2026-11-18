// Replay model: ordering, normalization, capping, state at arbitrary t, the incremental cursor, the time map, markers.
import { describe, expect, it } from 'vitest';
import type { AgentNode, ReplayEvent, SessionReplay } from '../api';
import {
  autoRate, buildTimeMap, capReplayEvents, densityBins, extractMarkers, GAP_EXTRA_MS, IDLE_GAP_MS, nearestEventTs, nearestMarker,
  normalizeReplayEvents, ReplayCursor, replaySession, replayStateAt, replayTree, sortReplayEvents,
} from '../replay';

const T0 = Date.UTC(2026, 10, 18, 10, 0);
const S = 1000;
const MIN = 60_000;

function replay(events: ReplayEvent[], extra: Partial<SessionReplay> = {}): SessionReplay {
  const ev = normalizeReplayEvents(events);
  return {
    sessionId: 'sess-0001', project: 'proj', cwd: '/x/proj', title: 'T', model: 'claude-opus-5-5', effort: 'high', contextLimit: 200_000,
    startedAt: T0, endedAt: ev.length ? ev[ev.length - 1].ts : T0, live: false, generatedAt: T0, events: ev, ...extra,
  };
}

const spawn = (ts: number, agentId: string, parentId = 'main', agentType = 'Explore'): ReplayEvent => ({ kind: 'spawn', ts, agentId, parentId, agentType, description: `task ${agentId}` });
const finish = (ts: number, agentId: string, tokens = 100): ReplayEvent => ({ kind: 'finish', ts, agentId, tokens });
const tool = (ts: number, agentId: string, label = 'Read a.ts'): ReplayEvent => ({ kind: 'tool', ts, agentId, label });
const tok = (ts: number, agentId: string, n: number, context?: number): ReplayEvent => (context === undefined ? { kind: 'tokens', ts, agentId, t: [n, n, n, n] } : { kind: 'tokens', ts, agentId, t: [n, n, n, n], context });

/** Ids of a tree, depth-first, with depth and status: compact to compare. */
function shape(n: AgentNode): string[] {
  const out: string[] = [];
  const walk = (x: AgentNode) => { out.push(`${'  '.repeat(x.depth)}${x.id}:${x.status}`); x.children.forEach(walk); };
  walk(n);
  return out;
}

describe('ordering and normalization', () => {
  it('sorts by time, then spawn before tools before finish, then input order', () => {
    const ev: ReplayEvent[] = [finish(T0 + 5 * S, 'a'), tool(T0 + 5 * S, 'a', 'second'), spawn(T0 + 5 * S, 'b'), tool(T0 + 5 * S, 'a', 'third'), tool(T0, 'main')];
    const out = sortReplayEvents(ev);
    expect(out.map((e) => e.kind)).toEqual(['tool', 'spawn', 'tool', 'tool', 'finish']);
    expect(out.filter((e) => e.kind === 'tool').map((e) => (e as { label: string }).label)).toEqual(['Read a.ts', 'second', 'third']);
  });

  it('moves a spawn back to the first activity and a finish forward to the last; drops duplicates', () => {
    const ev = normalizeReplayEvents([
      tool(T0 + 1 * S, 'a'), spawn(T0 + 3 * S, 'a'), spawn(T0 + 4 * S, 'a'), finish(T0 + 5 * S, 'a'), tool(T0 + 8 * S, 'a'), finish(T0 + 9 * S, 'a'),
      spawn(T0, 'main'), finish(T0, 'main'),
    ]);
    expect(ev.filter((e) => e.kind === 'spawn')).toHaveLength(1);
    expect(ev.find((e) => e.kind === 'spawn')!.ts).toBe(T0 + 1 * S);
    expect(ev.filter((e) => e.kind === 'finish')).toEqual([finish(T0 + 8 * S, 'a')]);
    expect(ev[0].kind).toBe('spawn');
  });
});

describe('replayStateAt', () => {
  // main spawns a (Plan) at 10 s; a spawns b (Explore) at 20 s and c at 25 s; a finishes at 40 s (before its children);
  // b finishes at 50 s, c at 70 s. Tokens and context along the way.
  const r = replay([
    { kind: 'prompt', ts: T0, text: 'go' },
    { kind: 'status', ts: T0, status: 'working', reason: 'Got a prompt', code: 'gotPrompt', arg: null },
    tok(T0 + 2 * S, 'main', 10, 5000),
    spawn(T0 + 10 * S, 'a', 'main', 'Plan'),
    tool(T0 + 12 * S, 'a', 'Grep "x"'),
    spawn(T0 + 20 * S, 'b', 'a'),
    spawn(T0 + 25 * S, 'c', 'a'),
    tok(T0 + 30 * S, 'b', 5),
    finish(T0 + 40 * S, 'a', 999),
    finish(T0 + 50 * S, 'b', 20),
    { kind: 'compact', ts: T0 + 55 * S, auto: true, preTokens: 150_000 },
    tok(T0 + 60 * S, 'main', 1, 12_000),
    finish(T0 + 70 * S, 'c', 30),
    { kind: 'status', ts: T0 + 80 * S, status: 'idle', reason: 'Answer ready', code: 'answerReady', arg: null },
  ]);

  it('before anything: just the manager', () => {
    const s = replayStateAt(r, T0 - 1);
    expect(shape(replayTree(s))).toEqual(['main:idle']);
    expect(s.subagentsTotal).toBe(0);
  });

  it('nesting at arbitrary moments', () => {
    expect(shape(replayTree(replayStateAt(r, T0 + 15 * S)))).toEqual(['main:working', '  a:working']);
    expect(shape(replayTree(replayStateAt(r, T0 + 26 * S)))).toEqual(['main:working', '  a:working', '    b:working', '    c:working']);
  });

  it('a parent that finished before its children stays (done) until they return', () => {
    expect(shape(replayTree(replayStateAt(r, T0 + 45 * S)))).toEqual(['main:working', '  a:done', '    b:working', '    c:working']);
    expect(shape(replayTree(replayStateAt(r, T0 + 60 * S)))).toEqual(['main:working', '  a:done', '    c:working']);
    expect(shape(replayTree(replayStateAt(r, T0 + 75 * S)))).toEqual(['main:working']);
    expect(shape(replayTree(replayStateAt(r, T0 + 90 * S)))).toEqual(['main:idle']);
  });

  it('counters: subagents, tokens, context, compactions, status', () => {
    const s = replayStateAt(r, T0 + 45 * S);
    expect(s.subagentsTotal).toBe(3);
    expect(s.subagentsActive).toBe(2);
    expect(s.tokens).toEqual([15, 15, 15, 15]);
    expect(s.contextTokens).toBe(5000);
    const end = replayStateAt(r, T0 + 99 * S);
    expect(end.subagentsActive).toBe(0);
    expect(end.compactions).toBe(1);
    expect(end.contextTokens).toBe(12_000);
    expect(end.status).toBe('idle');
    expect(end.agents.get('main')!.finishedChildren).toBe(1);
    expect(end.agents.get('a')!.finishedChildren).toBe(2);
    const sess = replaySession(end, r);
    expect(sess.tokens24h).toBe(64);
    expect(sess.statusCode).toBe('answerReady');
    expect(sess.subagentsTotal).toBe(3);
  });

  it('the parent flashes "Agent → type" when it spawns; tool calls set currentTool', () => {
    const s = replayStateAt(r, T0 + 12 * S);
    expect(s.agents.get('main')!.currentTool).toBe('Agent → Plan');
    expect(s.agents.get('a')!.currentTool).toBe('Grep "x"');
  });

  it('out-of-order input gives the same result as sorted input', () => {
    const shuffled = [...r.events].reverse();
    const r2 = replay(shuffled);
    for (const t of [T0 + 5 * S, T0 + 26 * S, T0 + 45 * S, T0 + 99 * S]) {
      expect(replayTree(replayStateAt(r2, t))).toEqual(replayTree(replayStateAt(r, t)));
    }
  });

  it('a child spawned before its parent (clock skew) hangs under the manager until the parent exists', () => {
    const r3 = replay([spawn(T0 + 5 * S, 'kid', 'dad'), spawn(T0 + 8 * S, 'dad', 'main', 'Plan')]);
    expect(shape(replayTree(replayStateAt(r3, T0 + 6 * S)))).toEqual(['main:idle', '  kid:working']);
    expect(shape(replayTree(replayStateAt(r3, T0 + 9 * S)))).toEqual(['main:idle', '  dad:working', '    kid:working']);
  });

  it('is pure: the same t gives equal states and does not mutate the replay', () => {
    const before = JSON.stringify(r);
    expect(replayTree(replayStateAt(r, T0 + 26 * S))).toEqual(replayTree(replayStateAt(r, T0 + 26 * S)));
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe('ReplayCursor', () => {
  // A random but seeded session: nested spawns, tools, tokens, finishes.
  function synthetic(n: number): SessionReplay {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ev: ReplayEvent[] = [];
    const alive: string[] = ['main'];
    let t = T0;
    for (let i = 0; i < n; i++) {
      t += Math.floor(rnd() * 20 * S);
      const x = rnd();
      if (x < 0.1) { const id = `ag${i}`; ev.push(spawn(t, id, alive[Math.floor(rnd() * alive.length)])); alive.push(id); }
      else if (x < 0.17 && alive.length > 1) { const k = 1 + Math.floor(rnd() * (alive.length - 1)); ev.push(finish(t, alive[k])); alive.splice(k, 1); }
      else if (x < 0.7) ev.push(tool(t, alive[Math.floor(rnd() * alive.length)], `tool ${i}`));
      else ev.push(tok(t, alive[Math.floor(rnd() * alive.length)], 3, Math.floor(rnd() * 1e5)));
    }
    return replay(ev);
  }

  it('forward steps and backward seeks always equal replayStateAt', () => {
    const r = synthetic(800);
    const c = new ReplayCursor(r);
    const span = r.endedAt - r.startedAt;
    const points = [0.1, 0.12, 0.5, 0.3, 0.31, 0.9, 1.1, 0.05, 0.7].map((f) => r.startedAt + f * span);
    for (const t of points) {
      const { snapped } = c.moveTo(t);
      const ref = replayStateAt(r, t);
      expect(replayTree(c.state)).toEqual(replayTree(ref));
      expect(c.state.tokens).toEqual(ref.tokens);
      expect(c.state.subagentsActive).toBe(ref.subagentsActive);
      expect(c.state.next).toBe(ref.next);
      expect(typeof snapped).toBe('boolean');
    }
  });

  it('returns the events it crossed going forward, and snaps going back', () => {
    const r = synthetic(100);
    const c = new ReplayCursor(r);
    const mid = r.events[50].ts;
    const a = c.moveTo(mid);
    expect(a.snapped).toBe(false);
    expect(a.crossed.length).toBe(r.events.filter((e) => e.ts <= mid).length);
    const b = c.moveTo(r.endedAt);
    expect(b.crossed.length).toBe(r.events.length - a.crossed.length);
    expect(c.moveTo(mid).snapped).toBe(true);
  });
});

describe('capReplayEvents', () => {
  it('keeps every structural event, samples tools evenly and keeps token sums exact', () => {
    const ev: ReplayEvent[] = [];
    for (let i = 0; i < 50; i++) ev.push(spawn(T0 + i * MIN, `a${i}`), finish(T0 + i * MIN + 30 * S, `a${i}`));
    for (let i = 0; i < 30_000; i++) ev.push(tool(T0 + i * 100, i % 2 ? 'main' : 'a1', `t${i}`));
    for (let i = 0; i < 8_000; i++) ev.push(tok(T0 + i * 300, 'main', 1, i));
    for (let i = 0; i < 4_000; i++) ev.push({ kind: 'text', ts: T0 + i * 700, agentId: 'main', text: 'x' });
    const sorted = sortReplayEvents(ev);
    const { events, sampled } = capReplayEvents(sorted, 5_000);
    expect(events.length).toBeLessThanOrEqual(5_000);
    expect(events.filter((e) => e.kind === 'spawn')).toHaveLength(50);
    expect(events.filter((e) => e.kind === 'finish')).toHaveLength(50);
    expect(sampled!.tool[1]).toBe(30_000);
    expect(sampled!.tool[0]).toBeGreaterThan(1500);
    const sum = events.reduce((a, e) => a + (e.kind === 'tokens' ? e.t[0] : 0), 0);
    expect(sum).toBe(8_000);
    // the last context survives merging
    const lastTok = [...events].reverse().find((e) => e.kind === 'tokens') as Extract<ReplayEvent, { kind: 'tokens' }>;
    expect(lastTok.context).toBe(7_999);
    // evenly spread: kept tools cover the whole span
    const tools = events.filter((e) => e.kind === 'tool');
    expect(tools[0].ts).toBeLessThan(T0 + 60 * S);
    expect(tools[tools.length - 1].ts).toBeGreaterThan(T0 + 2_900 * S);
    expect(events).toEqual(sortReplayEvents(events));
  });

  it('leaves small lists alone', () => {
    const ev = [tool(T0, 'main'), tool(T0 + 1, 'main')];
    expect(capReplayEvents(ev, 10)).toEqual({ events: ev });
  });
});

describe('time map', () => {
  const ts = [T0, T0 + 10 * S, T0 + 20 * S, T0 + 2 * 3_600_000, T0 + 2 * 3_600_000 + 5 * S];
  const end = T0 + 2 * 3_600_000 + 10 * S;

  it('without compression it is a plain shift', () => {
    const m = buildTimeMap(ts, T0, end, false);
    expect(m.duration).toBe(end - T0);
    expect(m.toPlay(T0 + 123)).toBe(123);
    expect(m.toReal(456)).toBe(T0 + 456);
  });

  it('compresses idle gaps longer than 30 s, keeps short ones', () => {
    const m = buildTimeMap(ts, T0, end, true);
    expect(m.gaps).toEqual([{ from: T0 + 20 * S, to: T0 + 2 * 3_600_000 }]);
    expect(m.toPlay(T0 + 20 * S)).toBe(20 * S);
    expect(m.duration).toBeLessThan(20 * S + IDLE_GAP_MS + GAP_EXTRA_MS + 10 * S + 1);
    expect(m.duration).toBeGreaterThan(20 * S + IDLE_GAP_MS + 10 * S);
  });

  it('is monotonic and invertible', () => {
    const m = buildTimeMap(ts, T0, end, true);
    let prev = -1;
    for (let t = T0; t <= end; t += 7_777) {
      const p = m.toPlay(t);
      expect(p).toBeGreaterThan(prev);
      prev = p;
      expect(Math.abs(m.toReal(p) - t)).toBeLessThan(2);
    }
    for (let p = 0; p <= m.duration; p += 997) expect(Math.abs(m.toPlay(m.toReal(p)) - p)).toBeLessThan(1e-3);
    expect(m.toPlay(T0 - 5)).toBe(0);
    expect(m.toPlay(end + 5)).toBe(m.duration);
  });

  it('auto rate fits the replay into a couple of minutes, 1×..60×', () => {
    expect(autoRate(30 * MIN)).toBe(12);
    expect(autoRate(10 * S)).toBe(1);
    expect(autoRate(100 * 3_600_000)).toBe(60);
  });
});

describe('markers, stepping, density', () => {
  const ev = normalizeReplayEvents([
    { kind: 'prompt', ts: T0, text: 'build it' },
    spawn(T0 + 5 * S, 'a'),
    { kind: 'status', ts: T0 + 8 * S, status: 'waiting', reason: 'Waiting for permission: Bash', code: 'waitingPermission', arg: 'Bash' },
    { kind: 'status', ts: T0 + 9 * S, status: 'waiting', reason: 'Waiting for permission: Bash', code: 'waitingPermission', arg: 'Bash' },
    { kind: 'status', ts: T0 + 12 * S, status: 'working', reason: null, code: null, arg: null },
    { kind: 'compact', ts: T0 + 20 * S, auto: true, preTokens: null },
    tool(T0 + 21 * S, 'main'),
  ]);

  it('extracts spawns, the start of each wait, compactions and prompts', () => {
    expect(extractMarkers(ev).map((m) => `${m.kind}@${(m.ts - T0) / S}`)).toEqual(['prompt@0', 'spawn@5', 'wait@8', 'compact@20']);
  });

  it('jumps to the next / previous marker and event', () => {
    const m = extractMarkers(ev);
    expect(nearestMarker(m, T0 + 6 * S, 1)!.kind).toBe('wait');
    expect(nearestMarker(m, T0 + 6 * S, -1)!.kind).toBe('spawn');
    expect(nearestMarker(m, T0 + 30 * S, 1)).toBeNull();
    expect(nearestEventTs(ev, T0 + 5 * S, 1)).toBe(T0 + 8 * S);
    expect(nearestEventTs(ev, T0 + 5 * S, -1)).toBe(T0);
    expect(nearestEventTs(ev, T0 + 21 * S, 1)).toBeNull();
  });

  it('density is normalized and lands in the right bins', () => {
    const m = buildTimeMap(ev.map((e) => e.ts), T0, T0 + 21 * S, false);
    const d = densityBins(ev, m, 21);
    expect(Math.max(...d)).toBe(1);
    expect(d[5]).toBe(1); // the spawn counts double
    expect(d[20]).toBe(0.5);
  });
});
