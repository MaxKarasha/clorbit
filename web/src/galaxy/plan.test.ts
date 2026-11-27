// Galaxy planning: what becomes a star, what folds into a project's cluster, the global cap, ring sizes.
import { describe, expect, it } from 'vitest';
import type { LiveSession, LiveSnapshot, SessionStatus } from '@shared/api';
import { MAX_BODIES, galaxyView, labelWanted, withNames, planGalaxy, primaryOf, relaxGroups, ringRadius } from './plan';

let n = 0;
function sess(project: string, o: { alive?: boolean; status?: SessionStatus; auto?: boolean; tokens?: number; last?: number; id?: string } = {}): LiveSession {
  const alive = o.alive ?? false;
  return {
    sessionId: o.id ?? `${project}-${++n}`, pid: alive ? 1 : null, alive, title: null, name: null, cwd: `/x/${project}`, project, gitBranch: null,
    model: null, effort: null, permissionMode: null, status: o.status ?? (alive ? 'idle' : 'stopped'), statusSince: 0, statusReason: null,
    startedAt: 0, lastActivity: o.last ?? 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, tokens24h: o.tokens ?? 1000,
    contextTokens: null, contextLimit: null, subagentsTotal: 0, subagentsActive: 0, compactions: 0, root: {} as LiveSession['root'],
    kind: o.auto ? 'automated' : 'interactive',
  };
}
const ids = (l: LiveSession[]) => l.map((s) => s.sessionId).sort();

