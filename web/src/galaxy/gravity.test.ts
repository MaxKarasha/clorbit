// Activity gravity (targets, stability, pins as obstacles, outward-only pushes), pin helpers, settings validation.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/api';
import { MAX_PINS, normalizeSettings } from '@shared/settings';
import { firstFree, gravityLayout, maxPull, pinSession, pinnedSessions, prunePins, pullOf, rayLimit, starPinKey, clusterPinKey, withPin, withoutPin, type GravityNode } from './gravity';

const box = { left: 12, top: 110, right: 1428, bottom: 864 };
const C = { x: 720, y: 477 };
const opt = { region: 130 };
const dist = (p: { x: number; y: number }) => Math.hypot(p.x - C.x, p.y - C.y);
const node = (key: string, x: number, y: number, pull: 0 | 1 | 2 = 0, r = 70): GravityNode => ({ key, x, y, r, pull });
function noOverlap(ps: { x: number; y: number }[], rs: number[]) {
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) expect(Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y)).toBeGreaterThanOrEqual(rs[i] + rs[j] - 1);
}
/** The fleet as in a real layout: a ring of projects around the centre. */
const fleet = (): GravityNode[] => Array.from({ length: 8 }, (_, i) => node(`p${i}`, C.x + Math.cos(i * 0.785) * 300, C.y + Math.sin(i * 0.785) * 250));

describe('pull', () => {
  it('waiting > working > the rest; only live sessions pull', () => {
    expect(pullOf({ alive: true, status: 'waiting' })).toBe(2);
    expect(pullOf({ alive: true, status: 'working' })).toBe(1);
    expect(pullOf({ alive: true, status: 'idle' })).toBe(0);
    expect(pullOf({ alive: false, status: 'working' })).toBe(0);
    expect(maxPull([{ alive: true, status: 'idle' }, { alive: true, status: 'working' }])).toBe(1);
    expect(maxPull([])).toBe(0);
  });
});

describe('ray geometry', () => {
  it('firstFree skips every disc on the ray, touching allowed', () => {
    const c = { x: 0, y: 0 }, u = { x: 1, y: 0 };
    expect(firstFree(c, u, 10, [], 100)).toBe(0);
    expect(firstFree(c, u, 10, [{ x: 0, y: 0, r: 20 }], 100)).toBeCloseTo(30);
    expect(firstFree(c, u, 10, [{ x: 0, y: 0, r: 20 }, { x: 45, y: 0, r: 10 }], 100)).toBeCloseTo(65);
    // A disc off the ray does not block it.
    expect(firstFree(c, u, 10, [{ x: 0, y: 50, r: 20 }], 100)).toBe(0);
    expect(firstFree(c, u, 10, [{ x: 0, y: 0, r: 200 }], 100)).toBeNull();
  });
  it('rayLimit keeps the disc inside the box', () => {
    expect(rayLimit({ x: 100, y: 100 }, { x: 1, y: 0 }, 10, { left: 0, top: 0, right: 200, bottom: 200 })).toBeCloseTo(90);
    expect(rayLimit({ x: 100, y: 100 }, { x: 0, y: -1 }, 30, { left: 0, top: 0, right: 200, bottom: 200 })).toBeCloseTo(70);
  });
});

