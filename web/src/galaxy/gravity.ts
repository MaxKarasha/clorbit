// Activity gravity and pins: where project groups settle. Pure functions (no DOM, no time).
//
// - Working and waiting groups are pulled into the centre region; waiting ones are placed first, so they
//   get the spot closest to the centre and push working ones aside.
// - Everything else stays where it is. An inactive group moves only when an active group (or a pinned
//   body) needs its space, and then only outward, as far as needed.
// - Pinned bodies never move and are obstacles for everyone else.
// - The result is a fixed point: feeding it back with the same inputs gives the same positions, so
//   targets do not wander or oscillate between polls.
import type { LiveSession } from '@shared/api';
import { MAX_PINS, type LayoutPin } from '@shared/settings';
import { relaxGroups, type GroupDisc } from './plan';

/** 0 — no pull, 1 — working, 2 — waiting (the strongest). */
export type Pull = 0 | 1 | 2;

export interface GravityNode { key: string; x: number; y: number; r: number; pull: Pull }
export interface Box { left: number; top: number; right: number; bottom: number }

export function pullOf(s: Pick<LiveSession, 'alive' | 'status'>): Pull {
  if (!s.alive) return 0;
  return s.status === 'waiting' ? 2 : s.status === 'working' ? 1 : 0;
}
export const maxPull = (list: Pick<LiveSession, 'alive' | 'status'>[]): Pull => list.reduce<Pull>((m, s) => Math.max(m, pullOf(s)) as Pull, 0);

/** Deterministic direction for a group sitting exactly on the centre. */
function hashAngle(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) / 4294967295) * Math.PI * 2;
}

/** How far from `c` along the unit vector `u` a disc of radius `r` may go and stay inside the box. */
export function rayLimit(c: { x: number; y: number }, u: { x: number; y: number }, r: number, box: Box): number {
  let lim = Infinity;
  const axis = (p: number, d: number, lo: number, hi: number) => {
    // A disc wider than the box cannot be kept inside on this axis; the box clamp centres it later.
    if (hi < lo || Math.abs(d) < 1e-9) return;
    const to = d > 0 ? (hi - p) / d : (lo - p) / d;
    lim = Math.min(lim, to);
  };
  axis(c.x, u.x, box.left + r, box.right - r);
  axis(c.y, u.y, box.top + r, box.bottom - r);
  return lim;
}

/**
 * The smallest distance d ≥ `from` along the ray c + u·d at which a disc of radius `r` overlaps none of
 * `placed` (touching is fine), or null when there is no such place within `max`.
 */
export function firstFree(c: { x: number; y: number }, u: { x: number; y: number }, r: number, placed: GroupDisc[], max: number, from = 0): number | null {
  const iv: [number, number][] = [];
  for (const q of placed) {
    const wx = c.x - q.x, wy = c.y - q.y;
    const R = r + q.r;
    const b = u.x * wx + u.y * wy;
    const disc = b * b - (wx * wx + wy * wy - R * R);
    if (disc <= 0) continue;
    const s = Math.sqrt(disc);
    iv.push([-b - s, -b + s]);
  }
  let d = from;
  // Open intervals: at d === a or d === b the discs only touch.
  for (let guard = 0, moved = true; moved && guard <= iv.length; guard++) {
    moved = false;
    for (const [a, b] of iv) if (a < d - 1e-6 && d < b - 1e-6) { d = b; moved = true; }
  }
  return d <= max + 1e-6 ? d : null;
}

export interface GravityOptions {
  /** Groups closer to the centre than this (px) and not overlapping anyone stay where they are. */
  region: number;
  /** Fixed-point passes (each pass is deterministic; usually 1–2 are enough). */
  passes?: number;
}

/**
 * One deterministic pass: active groups (by pull, then by distance to the centre, then key) take the first
 * free spot on the ray from the centre towards where they are; inactive groups keep their place unless
 * something overlaps them, then they are pushed out (relaxGroups with fixed discs).
 */