describe('planGalaxy', () => {
  it('120 asleep automated runs of one project become one cluster (the ring bug)', () => {
    const runs = Array.from({ length: 120 }, (_, i) => sess('product', { auto: true, last: i, tokens: 500 }));
    const live = sess('product', { alive: true, status: 'working', id: 'me' });
    const p = planGalaxy([...runs, live], { showAutomated: false });
    expect(ids(p.stars)).toEqual(['me']);
    expect(p.clusters).toHaveLength(1);
    expect(p.clusters[0]).toMatchObject({ key: 'cluster:product', project: 'product', automated: 120, live: 0, tokens24h: 60000 });
    expect(p.clusters[0].sessions).toHaveLength(120);
    // Most recent first.
    expect(p.clusters[0].sessions[0].lastActivity).toBe(119);
  });

  it('running automated sessions join the cluster unless showAutomated is on', () => {
    const a = sess('ci', { alive: true, status: 'working', auto: true, id: 'a' });
    const b = sess('ci', { auto: true, id: 'b' });
    const off = planGalaxy([a, b], { showAutomated: false });
    expect(off.stars).toEqual([]);
    expect(off.clusters[0]).toMatchObject({ live: 1, working: 1, automated: 2 });
    const on = planGalaxy([a, b], { showAutomated: true });
    expect(ids(on.stars)).toEqual(['a']);
    // An asleep automated run still folds, even alone.
    expect(ids(on.clusters[0].sessions)).toEqual(['b']);
  });

  it('a lone asleep interactive session stays a star; two fold into a cluster', () => {
    expect(planGalaxy([sess('docs', { id: 'd1' })], { showAutomated: false })).toMatchObject({ stars: [{ sessionId: 'd1' }], clusters: [] });
    const two = planGalaxy([sess('docs'), sess('docs')], { showAutomated: false });
    expect(two.stars).toEqual([]);
    expect(two.clusters).toHaveLength(1);
  });

  it('pinned sessions are stars whatever their state', () => {
    const p = planGalaxy([sess('ci', { auto: true, id: 'x' }), sess('ci', { auto: true })], { showAutomated: false, pinned: new Set(['x']) });
    expect(ids(p.stars)).toEqual(['x']);
    expect(p.clusters[0].sessions).toHaveLength(1);
  });

  it('the cap folds the least active projects first and never hides working or waiting sessions', () => {
    const list: LiveSession[] = [];
    // 10 projects with three idle live sessions each (30 stars) and one busy project with 3 working sessions.
    for (let i = 0; i < 10; i++) for (let j = 0; j < 3; j++) list.push(sess(`p${String(i).padStart(2, '0')}`, { alive: true, tokens: 1000 + i }));
    for (let i = 0; i < 3; i++) list.push(sess('busy', { alive: true, status: 'working', id: `busy${i}` }));
    const p = planGalaxy(list, { showAutomated: false });
    expect(p.stars.length + p.clusters.length).toBeLessThanOrEqual(MAX_BODIES);
    expect(ids(p.stars.filter((s) => s.project === 'busy'))).toEqual(['busy0', 'busy1', 'busy2']);
    // The quietest projects (fewest tokens) were folded, the busiest kept.
    const folded = new Set(p.clusters.map((c) => c.project));
    expect(folded.has('p00')).toBe(true);
    expect(folded.has('p09')).toBe(false);
    expect(p.stars.length + p.clusters.length).toBe(24);
    // Under the cap nothing is folded.
    const small = planGalaxy(list.slice(0, 15), { showAutomated: false });
    expect(small.clusters).toEqual([]);
  });

  it('the cap folds automated runs before interactive sessions, and only as many as needed', () => {
    const list: LiveSession[] = [];
    for (let i = 0; i < 20; i++) list.push(sess('ci', { alive: true, auto: true, last: i, id: `ci${i}` }));
    for (let i = 0; i < 6; i++) list.push(sess('web', { alive: true, last: 100 + i, id: `web${i}` }));
    const p = planGalaxy(list, { showAutomated: true });
    expect(p.stars.length + p.clusters.length).toBe(MAX_BODIES);
    expect(p.stars.filter((s) => s.project === 'web')).toHaveLength(6);
    // The three oldest runs went into the new cluster; the most recent stay stars.
    expect(ids(p.clusters[0].sessions)).toEqual(['ci0', 'ci1', 'ci2']);
  });

  it('the cap keeps waiting sessions even when everything else folds', () => {
    const list = Array.from({ length: 40 }, (_, i) => sess(`w${i}`, { alive: true, status: 'waiting' }));
    const p = planGalaxy(list, { showAutomated: false, maxBodies: 5 });
    expect(p.stars).toHaveLength(40);
  });

  it('is stable: the same input gives the same plan in the same order', () => {
    const list = [sess('b', { id: 'b1', alive: true }), sess('a', { id: 'a1' }), sess('a', { id: 'a2' }), sess('c', { auto: true, id: 'c1' })];
    const p1 = planGalaxy(list, { showAutomated: false });
    const p2 = planGalaxy([...list].reverse(), { showAutomated: false });
    expect(p1.clusters.map((c) => c.project)).toEqual(['a', 'c']);
    expect(p2.clusters.map((c) => c.project)).toEqual(['a', 'c']);
    expect(p1.clusters.map((c) => c.sessions.map((s) => s.sessionId))).toEqual(p2.clusters.map((c) => c.sessions.map((s) => s.sessionId)));
  });
});

describe('ring layout and labels', () => {
  it('ring radius grows with count and size, and neighbours never overlap', () => {
    expect(ringRadius([10], 30, 20)).toBe(0);
    const r2 = ringRadius([10, 10], 30, 20);
    const r8 = ringRadius(Array(8).fill(10), 30, 20);
    const r8big = ringRadius(Array(8).fill(25), 30, 20);
    expect(r8).toBeGreaterThan(r2);
    expect(r8big).toBeGreaterThan(r8);
    for (const [sizes, R] of [[Array(8).fill(10), r8], [Array(8).fill(25), r8big]] as const) {
      const chord = 2 * R * Math.sin(Math.PI / sizes.length);
      expect(chord).toBeGreaterThanOrEqual(sizes[0] * 2 + 20 - 1e-9);
    }
  });

  it('the primary star of a group: waiting > working > live > asleep, then the most recent', () => {
    const a = sess('x', { alive: true, last: 10, id: 'a' });
    const b = sess('x', { alive: true, status: 'working', last: 5, id: 'b' });
    const c = sess('x', { alive: true, status: 'waiting', last: 1, id: 'c' });
    expect(primaryOf([a])).toBe('a');
    expect(primaryOf([a, b])).toBe('b');
    expect(primaryOf([a, b, c])).toBe('c');
    expect(primaryOf([sess('x', { last: 3, id: 'old' }), sess('x', { last: 9, id: 'new' })])).toBe('new');
    expect(primaryOf([])).toBeNull();
  });

  it('secondary labels of crowded groups need zoom or hover', () => {
    const base = { primary: false, hovered: false, waiting: false, zoom: 1, groupSize: 6 };
    expect(labelWanted(base)).toBe(false);
    expect(labelWanted({ ...base, zoom: 2 })).toBe(true);
    expect(labelWanted({ ...base, hovered: true })).toBe(true);
    expect(labelWanted({ ...base, waiting: true })).toBe(true);
    expect(labelWanted({ ...base, primary: true })).toBe(true);
    expect(labelWanted({ ...base, groupSize: 2 })).toBe(true);
  });
});

