// What the galaxy shows as individual stars and what it folds into per-project clusters. Pure functions.
//
// A project can have hundreds of sessions a day (each `claude -p` run from a script or CI is one), and
// drawing each as a star made an unreadable ring. Rules:
// - live interactive sessions are stars;
// - sessions without a live process ("asleep") fold into one cluster per project — except a lone asleep
//   interactive session, which stays a dim star as before;
// - automated sessions fold into the cluster even while running, unless `showAutomated` is on;
// - pinned sessions (focused, or revealed from a cluster's list) are always stars;
// - a global cap: when stars + clusters exceed `maxBodies`, the least active projects fold their idle
//   stars into their clusters (automated runs first, least recently active first, only as many as
//   needed). Working or waiting sessions are never folded.
import type { LiveSession } from '@shared/api';

export const MAX_BODIES = 24;

export interface ClusterInfo {
  /** 'cluster:<project>' — never collides with a session id. */
  key: string;
  project: string;
  /** Most recent first. */
  sessions: LiveSession[];
  tokens24h: number;
  /** How many of them have a live process / are automated / are working right now. */
  live: number;
  automated: number;
  working: number;
  lastActivity: number;
}

export interface GalaxyPlan {
  stars: LiveSession[];
  /** Sorted by project name (stable). */
  clusters: ClusterInfo[];
}

export interface PlanOptions {
  showAutomated: boolean;
  maxBodies?: number;
  pinned?: ReadonlySet<string>;
}

export const clusterKey = (project: string) => `cluster:${project}`;
export const isAutomated = (s: Pick<LiveSession, 'kind'>) => s.kind === 'automated';

/** Where a session goes by default (before the cap): into its project's cluster or not. */
export function foldsByDefault(s: LiveSession, showAutomated: boolean): boolean {
  if (!s.alive) return true;
  return isAutomated(s) && !showAutomated;
}

/** Sessions that must stay visible as stars whatever the cap says. */
const urgent = (s: LiveSession) => s.alive && (s.status === 'working' || s.status === 'waiting');

function makeCluster(project: string, sessions: LiveSession[]): ClusterInfo {
  const list = [...sessions].sort((a, b) => b.lastActivity - a.lastActivity || a.sessionId.localeCompare(b.sessionId));
  return {
    key: clusterKey(project),
    project,
    sessions: list,
    tokens24h: list.reduce((a, s) => a + s.tokens24h, 0),
    live: list.filter((s) => s.alive).length,
    automated: list.filter(isAutomated).length,
    working: list.filter((s) => s.alive && s.status === 'working').length,
    lastActivity: list.length ? list[0].lastActivity : 0,
  };
}

/** How busy a project is, for choosing what to fold first (lower = folded first). */
function activity(list: LiveSession[]): [number, number, number, number, number] {
  return [
    list.filter((s) => s.alive && s.status === 'waiting').length,
    list.filter((s) => s.alive && s.status === 'working').length,
    list.filter((s) => s.alive).length,
    list.reduce((a, s) => a + s.tokens24h, 0),
    Math.max(0, ...list.map((s) => s.lastActivity)),
  ];
}
function cmpTuple(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export function planGalaxy(sessions: LiveSession[], opts: PlanOptions): GalaxyPlan {
  const max = opts.maxBodies ?? MAX_BODIES;
  const pinned = opts.pinned ?? new Set<string>();
  const byProject = new Map<string, LiveSession[]>();
  for (const s of sessions) {
    const arr = byProject.get(s.project);
    if (arr) arr.push(s);
    else byProject.set(s.project, [s]);
  }
  const stars = new Map<string, LiveSession[]>();
  const folded = new Map<string, LiveSession[]>();
  for (const [p, list] of byProject) {
    const st: LiveSession[] = [];
    const fo: LiveSession[] = [];
    for (const s of list) (pinned.has(s.sessionId) || !foldsByDefault(s, opts.showAutomated) ? st : fo).push(s);
    // A lone asleep interactive session is not worth a cluster: it stays a (dim) star.
    if (fo.length === 1 && !isAutomated(fo[0])) st.push(fo.pop()!);
    stars.set(p, st);
    folded.set(p, fo);
  }
  const count = () => {
    let n = 0;
    for (const p of byProject.keys()) n += stars.get(p)!.length + (folded.get(p)!.length ? 1 : 0);
    return n;
  };
  let total = count();
  if (total > max) {
    const order = [...byProject.keys()].sort((a, b) => cmpTuple(activity(byProject.get(a)!), activity(byProject.get(b)!)) || a.localeCompare(b));
    // Two passes: automated runs fold before anyone's interactive sessions. Within a project the
    // least recently active stars go first, and only as many as needed, so the busy ones stay.
    for (const autoOnly of [true, false]) {
      for (const p of order) {
        if (total <= max) break;
        const st = stars.get(p)!;
        const fo = folded.get(p)!;
        const foldable = st
          .filter((s) => !pinned.has(s.sessionId) && !urgent(s) && (!autoOnly || isAutomated(s)))
          .sort((x, y) => x.lastActivity - y.lastActivity || x.sessionId.localeCompare(y.sessionId));
        // A new cluster costs one body itself.
        const k = Math.min(foldable.length, total - max + (fo.length ? 0 : 1));
        if (k - (fo.length ? 0 : 1) <= 0) continue;
        const take = new Set(foldable.slice(0, k));
        stars.set(p, st.filter((s) => !take.has(s)));
        total -= k - (fo.length ? 0 : 1);
        fo.push(...take);
      }
    }
  }
  const outStars: LiveSession[] = [];
  for (const s of sessions) if (stars.get(s.project)!.includes(s)) outStars.push(s);
  const clusters = [...folded.entries()]
    .filter(([, l]) => l.length)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([p, l]) => makeCluster(p, l));
  return { stars: outStars, clusters };
}