function pass(nodes: GravityNode[], obstacles: GroupDisc[], box: Box, c: { x: number; y: number }, opt: GravityOptions): { x: number; y: number }[] {
  const out = nodes.map((n) => ({ x: n.x, y: n.y }));
  const dist = (n: GravityNode) => Math.round(Math.hypot(n.x - c.x, n.y - c.y) * 2) / 2;
  const order = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.pull > 0)
    .sort((a, b) => b.n.pull - a.n.pull || dist(a.n) - dist(b.n) || (a.n.key < b.n.key ? -1 : a.n.key > b.n.key ? 1 : 0));
  const placed: GroupDisc[] = obstacles.map((o) => ({ ...o }));
  const fixed = new Set<number>();
  for (const { n, i } of order) {
    let dx = n.x - c.x, dy = n.y - c.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) { const a = hashAngle(n.key); dx = Math.cos(a); dy = Math.sin(a); } else { dx /= len; dy /= len; }
    const u = { x: dx, y: dy };
    const max = rayLimit(c, u, n.r, box);
    // Already central and free: stay. Central means inside the region, or packed against a body whose centre
    // is (so a group that made room for a waiting one does not push it out again when it finishes).
    const central = len <= opt.region || [...nodes.filter((o) => o !== n), ...obstacles].some((o) => {
      const dd = Math.hypot(o.x - n.x, o.y - n.y);
      return Math.hypot(o.x - c.x, o.y - c.y) <= opt.region && dd <= o.r + n.r + 2;
    });
    const here = central && firstFree(c, u, n.r, placed, Math.max(len, max), len) === len;
    const d = here ? len : firstFree(c, u, n.r, placed, Math.max(0, max));
    if (d === null) continue; // no room on this ray: it is relaxed with the rest below
    out[i] = { x: c.x + u.x * d, y: c.y + u.y * d };
    placed.push({ x: out[i].x, y: out[i].y, r: n.r });
    fixed.add(i);
  }
  // The rest keeps its place; overlaps are resolved by pushing the movable discs out of the fixed ones.
  const discs: (GroupDisc & { fixed?: boolean })[] = [
    ...obstacles.map((o) => ({ ...o, fixed: true })),
    ...nodes.map((n, i) => ({ x: out[i].x, y: out[i].y, r: n.r, fixed: fixed.has(i) })),
  ];
  const relaxed = relaxGroups(discs, box).slice(obstacles.length);
  return relaxed.map((d) => ({ x: d.x, y: d.y }));
}

/**
 * Target centres for project groups. `nodes` carry the current targets (anchors), `obstacles` the pinned
 * bodies. Returns positions in the same order. Idempotent: gravityLayout(result) ≈ result.
 */
export function gravityLayout(nodes: GravityNode[], obstacles: GroupDisc[], box: Box, centre: { x: number; y: number }, opt: GravityOptions): { x: number; y: number }[] {
  let cur = nodes.map((n) => ({ ...n }));
  let res = cur.map((n) => ({ x: n.x, y: n.y }));
  for (let p = 0; p < (opt.passes ?? 8); p++) {
    res = pass(cur, obstacles, box, centre, opt);
    let moved = 0;
    res.forEach((r, i) => { moved = Math.max(moved, Math.hypot(r.x - cur[i].x, r.y - cur[i].y)); });
    cur = cur.map((n, i) => ({ ...n, x: res[i].x, y: res[i].y }));
    if (moved < 0.25) break;
  }
  return res;
}

/* ---------- pins ---------- */

export type Pins = Record<string, LayoutPin>;

/** Stable identity of a star in the pins map: project + session. */
export const starPinKey = (project: string, sessionId: string) => `star:${project}:${sessionId}`;
/** A cluster is pinned as 'cluster:<project>' (the same key as the cluster itself). */
export const clusterPinKey = (project: string) => `cluster:${project}`;
/** The session id of a star pin key (session ids never contain ':'), or null for a cluster key. */
export function pinSession(key: string): string | null {
  return key.startsWith('star:') ? key.slice(key.lastIndexOf(':') + 1) || null : null;
}
const round4 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4;

/** Adds or moves a pin (it becomes the newest); the oldest pins go when there are more than `max`. */
export function withPin(pins: Pins, key: string, p: { x: number; y: number }, max = MAX_PINS): Pins {
  const out: Pins = {};
  for (const [k, v] of Object.entries(pins)) if (k !== key) out[k] = v;
  out[key] = { x: round4(p.x), y: round4(p.y) };
  const keys = Object.keys(out);
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) delete out[k];
  return out;
}

export function withoutPin(pins: Pins, key: string): Pins {
  const out: Pins = {};
  for (const [k, v] of Object.entries(pins)) if (k !== key) out[k] = v;
  return out;
}

/** Session ids that are pinned as stars (they stay stars whatever the clustering rules say). */
export function pinnedSessions(pins: Pins): Set<string> {
  const out = new Set<string>();
  for (const k of Object.keys(pins)) { const s = pinSession(k); if (s) out.add(s); }
  return out;
}

/**
 * Drops pins whose session (or, for a cluster, whose project) is no longer in the snapshot.
 * Returns null when nothing changed.
 */
export function prunePins(pins: Pins, sessions: Pick<LiveSession, 'project' | 'sessionId'>[]): Pins | null {
  const ids = new Set(sessions.map((s) => s.sessionId));
  const projects = new Set(sessions.map((s) => s.project));
  const out: Pins = {};
  let changed = false;
  for (const [k, v] of Object.entries(pins)) {
    const sid = pinSession(k);
    const keep = sid ? ids.has(sid) : k.startsWith('cluster:') && projects.has(k.slice(8));
    if (keep) out[k] = v;
    else changed = true;
  }
  return changed ? out : null;
}