describe('relaxGroups', () => {
  const box = { left: 0, top: 100, right: 1440, bottom: 860 };
  it('pushes overlapping groups apart and keeps them in the box, deterministically', () => {
    const discs = [{ x: 300, y: 250, r: 220 }, { x: 420, y: 400, r: 60 }, { x: 700, y: 300, r: 60 }, { x: 1400, y: 120, r: 80 }];
    const a = relaxGroups(discs, box);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x - a[i].r).toBeGreaterThanOrEqual(box.left - 1e-6);
      expect(a[i].x + a[i].r).toBeLessThanOrEqual(box.right + 1e-6);
      expect(a[i].y - a[i].r).toBeGreaterThanOrEqual(box.top - 1e-6);
      expect(a[i].y + a[i].r).toBeLessThanOrEqual(box.bottom + 1e-6);
      for (let j = i + 1; j < a.length; j++) expect(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y)).toBeGreaterThanOrEqual(a[i].r + a[j].r - 1);
    }
    expect(relaxGroups(discs, box)).toEqual(a);
    // Input is not mutated; groups that already fit do not move.
    expect(discs[0]).toEqual({ x: 300, y: 250, r: 220 });
    expect(relaxGroups([{ x: 500, y: 500, r: 50 }], box)).toEqual([{ x: 500, y: 500, r: 50 }]);
  });
});

describe('galaxyView (the Cowork switch)', () => {
  const cw = { ...sess('Cowork', { id: 'cw' }), source: 'cowork' as const };
  const cli = sess('api', { id: 'cli' });
  const snap = { sessions: [cw, cli] } as unknown as LiveSnapshot;
  it('on: everything; off: Cowork sessions are left out; without Cowork the snapshot is returned as is', () => {
    expect(galaxyView(snap, true)).toBe(snap);
    expect(galaxyView(snap, false).sessions.map((s) => s.sessionId)).toEqual(['cli']);
    const plain = { sessions: [cli] } as unknown as LiveSnapshot;
    expect(galaxyView(plain, false)).toBe(plain);
  });
});

describe('withNames (renamed sessions)', () => {
  const a = { ...sess('api', { id: 'a' }), title: 'Fix login' };
  const b = { ...sess('api', { id: 'b' }), title: 'Docs' };
  const snap = { sessions: [a, b] } as unknown as LiveSnapshot;
  it('applies a name at once and keeps the replaced title; nothing to do returns the same snapshot', () => {
    expect(withNames(snap, {})).toBe(snap);
    const named = withNames(snap, { a: 'Login' });
    expect(named.sessions[0]).toMatchObject({ title: 'Login', autoTitle: 'Fix login' });
    expect(named.sessions[1]).toBe(b);
    expect(withNames(named, { a: 'Login' })).toBe(named);
  });
  it('a name removed locally brings the original back before the server catches up', () => {
    const fromServer = { sessions: [{ ...a, title: 'Login', autoTitle: 'Fix login' }] } as unknown as LiveSnapshot;
    const s = withNames(fromServer, {}).sessions[0];
    expect(s.title).toBe('Fix login');
    expect('autoTitle' in s).toBe(false);
    expect(galaxyView(snap, true, { b: 'Handbook' }).sessions[1].title).toBe('Handbook');
  });
});