describe('gravityLayout', () => {
  it('nothing active: nothing moves', () => {
    const nodes = fleet();
    expect(gravityLayout(nodes, [], box, C, opt)).toEqual(nodes.map((n) => ({ x: n.x, y: n.y })));
  });

  it('a working group goes to the centre; the waiting one takes the centre and the working one packs next to it', () => {
    const nodes = fleet();
    nodes[2].pull = 1;
    const a = gravityLayout(nodes, [], box, C, opt);
    expect(dist(a[2])).toBeLessThan(1);
    nodes[5].pull = 2;
    const b = gravityLayout(nodes.map((n, i) => ({ ...n, ...a[i] })), [], box, C, opt);
    expect(dist(b[5])).toBeLessThan(1);
    expect(dist(b[2])).toBeCloseTo(140, 0);
    noOverlap(b, nodes.map((n) => n.r));
    // Everything is inside the box.
    for (const p of b) { expect(p.x).toBeGreaterThanOrEqual(box.left + 70 - 1e-6); expect(p.y).toBeLessThanOrEqual(box.bottom - 70 + 1e-6); }
  });

  it('is deterministic and a fixed point: the same inputs give the same targets, poll after poll', () => {
    const nodes = fleet();
    nodes[1].pull = 1; nodes[4].pull = 2; nodes[6].pull = 1;
    const a = gravityLayout(nodes, [], box, C, opt);
    expect(gravityLayout(nodes, [], box, C, opt)).toEqual(a);
    let cur = nodes.map((n, i) => ({ ...n, ...a[i] }));
    for (let poll = 0; poll < 5; poll++) {
      const next = gravityLayout(cur, [], box, C, opt);
      next.forEach((p, i) => expect(Math.hypot(p.x - cur[i].x, p.y - cur[i].y)).toBeLessThan(0.5));
      cur = cur.map((n, i) => ({ ...n, ...next[i] }));
    }
    noOverlap(a, nodes.map((n) => n.r));
  });

  it('a group that stops being active stays where it is', () => {
    const nodes = fleet();
    nodes[3].pull = 1;
    const a = gravityLayout(nodes, [], box, C, opt);
    const idle = nodes.map((n, i) => ({ ...n, ...a[i], pull: 0 as const }));
    expect(gravityLayout(idle, [], box, C, opt)).toEqual(a.map((p) => ({ x: p.x, y: p.y })));
  });

  it('inactive groups move only when an active one needs the space, and only outward', () => {
    const nodes = [node('busy', 1200, 300, 1), node('idle', C.x + 40, C.y + 10), node('far', 150, 780)];
    const a = gravityLayout(nodes, [], box, C, opt);
    expect(dist(a[0])).toBeLessThan(1);
    expect(dist(a[1])).toBeGreaterThan(dist(nodes[1]));
    expect(dist(a[1])).toBeCloseTo(140, 0);
    // Untouched groups keep their exact place.
    expect(a[2]).toEqual({ x: 150, y: 780 });
  });

  it('a working group that made room for a waiting one stays put when that one finishes', () => {
    const nodes = fleet();
    nodes[2].pull = 1;
    const a = gravityLayout(nodes, [], box, C, opt);
    nodes[5].pull = 2;
    const b = gravityLayout(nodes.map((n, i) => ({ ...n, ...a[i] })), [], box, C, opt);
    expect(dist(b[5])).toBeLessThan(1);
    // The waiting one is answered and goes idle: nobody moves.
    const idle = nodes.map((n, i) => ({ ...n, ...b[i], pull: (i === 2 ? 1 : 0) as 0 | 1 }));
    expect(gravityLayout(idle, [], box, C, opt)).toEqual(b.map((p) => ({ x: p.x, y: p.y })));
    // A group far away that becomes active still comes in (it touches nothing central).
    idle[7].pull = 1;
    const c = gravityLayout(idle, [], box, C, opt);
    expect(dist(c[7])).toBeLessThan(dist(idle[7]) - 50);
  });

  it('active groups already in the centre region stay put (no churn between turns)', () => {
    const nodes = [node('a', C.x + 80, C.y, 1), node('b', C.x - 80, C.y - 60, 1)];
    const a = gravityLayout(nodes, [], box, C, { region: 130 });
    expect(a[0]).toEqual({ x: C.x + 80, y: C.y });
    // Overlapping ones are still separated (the later one along its own ray).
    noOverlap(a, [70, 70]);
  });

  it('pinned bodies are fixed obstacles: active groups pack around them, inactive ones are pushed off them', () => {
    const pin = { x: C.x, y: C.y, r: 50 };
    const nodes = [node('busy', 1100, C.y, 1), node('idle', C.x - 60, C.y)];
    const a = gravityLayout(nodes, [pin], box, C, opt);
    expect(a[0].y).toBeCloseTo(C.y);
    expect(a[0].x).toBeCloseTo(C.x + 120);
    expect(Math.hypot(a[1].x - pin.x, a[1].y - pin.y)).toBeGreaterThanOrEqual(120 - 1);
    noOverlap([pin, ...a], [50, 70, 70]);
  });

  it('a group on the centre itself moves along a stable direction', () => {
    const nodes = [node('w', C.x + 300, C.y, 2), node('k', C.x, C.y, 1)];
    const a = gravityLayout(nodes, [], box, C, opt);
    const b = gravityLayout(nodes, [], box, C, opt);
    expect(a).toEqual(b);
    expect(dist(a[0])).toBeLessThan(1);
    expect(dist(a[1])).toBeCloseTo(140, 0);
  });
});