/** Status priority of a star: whose label speaks for its project group. */
const rank = (s: LiveSession) => (s.alive ? (s.status === 'waiting' ? 4 : s.status === 'working' ? 3 : 2) : 1);

/** The group's primary star (its label is always shown): waiting > working > live > asleep, then the most recent. */
export function primaryOf(group: LiveSession[]): string | null {
  let best: LiveSession | null = null;
  for (const s of group) {
    if (!best || rank(s) > rank(best) || (rank(s) === rank(best) && (s.lastActivity > best.lastActivity || (s.lastActivity === best.lastActivity && s.sessionId < best.sessionId)))) best = s;
  }
  return best?.sessionId ?? null;
}

/**
 * Radius of a ring of `sizes.length` bodies (each `size` is its radius incl. glow, in px) such that
 * neighbours never overlap: the chord between two neighbours ≥ their sizes + `gap`.
 */
export function ringRadius(sizes: number[], minR: number, gap: number): number {
  const n = sizes.length;
  if (n <= 1) return 0;
  let need = 0;
  for (let i = 0; i < n; i++) need = Math.max(need, sizes[i] + sizes[(i + 1) % n] + gap);
  return Math.max(minR, need / (2 * Math.sin(Math.PI / n)));
}

/** Whether a star's label is drawn (before collision culling). */
export function labelWanted(o: { primary: boolean; hovered: boolean; waiting: boolean; zoom: number; groupSize: number }): boolean {
  if (o.primary || o.hovered || o.waiting) return true;
  return o.groupSize <= 3 || o.zoom >= LABEL_ZOOM;
}
/** Camera scale from which every star of a crowded group gets its label. */
export const LABEL_ZOOM = 1.6;

export interface GroupDisc { x: number; y: number; r: number; /** Never moves (pinned bodies, placed active groups). */ fixed?: boolean }

/**
 * Pushes project groups (discs in px: centre and footprint radius) apart so they do not overlap, and
 * keeps each inside the box. Deterministic (fixed iteration order), so the same groups always land in
 * the same places. Discs that cannot all fit end up as evenly squeezed as the box allows. Fixed discs
 * stay put and push the others away.
 */
export function relaxGroups(discs: GroupDisc[], box: { left: number; top: number; right: number; bottom: number }, iterations = 80): GroupDisc[] {
  const out = discs.map((d) => ({ ...d }));
  const clampIn = (d: GroupDisc) => {
    if (d.fixed) return;
    const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
    d.x = d.r * 2 >= box.right - box.left ? cx : Math.min(box.right - d.r, Math.max(box.left + d.r, d.x));
    d.y = d.r * 2 >= box.bottom - box.top ? cy : Math.min(box.bottom - d.r, Math.max(box.top + d.r, d.y));
  };
  out.forEach(clampIn);
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const need = a.r + b.r;
        if (d >= need || (a.fixed && b.fixed)) continue;
        if (d < 1e-6) { dx = Math.cos(i * 2.39996 + j); dy = Math.sin(i * 2.39996 + j); d = 1; }
        // The bigger disc moves less; a fixed one does not move at all.
        const push = need - d, wa = a.fixed ? 0 : b.fixed ? 1 : b.r / (a.r + b.r || 1), wb = 1 - wa;
        a.x -= (dx / d) * push * wa; a.y -= (dy / d) * push * wa;
        b.x += (dx / d) * push * wb; b.y += (dy / d) * push * wb;
        moved = true;
      }
    }
    out.forEach(clampIn);
    if (!moved) break;
  }
  return out;
}