describe('pins', () => {
  it('keys: project + session for stars, cluster:<project> for clusters', () => {
    expect(starPinKey('web', 'abc-1')).toBe('star:web:abc-1');
    expect(clusterPinKey('web')).toBe('cluster:web');
    expect(pinSession('star:my:proj:abc-1')).toBe('abc-1');
    expect(pinSession('cluster:web')).toBeNull();
    expect([...pinnedSessions({ 'star:a:s1': { x: 0, y: 0 }, 'cluster:a': { x: 1, y: 1 } })]).toEqual(['s1']);
  });

  it('withPin rounds, clamps, makes the pin the newest and drops the oldest over the limit', () => {
    let p = withPin({}, 'star:a:1', { x: 0.123456, y: 1.4 });
    expect(p['star:a:1']).toEqual({ x: 0.1235, y: 1 });
    p = withPin(p, 'cluster:b', { x: 0.5, y: 0.5 });
    p = withPin(p, 'star:a:1', { x: 0.2, y: 0.2 });
    expect(Object.keys(p)).toEqual(['cluster:b', 'star:a:1']);
    p = withPin(p, 'star:c:3', { x: 0, y: 0 }, 2);
    expect(Object.keys(p)).toEqual(['star:a:1', 'star:c:3']);
    expect(withoutPin(p, 'star:a:1')).toEqual({ 'star:c:3': { x: 0, y: 0 } });
  });

  it('prunes pins of sessions and projects that are gone; null when nothing changed', () => {
    const pins = { 'star:a:s1': { x: 0.1, y: 0.1 }, 'star:a:gone': { x: 0.2, y: 0.2 }, 'cluster:a': { x: 0.3, y: 0.3 }, 'cluster:old': { x: 0.4, y: 0.4 } };
    const sessions = [{ project: 'a', sessionId: 's1' }];
    expect(prunePins(pins, sessions)).toEqual({ 'star:a:s1': { x: 0.1, y: 0.1 }, 'cluster:a': { x: 0.3, y: 0.3 } });
    expect(prunePins({ 'star:a:s1': { x: 0, y: 0 } }, sessions)).toBeNull();
  });
});

describe('settings: layout', () => {
  it('defaults: gravity on, no pins; a 0.2.x settings row gets them', () => {
    expect(DEFAULT_SETTINGS.layout).toEqual({ gravity: true, pins: {} });
    expect(normalizeSettings({ interface: { lang: 'uk' } }).layout).toEqual({ gravity: true, pins: {} });
  });

  it('validates pins: key shapes, numbers clamped to 0..1, junk dropped, map replaced as a whole', () => {
    const s = normalizeSettings({
      layout: {
        gravity: 'no',
        pins: {
          'star:web:abc': { x: 0.5, y: 2 }, 'cluster:web': { x: -1, y: 0.333333 }, evil: { x: 0, y: 0 }, '__proto__': { x: 0, y: 0 },
          'star:bad': { x: 'a', y: 0 }, 'star:nan': { x: Number.NaN, y: 0 }, 'cluster:x': 5, extra: 1,
        },
        junk: true,
      },
    });
    expect(s.layout.gravity).toBe(true);
    expect(s.layout).not.toHaveProperty('junk');
    expect(s.layout.pins).toEqual({ 'star:web:abc': { x: 0.5, y: 1 }, 'cluster:web': { x: 0, y: 0.3333 } });
    const off = normalizeSettings({ layout: { gravity: false } }, s);
    expect(off.layout).toEqual({ gravity: false, pins: s.layout.pins });
    expect(normalizeSettings({ layout: { pins: {} } }, s).layout.pins).toEqual({});
    expect(normalizeSettings({ layout: { pins: [1, 2] } }, s).layout.pins).toEqual(s.layout.pins);
  });

  it('keeps at most MAX_PINS, the newest', () => {
    const many = Object.fromEntries(Array.from({ length: MAX_PINS + 10 }, (_, i) => [`star:p:s${i}`, { x: 0.5, y: 0.5 }]));
    const pins = normalizeSettings({ layout: { pins: many } }).layout.pins;
    expect(Object.keys(pins)).toHaveLength(MAX_PINS);
    expect(pins).toHaveProperty(`star:p:s${MAX_PINS + 9}`);
    expect(pins).not.toHaveProperty('star:p:s0');
  });
});
