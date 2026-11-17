// Galaxy engine: canvas scene, camera, animations. Data comes from outside (snapshot + events).
import type { AgentNode, ClorbitEvent, LiveSession, LiveSnapshot } from '@shared/api';
import { t, tp } from '../i18n';
import { clusterKey, labelWanted, planGalaxy, primaryOf, relaxGroups, ringRadius, type ClusterInfo } from './plan';

export type Col = { h: number; s: number; l: number };
export type Focus =
  | { t: 'none' }
  | { t: 'sys'; sessionId: string }
  | { t: 'agent'; sessionId: string; agentId: string }
  | { t: 'cluster'; project: string };

const WAIT = '#FFB15C';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const eOut = (x: number) => 1 - Math.pow(1 - x, 3);
const eIn = (x: number) => x * x * x;
const lerp2 = (a: P, b: P, f: number): P => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
type P = [number, number];

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}
function hexA(h: string, a: number) {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}
export function cA(c: Col | string, a: number) {
  return typeof c === 'string' ? hexA(c, a) : `hsla(${c.h},${c.s}%,${c.l}%,${clamp(a, 0, 1)})`;
}
export const cssCol = (c: Col) => `hsl(${c.h} ${c.s}% ${c.l}%)`;

interface Body {
  key: string;
  sessionId: string;
  node: AgentNode;
  depth: number;
  parent: Body | null;
  children: Body[];
  slot: number;
  ang: number;
  speed: number;
  born: number;
  ret: number | null;
  flare: number;
  flareLabel: string;
  absorb: number;
  col: Col;
  _f: number;
  _p: P;
}
interface Dust { ang: number; r: number; s: number; hs: number; a: number; born: number }
interface Sys {
  s: LiveSession;
  root: Body;
  hue: number;
  fx: number; fy: number; tx: number; ty: number;
  belt: Dust[];
  appear: number;
  /** Eased label opacity (labels fade in and out instead of popping) and the side it sits on. */
  labelA: number;
  labelPos?: number;
}
/** A project's folded sessions: one star cluster in a soft nebula. */
interface Clu {
  key: string;
  info: ClusterInfo;
  hue: number;
  fx: number; fy: number; tx: number; ty: number;
  appear: number;
  absorb: number;
  flare: number;
  labelA: number;
  labelPos?: number;
}
type Hit = { x: number; y: number; r: number; sys?: Sys; body?: Body; clu?: Clu };
interface LabelLine { text: string; font: string; color: string }
/** A name label to place: its body (centre, label offset `br`, obstacle radii) and how much it matters. */
interface LabelCand {
  key: string; bx: number; by: number; br: number; ox: number; oy: number;
  lines: LabelLine[]; alpha: number; prio: number; must: boolean; want: boolean;
  ent: { labelA: number; labelPos?: number };
}

/** Branch colors: a star has its project's base hue, each level-1 planet its own color, descendants shades of it. */
export function branchCol(sysHue: number, depth: number, branchSlot: number, slot: number): Col {
  if (depth === 0) return { h: sysHue, s: 90, l: 76 };
  const h = (sysHue + 60 + branchSlot * 83 + (depth - 1) * 12 + slot * 5) % 360;
  return { h, s: 88, l: Math.min(84, 62 + (depth - 1) * 9) };
}

export interface EngineCallbacks {
  onFocus(f: Focus): void;
  onDistant?(project: string): void;
}

/** Distant stars: projects of the last 30 days without live sessions. */
export interface Distant { name: string; total: number; sessions: number }

export class GalaxyEngine {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private T = performance.now() / 1000;
  /** Ambient clock for twinkles, pulses and drifting belts; crawls with reduce motion. */
  private A = 0;
  private frameN = 0;
  private raf = 0;
  private systems = new Map<string, Sys>();
  private bodies = new Map<string, Body>();
  private focus: Focus = { t: 'none' };
  private cam = { x: 0, y: 0, s: 1 };
  private camInit = false;
  private timeScale = 1;
  private hits: Hit[] = [];
  private clusters = new Map<string, Clu>();
  /** sessionId → project of the cluster it is folded into. */
  private folded = new Map<string, string>();
  private lastSnap: LiveSnapshot | null = null;
  /** Sessions revealed from a cluster's list: shown as stars while they are in focus. */
  private pinned = new Set<string>();
  private needSync = false;
  private showAutomated = false;
  private hover: string | null = null;
  private dt = 0.016;
  private firstSync = true;
  private distant: (Distant & { ang: number; rr: number; tw: number })[] = [];
  private distantHits: { x: number; y: number; name: string }[] = [];
  private stars: { x: number; y: number; z: number; s: number }[];
  private ro: ResizeObserver;
  lastUser = -99;
  /** Auto tour is opt-in (toggle in the HUD). */
  tourOn = false;
  /** Reduce motion: orbits crawl, the camera jumps instead of flying (setting or OS preference). */
  reduceMotion = false;
  /** User camera offset on top of the focus target: drag pans, wheel/buttons zoom. */
  private pan = { x: 0, y: 0 };
  private zoomMul = 1;
  private drag: { lastX: number; lastY: number; dist: number } | null = null;
  private suppressClick = false;
  private lastTour = 0;
  private tourI = 0;

  constructor(private canvas: HTMLCanvasElement, private cb: EngineCallbacks) {
    this.ctx = canvas.getContext('2d')!;
    this.stars = Array.from({ length: 420 }, (_, i) => ({ x: rand(i), y: rand(i + 500), z: rand(i + 900), s: rand(i + 1300) }));
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    canvas.addEventListener('click', this.onClick);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKey);
    canvas.addEventListener('pointerleave', this.onLeave);
    this.lastUser = this.T;
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKey);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    const d = Math.min(2, devicePixelRatio || 1);
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(r.width * d);
    this.canvas.height = Math.round(r.height * d);
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    // Ring radii are in pixels: a new screen size means new target positions.
    this.layout();
  }

  getFocus() { return this.focus; }

  setDistant(list: Distant[]) {
    const max = Math.max(1, ...list.map((d) => d.total));
    this.distant = list.map((d) => ({ ...d, ang: hashStr(d.name) * 6.283, rr: 0.36 + hashStr(d.name + '#') * 0.1, tw: Math.log10(1 + d.total) / Math.log10(1 + max) }));
  }

  /** A body's color for the React panels (the same as on the scene). */
  colorOf(sessionId: string, agentId: string): string {
    const b = this.bodies.get(`${sessionId}:${agentId}`);
    if (b) return cssCol(b.col);
    const sys = this.systems.get(sessionId);
    return sys ? cssCol(branchCol(sys.hue, 0, 0, 0)) : '#9AA6BA';
  }

  /** The color of a body on the scene, or null if it is not (or no longer) there. */
  knownColor = (sessionId: string, agentId: string): string | null => {
    const b = this.bodies.get(`${sessionId}:${agentId}`);
    return b ? cssCol(b.col) : null;
  };

  /** Colors of every body on the scene, keyed 'sessionId:agentId' (shared with console windows). */
  colorMap = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, b] of this.bodies) out[k] = cssCol(b.col);
    return out;
  };

  setFocus(f: Focus, user = false) {
    if (user) this.lastUser = this.T;
    this.focus = f;
    // A revealed session goes back into its cluster once the focus moves elsewhere.
    const keep = f.t === 'sys' || f.t === 'agent' ? f.sessionId : null;
    for (const id of [...this.pinned]) if (id !== keep) { this.pinned.delete(id); this.needSync = true; }
    // A new focus flies to its own framing; drop the manual pan/zoom.
    this.pan = { x: 0, y: 0 };
    this.zoomMul = 1;
    this.cb.onFocus(f);
  }

  /* ---------- data sync ---------- */

  /** Automated sessions as separate stars (Settings → Interface). */
  setShowAutomated(v: boolean) {
    if (v === this.showAutomated) return;
    this.showAutomated = v;
    if (this.lastSnap) this.sync(this.lastSnap);
  }

  /** The cluster a session is folded into, or null when it is a star (or unknown). */
  clusterOf(sessionId: string): string | null { return this.folded.get(sessionId) ?? null; }
  /** A project's cluster as currently shown. */
  cluster(project: string): ClusterInfo | null { return this.clusters.get(project)?.info ?? null; }
  hasSystem(sessionId: string): boolean { return this.systems.has(sessionId); }

  /** Takes a session out of its cluster as a star and focuses it (or one of its agents). */
  reveal(sessionId: string, agentId?: string) {
    if (!this.systems.has(sessionId)) {
      if (!this.lastSnap?.sessions.some((s) => s.sessionId === sessionId)) return;
      this.pinned.add(sessionId);
      this.sync(this.lastSnap);
    }
    if (!this.systems.has(sessionId)) return;
    if (agentId && agentId !== 'main' && this.bodies.has(`${sessionId}:${agentId}`)) this.setFocus({ t: 'agent', sessionId, agentId }, true);
    else this.setFocus({ t: 'sys', sessionId }, true);
  }

  sync(snap: LiveSnapshot) {
    const now = this.T;
    this.lastSnap = snap;
    const seen = new Set<string>();
    const pinned = new Set(this.pinned);
    const f = this.focus;
    if (f.t === 'sys' || f.t === 'agent') pinned.add(f.sessionId);
    const plan = planGalaxy(snap.sessions, { showAutomated: this.showAutomated, pinned });
    this.folded.clear();
    const seenClu = new Set<string>();
    for (const info of plan.clusters) {
      seenClu.add(info.project);
      for (const s of info.sessions) this.folded.set(s.sessionId, info.project);
      let c = this.clusters.get(info.project);
      if (!c) {
        c = { key: info.key, info, hue: Math.round(hashStr(info.project) * 360), fx: 0.5, fy: 0.5, tx: 0.5, ty: 0.5, appear: this.firstSync ? -99 : now, absorb: -9, flare: -9, labelA: 1 };
        this.clusters.set(info.project, c);
      } else if (info.sessions.length > c.info.sessions.length) c.absorb = now;
      c.info = info;
    }
    for (const [p] of this.clusters) {
      if (seenClu.has(p)) continue;
      this.clusters.delete(p);
      if (this.focus.t === 'cluster' && this.focus.project === p) this.setFocus({ t: 'none' });
    }
    for (const s of plan.stars) {
      seen.add(s.sessionId);
      let sys = this.systems.get(s.sessionId);
      if (!sys) {
        const hue = Math.round(hashStr(s.project) * 360);
        const root = this.makeBody(s.sessionId, s.root, null, this.firstSync ? -99 : now, hue, 0);
        sys = { s, root, hue, fx: 0.5, fy: 0.5, tx: 0.5, ty: 0.5, belt: [], appear: this.firstSync ? -99 : now, labelA: 1 };
        // A session leaving its cluster starts where the cluster is.
        const from = [...this.clusters.values()].find((c) => c.info.project === s.project);
        if (from && !this.firstSync) { sys.fx = from.fx; sys.fy = from.fy; }
        this.systems.set(s.sessionId, sys);
      }
      sys.s = s;
      this.syncBody(sys, sys.root, s.root, now);
      const finished = Math.max(0, s.subagentsTotal - s.subagentsActive);
      const target = Math.min(240, finished);
      while (sys.belt.length < target) sys.belt.push(this.dust(this.firstSync || sys.belt.length < target - 3 ? -99 : now));
      if (sys.belt.length > target + 4) sys.belt.length = target;
    }
    for (const [id, sys] of this.systems) {
      if (!seen.has(id)) {
        this.systems.delete(id);
        for (const b of this.walk(sys.root)) this.bodies.delete(b.key);
        if ((this.focus.t === 'sys' || this.focus.t === 'agent') && this.focus.sessionId === id) this.setFocus({ t: 'none' });
      }
    }
    this.layout();
    this.firstSync = false;
  }

  private dust(born: number): Dust {
    return { ang: Math.random() * 6.283, r: (Math.random() - 0.5) * 8, s: 0.35 + Math.random() * 0.9, hs: (Math.random() - 0.5) * 70, a: 0.25 + Math.random() * 0.5, born };
  }

  private makeBody(sessionId: string, node: AgentNode, parent: Body | null, born: number, sysHue: number, slot: number): Body {
    const depth = parent ? parent.depth + 1 : 0;
    let branchSlot = slot;
    if (parent && depth > 1) {
      let b: Body = parent;
      while (b.depth > 1 && b.parent) b = b.parent;
      branchSlot = b.slot;
    }
    const b: Body = {
      key: `${sessionId}:${node.id}`, sessionId, node, depth, parent, children: [], slot,
      ang: Math.random() * 6.283,
      speed: depth === 1 ? 0.42 / (1 + slot * 0.35) : depth === 2 ? 1.2 / (1 + slot * 0.3) : 2.2,
      born, ret: null, flare: -9, flareLabel: '', absorb: -9,
      col: branchCol(sysHue, depth, branchSlot, depth > 1 ? slot : 0), _f: -1, _p: [0, 0],
    };
    this.bodies.set(b.key, b);
    if (parent) parent.children.push(b);
    return b;
  }

  private freeSlot(parent: Body) {
    const used = new Set(parent.children.filter((c) => c.ret === null).map((c) => c.slot));
    let s = 0;
    while (used.has(s)) s++;
    return s;
  }

  private syncBody(sys: Sys, body: Body, node: AgentNode, now: number) {
    if (body.node.currentTool !== node.currentTool && node.currentTool && !this.firstSync && now - body.flare > 0.9) {
      body.flare = now;
      body.flareLabel = node.currentTool;
    }
    body.node = node;
    const ids = new Set(node.children.map((c) => c.id));
    for (const child of node.children) {
      const key = `${body.sessionId}:${child.id}`;
      let cb = this.bodies.get(key);
      if (!cb) cb = this.makeBody(body.sessionId, child, body, this.firstSync ? -99 : now, sys.hue, this.freeSlot(body));
      if (cb.ret !== null) cb.ret = null;
      this.syncBody(sys, cb, child, now);
    }
    for (const c of body.children) if (!ids.has(c.node.id) && c.ret === null && now - c.born > 1.3) c.ret = now;
  }

  private *walk(b: Body): Generator<Body> {
    yield b;
    for (const c of b.children) yield* this.walk(c);
  }

  /**
   * Layout: projects on a sunflower spiral in a stable order (by name); a project's bodies (its cluster
   * first, then its stars by start time) on a ring around the project's spot. The ring grows with the
   * number and size of bodies so neighbours never overlap. Positions depend only on membership, so they
   * do not jump between polls.
   */
  private layout() {
    const groups = new Map<string, { clu: Clu | null; stars: Sys[] }>();
    const g = (p: string) => groups.get(p) ?? (groups.set(p, { clu: null, stars: [] }), groups.get(p)!);
    for (const c of this.clusters.values()) g(c.info.project).clu = c;
    for (const s of this.systems.values()) g(s.s.project).stars.push(s);
    const names = [...groups.keys()].sort((a, b) => a.localeCompare(b));
    const n = names.length;
    const W = Math.max(1, this.W), H = Math.max(1, this.H), u = this.U;
    const plans = names.map((name, i) => {
      const grp = groups.get(name)!;
      const r = n === 1 ? 0 : Math.sqrt((i + 0.6) / n) * 0.4;
      const a = i * 2.39996 + 0.6;
      grp.stars.sort((x, y) => x.s.startedAt - y.s.startedAt || x.s.sessionId.localeCompare(y.s.sessionId));
      const members: (Clu | Sys)[] = [...(grp.clu ? [grp.clu] : []), ...grp.stars];
      const sizes = members.map((m) => ('info' in m ? this.cluR(m) * 1.1 : Math.max(this.starR(m) * 1.8, 12 * u)));
      const R = ringRadius(sizes, 38 * u, 30 * u);
      // Footprint: the ring, its biggest body and room for the labels around it.
      const foot = R + Math.max(...sizes) + 34 * u;
      return { i, members, R, disc: { x: (0.5 + r * Math.cos(a) * 0.98) * W, y: (0.53 + r * Math.sin(a) * 0.82) * H, r: foot } };
    });
    // Groups never overlap: a big ring pushes its neighbours away instead of swallowing them.
    const discs = relaxGroups(plans.map((p) => p.disc), { left: 12, top: Math.min(H * 0.14, 110), right: W - 12, bottom: H - 36 });
    plans.forEach((p, k) => {
      const { x: gx, y: gy } = discs[k];
      p.members.forEach((m, j) => {
        const aa = (j / p.members.length) * 6.283 + p.i;
        const tx = clamp((gx + Math.cos(aa) * p.R) / W, 0.02, 0.98);
        const ty = clamp((gy + Math.sin(aa) * p.R) / H, 0.1, 0.96);
        m.tx = tx;
        m.ty = ty;
        if (m.fx === 0.5 && m.fy === 0.5 && m.appear === -99) { m.fx = tx; m.fy = ty; }
      });
    });
  }

  /* ---------- events ---------- */

  pushEvent(e: ClorbitEvent) {
    const now = this.T;
    const fp = this.folded.get(e.sessionId);
    if (fp) {
      const c = this.clusters.get(fp);
      if (c && (e.kind === 'tool' || e.kind === 'spawn' || e.kind === 'prompt')) c.flare = now;
      return;
    }
    if (e.kind === 'tool') {
      const b = this.bodies.get(`${e.sessionId}:${e.agentId}`);
      if (b) { b.flare = now; b.flareLabel = e.label; }
    } else if (e.kind === 'spawn') {
      const parent = this.bodies.get(`${e.sessionId}:${e.parentId}`);
      const sys = this.systems.get(e.sessionId);
      if (parent && sys && !this.bodies.has(`${e.sessionId}:${e.agentId}`)) {
        const node: AgentNode = {
          id: e.agentId, type: e.agentType, description: e.description, depth: parent.depth + 1, status: 'working',
          model: null, effort: null, currentTool: null, lastText: null, startedAt: e.ts, lastActivity: e.ts,
          tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, toolCalls: 0, finishedChildren: 0, children: [],
        };
        this.makeBody(e.sessionId, node, parent, now, sys.hue, this.freeSlot(parent));
        parent.flare = now;
        parent.flareLabel = `Agent → ${e.agentType}`;
      }
    } else if (e.kind === 'finish') {
      const b = this.bodies.get(`${e.sessionId}:${e.agentId}`);
      if (b && b.ret === null && b.depth > 0) b.ret = now;
    } else if (e.kind === 'prompt' || e.kind === 'compact') {
      const sys = this.systems.get(e.sessionId);
      if (sys) sys.root.absorb = now;
    } else if (e.kind === 'status') {
      const sys = this.systems.get(e.sessionId);
      if (sys) sys.s = { ...sys.s, status: e.status, statusReason: e.reason };
    }
  }

  /* ---------- geometry ---------- */

  /** World scale for the screen size, so a system does not get lost on a large monitor. */
  private get U() { return clamp(Math.min(this.W, this.H) / 560, 1, 1.7); }
  private starR(sys: Sys) {
    const k = Math.log10(1 + sys.s.tokens24h / 1000);
    return clamp(5 + k * 1.7, 5, 14) * (sys.s.alive ? 1 : 0.8) * this.U;
  }
  private orbR(b: Body, sys: Sys) {
    const u = this.U;
    return b.depth === 1 ? this.starR(sys) + (14 + b.slot * 10) * u : b.depth === 2 ? (3.6 + b.slot * 2.2) * u : (1.9 + b.slot * 1.1) * u;
  }
  private bodyR(b: Body, sys: Sys) {
    return b.depth === 0 ? this.starR(sys) : (b.depth === 1 ? 2.4 : b.depth === 2 ? 1.25 : 0.75) * this.U;
  }
  /** A cluster's radius: grows with the tokens of its sessions over 24 h. */
  private cluR(c: Clu) {
    const k = Math.log10(1 + c.info.tokens24h / 1000);
    return clamp(11 + k * 3.2, 12, 34) * this.U;
  }
  private beltR(sys: Sys) {
    return this.starR(sys) + 54 * this.U;
  }
  private pos(b: Body): P {
    if (b._f === this.frameN) return b._p;
    const sys = this.systems.get(b.sessionId)!;
    let o: P;
    if (!b.parent) o = [sys.fx * this.W, sys.fy * this.H];
    else {
      const pp = this.pos(b.parent);
      const R = this.orbR(b, sys);
      o = [pp[0] + Math.cos(b.ang) * R, pp[1] + Math.sin(b.ang) * R * 0.42];
      const bb = clamp((this.T - b.born) / 1.3, 0, 1);
      if (bb < 1) o = lerp2(pp, o, eOut(bb));
      if (b.ret !== null) o = lerp2(o, pp, eIn(clamp((this.T - b.ret) / 1.5, 0, 1)));
    }
    b._f = this.frameN;
    b._p = o;
    return o;
  }
  private S(w: P): P {
    return [(w[0] - this.cam.x) * this.cam.s + this.W / 2, (w[1] - this.cam.y) * this.cam.s + this.H / 2];
  }

  /* ---------- manual camera ---------- */

  private static readonly MIN_S = 0.35;
  private static readonly MAX_S = 40;

  private camTarget() {
    const b = this.baseTarget();
    return { x: b.x + this.pan.x, y: b.y + this.pan.y, s: clamp(b.s * this.zoomMul, GalaxyEngine.MIN_S, GalaxyEngine.MAX_S) };
  }

  /** Zoom keeping the world point under (mx, my) fixed; instant, so it feels direct. */
  private zoomAt(mx: number, my: number, factor: number) {
    const b = this.baseTarget();
    const s0 = this.cam.s;
    const s1 = clamp(s0 * factor, GalaxyEngine.MIN_S, GalaxyEngine.MAX_S);
    const wx = (mx - this.W / 2) / s0 + this.cam.x;
    const wy = (my - this.H / 2) / s0 + this.cam.y;
    const cx = wx - (mx - this.W / 2) / s1;
    const cy = wy - (my - this.H / 2) / s1;
    this.zoomMul = s1 / b.s;
    this.pan = { x: cx - b.x, y: cy - b.y };
    this.cam.x = cx;
    this.cam.y = cy;
    this.cam.s = s1;
    this.lastUser = this.T;
  }

  /** Smooth zoom around the screen centre (buttons, keyboard). */
  zoomBy(factor: number) {
    const b = this.baseTarget();
    const cur = this.camTarget();
    const s1 = clamp(cur.s * factor, GalaxyEngine.MIN_S, GalaxyEngine.MAX_S);
    this.zoomMul = s1 / b.s;
    this.lastUser = this.T;
  }

  /** Back to the automatic framing of the current focus. */
  resetView() {
    this.pan = { x: 0, y: 0 };
    this.zoomMul = 1;
    this.lastUser = this.T;
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    const unit = e.deltaMode === 1 ? 16 : 1;
    const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.012 : 0.0018));
    this.zoomAt(e.clientX - r.left, e.clientY - r.top, factor);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.drag = { lastX: e.clientX, lastY: e.clientY, dist: 0 };
  };

  private hitAt(mx: number, my: number): Hit | null {
    let best: Hit | null = null;
    let bd = 1e9;
    for (const h of this.hits) {
      const d = Math.hypot(h.x - mx, h.y - my);
      if (d < h.r && d / h.r < bd) { bd = d / h.r; best = h; }
    }
    return best;
  }

  private onLeave = () => {
    if (!this.drag) { this.hover = null; this.canvas.style.cursor = ''; }
  };

  private onPointerMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d) {
      if (e.target !== this.canvas) return;
      const r = this.canvas.getBoundingClientRect();
      const h = this.hitAt(e.clientX - r.left, e.clientY - r.top);
      this.hover = h ? (h.clu ? h.clu.key : h.body ? h.body.key : h.sys!.s.sessionId) : null;
      this.canvas.style.cursor = h ? 'pointer' : '';
      return;
    }
    const dx = e.clientX - d.lastX, dy = e.clientY - d.lastY;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.dist += Math.abs(dx) + Math.abs(dy);
    if (d.dist < 5) return;
    this.canvas.style.cursor = 'grabbing';
    const s = this.cam.s;
    this.pan.x -= dx / s;
    this.pan.y -= dy / s;
    this.cam.x -= dx / s;
    this.cam.y -= dy / s;
    this.lastUser = this.T;
  };

  private onPointerUp = () => {
    if (this.drag && this.drag.dist >= 5) this.suppressClick = true;
    this.drag = null;
    this.canvas.style.cursor = '';
  };

  private onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') this.zoomBy(1.3);
    else if (e.key === '-' || e.key === '_') this.zoomBy(1 / 1.3);
    else if (e.key === '0') this.resetView();
    else if (e.key === 'Escape') this.up(true);
    else return;
    e.preventDefault();
  };

  private baseTarget() {
    const panel = 200;
    if (this.focus.t === 'sys') {
      const sys = this.systems.get(this.focus.sessionId);
      if (sys) { const c = this.pos(sys.root); return { x: c[0] + panel / 4.2, y: c[1], s: 4.2 }; }
    }
    if (this.focus.t === 'cluster') {
      const c = this.clusters.get(this.focus.project);
      if (c) return { x: c.fx * this.W + panel / 3, y: c.fy * this.H, s: 3 };
    }
    if (this.focus.t === 'agent') {
      const b = this.bodies.get(`${this.focus.sessionId}:${this.focus.agentId}`);
      if (b) { const c = this.pos(b); const s = b.depth <= 1 ? 9 : 14; return { x: c[0] + panel / s, y: c[1], s }; }
    }
    return { x: this.W / 2, y: this.H / 2, s: 1 };
  }

  private onClick = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    this.lastUser = this.T;
    if (this.suppressClick) { this.suppressClick = false; return; }
    const best = this.hitAt(mx, my);
    const f = this.focus;
    if (!best && f.t === 'none') {
      const d = this.distantHits.find((h) => Math.hypot(h.x - mx, h.y - my) < 16);
      if (d) return this.cb.onDistant?.(d.name);
    }
    if (best?.clu) {
      if (f.t === 'cluster' && f.project === best.clu.info.project) return this.up(true);
      return this.setFocus({ t: 'cluster', project: best.clu.info.project }, true);
    }
    const sys = best?.sys;
    if (best && sys && f.t === 'none') return this.setFocus({ t: 'sys', sessionId: sys.s.sessionId }, true);
    if (sys && best?.body && best.body.depth > 0) return this.setFocus({ t: 'agent', sessionId: sys.s.sessionId, agentId: best.body.node.id }, true);
    if (sys && !(f.t === 'sys' && f.sessionId === sys.s.sessionId) && !best?.body) return this.setFocus({ t: 'sys', sessionId: sys.s.sessionId }, true);
    this.up(true);
  };

  up(user = false) {
    const f = this.focus;
    if (f.t === 'agent') {
      const b = this.bodies.get(`${f.sessionId}:${f.agentId}`);
      const p = b?.parent;
      if (p && p.depth > 0) this.setFocus({ t: 'agent', sessionId: f.sessionId, agentId: p.node.id }, user);
      else this.setFocus({ t: 'sys', sessionId: f.sessionId }, user);
    } else this.setFocus({ t: 'none' }, user);
  }

  /** Auto tour while the user is idle: shows the most active systems. */
  private tour() {
    const live = [...this.systems.values()].filter((s) => s.s.alive).sort((a, b) => b.s.subagentsActive - a.s.subagentsActive || b.s.lastActivity - a.s.lastActivity);
    if (!live.length) return;
    const step = this.tourI++ % 4;
    const sys = live[Math.floor(this.tourI / 4) % Math.min(3, live.length)];
    if (step === 0) this.setFocus({ t: 'sys', sessionId: sys.s.sessionId });
    else if (step === 1) {
      const c = sys.root.children.filter((b) => b.ret === null).sort((a, b) => b.children.length - a.children.length)[0];
      if (c) this.setFocus({ t: 'agent', sessionId: sys.s.sessionId, agentId: c.node.id });
      else this.tourI++;
    } else if (step === 2) this.setFocus({ t: 'sys', sessionId: sys.s.sessionId });
    else this.setFocus({ t: 'none' });
  }

  /* ---------- frame ---------- */

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - this.T);
    this.T = now;
    this.A += dt * (this.reduceMotion ? 0.08 : 1);
    this.frameN++;
    this.dt = dt;
    if (this.needSync && this.lastSnap) { this.needSync = false; this.sync(this.lastSnap); }
    if (this.tourOn && this.T - this.lastUser > 25 && this.T - this.lastTour > 5) { this.lastTour = this.T; this.tour(); }
    this.step(dt);
    this.draw();
  };

  private step(dt: number) {
    const ts = this.focus.t === 'agent' ? 0.25 : this.focus.t === 'sys' ? 0.45 : 1;
    this.timeScale += (ts - this.timeScale) * Math.min(1, dt * 2);
    for (const c of this.clusters.values()) {
      c.fx += (c.tx - c.fx) * Math.min(1, dt * 1.5);
      c.fy += (c.ty - c.fy) * Math.min(1, dt * 1.5);
    }
    for (const sys of this.systems.values()) {
      sys.fx += (sys.tx - sys.fx) * Math.min(1, dt * 1.5);
      sys.fy += (sys.ty - sys.fy) * Math.min(1, dt * 1.5);
      for (const b of [...this.walk(sys.root)]) {
        const working = b.node.status === 'working';
        b.ang += dt * b.speed * this.timeScale * (b.ret !== null ? 3 : 1) * (working ? 1 : 0.35) * (this.reduceMotion ? 0.12 : 1);
        if (b.ret !== null && this.T - b.ret > 1.5 && b.parent) {
          const p = b.parent;
          p.children.splice(p.children.indexOf(b), 1);
          for (const x of this.walk(b)) this.bodies.delete(x.key);
          p.absorb = this.T;
          sys.belt.push(this.dust(this.T));
          const f = this.focus;
          if (f.t === 'agent' && f.agentId === b.node.id && f.sessionId === sys.s.sessionId) this.up();
        }
      }
    }
    const tg = this.camTarget();
    if (!this.camInit) { Object.assign(this.cam, tg); this.camInit = true; }
    const f = this.reduceMotion && !this.drag ? 1 : 1 - Math.exp(-dt * 3.2);
    this.cam.x += (tg.x - this.cam.x) * f;
    this.cam.y += (tg.y - this.cam.y) * f;
    this.cam.s *= Math.pow(tg.s / this.cam.s, f);
  }

  private background() {
    const { ctx, W, H, cam, A } = this;
    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, W, H);
    const neb: [number, number, string][] = [[0.22, 0.32, '#3a1d6e'], [0.74, 0.64, '#0c3d5e'], [0.52, 0.12, '#1a2a5a'], [0.08, 0.82, '#2a1450'], [0.9, 0.2, '#123a4a']];
    neb.forEach(([x, y, c], i) => {
      const sx = x * W - (cam.x - W / 2) * 0.15, sy = y * H - (cam.y - H / 2) * 0.15, r = W * 0.42;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, hexA(c, 0.3 + 0.05 * Math.sin(A * 0.3 + i)));
      g.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
    const lk = Math.log(cam.s);
    for (const s of this.stars) {
      const k = 1 + lk * s.z * 0.25;
      const x = ((((s.x * W - (cam.x - W / 2) * s.z * 0.5) - W / 2) * k) % W + W * 1.5) % W;
      const y = ((((s.y * H - (cam.y - H / 2) * s.z * 0.5) - H / 2) * k) % H + H * 1.5) % H;
      ctx.fillStyle = `rgba(220,230,255,${0.18 + 0.6 * s.s * (0.6 + 0.4 * Math.sin(A * 2 + s.x * 40))})`;
      const z = s.z * 1.5 + 0.4;
      ctx.fillRect(x, y, z, z);
    }
  }

  /** Distant projects at the galaxy's edge: brightness is tokens over 30 days. */
  private drawDistant(z1: number) {
    const { ctx, W, H, A, cam } = this;
    this.distantHits = [];
    const live = new Set([...this.systems.values()].map((s) => s.s.project).concat([...this.clusters.keys()]));
    const a = 1 - z1;
    if (a < 0.03) return;
    for (const d of this.distant) {
      if (live.has(d.name)) continue;
      const x = W / 2 + Math.cos(d.ang) * d.rr * W * 1.05 - (cam.x - W / 2) * 0.35;
      const y = H * 0.53 + Math.sin(d.ang) * d.rr * H * 1.05 - (cam.y - H / 2) * 0.35;
      if (x < 10 || x > W - 10 || y < 90 || y > H - 20) continue;
      const hue = Math.round(hashStr(d.name) * 360);
      const r = 1.2 + d.tw * 2.6;
      ctx.save();
      ctx.globalAlpha = a;
      this.glow(x, y, r * 5, { h: hue, s: 70, l: 75 }, 0.35 + 0.25 * d.tw + 0.08 * Math.sin(A * 1.3 + d.ang * 7));
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.fill();
      ctx.font = `11px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(170,182,206,.78)';
      ctx.fillText(short(d.name, 22), x, y + r + 12);
      ctx.restore();
      this.distantHits.push({ x, y, name: d.name });
    }
  }

  private glow(x: number, y: number, r: number, col: Col | string, a: number) {
    const g = this.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, cA(col, a));
    g.addColorStop(0.3, cA(col, a * 0.3));
    g.addColorStop(1, cA(col, 0));
    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, 7);
    this.ctx.fill();
  }

  private placed: { x: number; y: number; w: number; h: number }[] = [];
  private label(x: number, y: number, lines: string[], col: Col | string, alpha: number, center = false) {
    if (alpha <= 0.02) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `500 12px ${MONO}`;
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14;
    const h = lines.length * 16 + 9;
    const bx = center ? x - w / 2 : x;
    let by = y - h;
    for (let guard = 0; guard < 12; guard++) {
      const hit = this.placed.find((r) => bx < r.x + r.w + 4 && bx + w + 4 > r.x && by < r.y + r.h + 3 && by + h + 3 > r.y);
      if (!hit) break;
      by = hit.y + hit.h + 4;
    }
    this.placed.push({ x: bx, y: by, w, h });
    ctx.fillStyle = 'rgba(6,9,16,.84)';
    ctx.strokeStyle = cA(col, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, 6);
    ctx.fill();
    ctx.stroke();
    lines.forEach((l, i) => { ctx.fillStyle = i ? '#BAC4D6' : '#F2F5FB'; ctx.fillText(l, bx + 7, by + 17 + i * 16); });
    ctx.restore();
  }

  private colOf(b: Body): Col | string {
    if (b.ret !== null) return { h: b.col.h, s: 45, l: 90 };
    if (b.node.status === 'idle' || b.node.status === 'done') return { h: b.col.h, s: 14, l: 64 };
    return b.col;
  }

  private drawBody(sys: Sys, b: Body, x: number, y: number, k: number, labelAlpha: number) {
    const { ctx, T, A } = this;
    const c = this.colOf(b);
    const st = b.depth === 0 ? sys.s.status : b.node.status;
    const act = st === 'working' ? 1 : st === 'waiting' ? 0.8 : sys.s.alive ? 0.4 : 0.18;
    const R0 = Math.max(4, this.bodyR(b, sys) * k);
    if (b.depth === 0) {
      const r0 = this.starR(sys) * k;
      const r = Math.min(r0, 30 + r0 * 0.25);
      const pulse = st === 'working' ? 1 + 0.09 * Math.sin(A * 3 + hashStr(b.key) * 9) : st === 'waiting' ? 1 + 0.16 * Math.max(0, Math.sin(A * 5)) : 1;
      this.glow(x, y, r * (2.2 + 1.4 / Math.sqrt(k)) * pulse, c, 0.9 * act + 0.06);
      if (st === 'working') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(A * 0.18 + hashStr(b.key) * 6);
        ctx.strokeStyle = cA(c, 0.22); ctx.lineWidth = 1;
        for (let q = 0; q < 6; q++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(r * 0.8, 0); ctx.lineTo(r * (2.1 + 0.5 * Math.sin(A * 4 + q)), 0); ctx.stroke(); }
        ctx.restore();
      }
      ctx.fillStyle = cA('#ffffff', 0.45 + 0.55 * act);
      ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, 7); ctx.fill();
      // Context fill ring
      const s = sys.s;
      if (s.contextTokens && s.contextLimit) {
        const f = clamp(s.contextTokens / s.contextLimit, 0, 1);
        const rr = r * 0.5 + Math.max(3, r * 0.28);
        ctx.lineWidth = Math.max(1.2, k * 0.5);
        ctx.strokeStyle = 'rgba(160,180,230,.12)';
        ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.stroke();
        ctx.strokeStyle = f > 0.85 ? 'rgba(255,107,139,.95)' : cA({ h: sys.hue, s: 95, l: 82 }, 0.9);
        ctx.beginPath(); ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + f * 6.283); ctx.stroke();
      }
    } else {
      const grow = b.ret !== null ? 1 - 0.7 * clamp((T - b.ret) / 1.5, 0, 1) : clamp((T - b.born) / 1.3, 0.15, 1);
      const rr = this.bodyR(b, sys) * k * grow;
      const r = Math.max(1.3, Math.min(rr, 9 + rr * 0.2));
      const sh = st === 'working' ? 1 + 0.14 * Math.sin(A * 6 + hashStr(b.key) * 9) : 1;
      this.glow(x, y, Math.max(5, r * 3.4 * sh), c, 0.85 * (st === 'working' ? 1 : 0.6));
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.9, r * 0.62), 0, 7); ctx.fill();
    }
    if (T - b.absorb < 0.9) {
      const f = (T - b.absorb) / 0.9;
      ctx.strokeStyle = cA('#DFFBFF', 1 - f); ctx.lineWidth = 2 * (1 - f) + 0.5;
      ctx.beginPath(); ctx.arc(x, y, R0 * (1.2 + f * 2.6), 0, 7); ctx.stroke();
    }
    if (st === 'waiting') {
      for (let q = 0; q < 2; q++) {
        const ph = (A * 0.6 + q * 0.5) % 1;
        ctx.strokeStyle = hexA(WAIT, (1 - ph) * 0.9); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(x, y, R0 * (1 + ph * 4), R0 * (1 + ph * 4) * 0.6, 0, 0, 7); ctx.stroke();
      }
    }
    const f = (T - b.flare) / 0.85;
    if (f < 1) {
      ctx.save(); ctx.translate(x, y); ctx.rotate((Math.PI / 4) * (hashStr(b.key) > 0.5 ? 1 : 0));
      ctx.strokeStyle = cA('#F2FDFF', 1 - f); ctx.lineWidth = 1.2;
      const L = (b.depth ? R0 : Math.min(R0, 18)) * (1.3 + 2.5 * eOut(f));
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.moveTo(0, -L); ctx.lineTo(0, L); ctx.stroke();
      ctx.restore();
      if (labelAlpha > 0.05 && b.flareLabel) {
        ctx.save(); ctx.globalAlpha = (1 - f) * labelAlpha; ctx.font = `500 11.5px ${MONO}`; ctx.textAlign = 'center';
        ctx.fillStyle = '#DFF7FF'; ctx.fillText(short(b.flareLabel, 34), x, y - R0 - 10 - f * 14); ctx.restore();
      }
    }
  }

  private draw() {
    const { ctx, T, A } = this;
    this.background();
    const k = this.cam.s;
    const z1 = clamp((k - 1) / 3.2, 0, 1), z2 = clamp((k - 4.2) / 4.5, 0, 1);
    const focus = this.focus;
    const fKey = focus.t === 'none' ? null : focus.t === 'cluster' ? clusterKey(focus.project) : focus.sessionId;
    const fSys = focus.t === 'sys' || focus.t === 'agent' ? focus.sessionId : null;
    const fBody = focus.t === 'agent' ? this.bodies.get(`${focus.sessionId}:${focus.agentId}`) ?? null : null;
    this.hits = [];
    this.placed = [];
    this.drawDistant(z1);
    const cands: LabelCand[] = [];
    // Project groups: who speaks for a project (primary label) and how crowded it is.
    const groupStars = new Map<string, LiveSession[]>();
    for (const sys of this.systems.values()) {
      const l = groupStars.get(sys.s.project);
      if (l) l.push(sys.s);
      else groupStars.set(sys.s.project, [sys.s]);
    }
    const primary = new Set<string>();
    for (const l of groupStars.values()) { const p = primaryOf(l); if (p) primary.add(p); }
    for (const c of [...this.clusters.values()].sort((a, b) => a.fy - b.fy)) {
      const appear = clamp((T - c.appear) / 1.2, 0, 1);
      const alpha = (fKey && fKey !== c.key ? 1 - z1 * 0.82 : 1) * appear;
      this.drawCluster(c, k, alpha, fKey === c.key, cands, !groupStars.has(c.info.project));
    }
    const systems = [...this.systems.values()].sort((a, b) => a.fy - b.fy);
    for (const sys of systems) {
      const isF = fSys === sys.s.sessionId;
      const appear = clamp((T - sys.appear) / 1.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = (fKey && fKey !== sys.s.sessionId ? 1 - z1 * 0.82 : 1) * appear;
      const c = this.S(this.pos(sys.root));
      const sr = this.starR(sys);
      // belt of finished subagents
      for (const d of sys.belt) {
        const ang = d.ang + A * 0.035, R = (this.beltR(sys) + d.r) * k;
        const x = c[0] + Math.cos(ang) * R, y = c[1] + Math.sin(ang) * R * 0.42, s = Math.max(1.3, Math.min(2.8, d.s * k * 0.9));
        const nb = d.born > 0 ? clamp(1 - (T - d.born) / 2, 0, 1) : 0;
        ctx.fillStyle = cA(nb > 0 ? '#E8FCFF' : { h: (sys.hue + d.hs + 360) % 360, s: 60, l: 72 }, Math.min(1, d.a * 1.5) * (sys.s.alive ? 1 : 0.55) * (0.65 + 0.35 * Math.sin(A + d.ang * 9)) + nb);
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      const all = [...this.walk(sys.root)];
      // orbits
      for (const b of all) {
        if (!b.depth || (b.depth > 1 && k < 1.8)) continue;
        const pp = this.S(this.pos(b.parent!)), R = this.orbR(b, sys) * k;
        ctx.strokeStyle = cA(b.col, b.depth === 1 ? 0.16 : 0.1 + 0.08 * z2); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(pp[0], pp[1], R, R * 0.42, 0, 0, 7); ctx.stroke();
      }
      // result streams back to the parent
      for (const b of all) {
        if (!b.depth || b.node.status !== 'working' || b.ret !== null || T - b.born < 1.3) continue;
        const s0 = this.S(this.pos(b)), s1 = this.S(this.pos(b.parent!));
        for (let q = 0; q < 3; q++) {
          const f = (A * 0.6 + q / 3 + hashStr(b.key)) % 1;
          const m: P = [(s0[0] + s1[0]) / 2 + (s1[1] - s0[1]) * 0.25, (s0[1] + s1[1]) / 2 + (s0[0] - s1[0]) * 0.25];
          const x = (1 - f) * (1 - f) * s0[0] + 2 * (1 - f) * f * m[0] + f * f * s1[0];
          const y = (1 - f) * (1 - f) * s0[1] + 2 * (1 - f) * f * m[1] + f * f * s1[1];
          ctx.fillStyle = cA({ h: b.col.h, s: 90, l: 92 }, Math.sin(Math.PI * f) * (b.depth === 1 ? 1 : 0.5 + 0.5 * z1));
          ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, 0.35 * Math.sqrt(k) * (4 - b.depth)), 0, 7); ctx.fill();
        }
      }
      // birth comets
      for (const b of all) {
        if (!b.depth) continue;
        const bb = clamp((T - b.born) / 1.3, 0, 1);
        if (bb >= 1) continue;
        const s0 = this.S(this.pos(b.parent!)), s1 = this.S(this.pos(b));
        const g = ctx.createLinearGradient(s0[0], s0[1], s1[0], s1[1]);
        g.addColorStop(0, cA(b.col, 0)); g.addColorStop(1, cA({ h: b.col.h, s: 80, l: 92 }, 0.95 * (1 - bb)));
        ctx.strokeStyle = g; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
      }
      // trails
      for (const b of all) {
        if (!b.depth || b.ret !== null || T - b.born < 1.3 || (b.depth > 1 && k < 2.5)) continue;
        const pp = this.pos(b.parent!), R = this.orbR(b, sys), c2 = this.colOf(b);
        for (let q = 1; q <= 12; q++) {
          const an = b.ang - q * 0.07, s = this.S([pp[0] + Math.cos(an) * R, pp[1] + Math.sin(an) * R * 0.42]);
          ctx.fillStyle = cA(c2, 0.26 * (1 - q / 12));
          ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(0.6, Math.min(3.2, this.bodyR(b, sys) * k * 0.5) * (1 - q / 14)), 0, 7); ctx.fill();
        }
      }
      const bodies = all.map((b) => { const s = this.S(this.pos(b)); return { b, x: s[0], y: s[1] }; }).sort((u, v) => u.y - v.y);
      ctx.globalCompositeOperation = 'lighter';
      for (const { b, x, y } of bodies) {
        let la = 0;
        if (b.depth === 1) la = isF ? z1 : 0;
        else if (b.depth > 1) la = fBody && (b.parent === fBody || b === fBody || b.parent === fBody.parent) ? z2 : 0;
        this.drawBody(sys, b, x, y, k, la);
        this.hits.push(b.depth ? { x, y, r: Math.max(24, this.bodyR(b, sys) * k * 3), sys, body: b } : { x, y, r: Math.max(26, sr * k * 2.2), sys });
      }
      ctx.globalCompositeOperation = 'source-over';
      // The name label is placed after every body is drawn, by priority, so crowded groups stay readable.
      const nameA = (1 - z1 * (isF ? 1 : 0)) * ctx.globalAlpha;
      {
        const n = sys.s.subagentsActive;
        const waiting = sys.s.status === 'waiting';
        const sub = waiting ? t('gx.canvas.waiting') : n ? t('gx.canvas.subs', { active: n, done: sys.s.subagentsTotal - n }) : sys.s.alive ? (sys.s.status === 'working' ? t('gx.canvas.working') : t('gx.canvas.idle')) : t('gx.canvas.asleep');
        const isP = primary.has(sys.s.sessionId);
        // The group's primary star names the project; its siblings say which session they are.
        const lines: LabelLine[] = isP || (groupStars.get(sys.s.project)?.length ?? 1) < 2
          ? [{ text: sys.s.project, font: `600 13px ${MONO}`, color: sys.s.alive ? '#E3EAF7' : '#8792A8' }]
          : [{ text: short(sys.s.title ?? sys.s.name ?? sys.s.sessionId.slice(0, 8), 28), font: `500 12px ${MONO}`, color: sys.s.alive ? '#D5DDEB' : '#8792A8' }];
        lines.push({ text: sub, font: `11.5px ${MONO}`, color: waiting ? WAIT : '#A9B4C8' });
        if (isP && (sys.s.effort || sys.s.model)) lines.push({ text: [prettyModel(sys.s.model), sys.s.effort].filter(Boolean).join(' · '), font: `11.5px ${MONO}`, color: '#8D99B0' });
        const hovered = this.hover === sys.s.sessionId;
        const gs = (groupStars.get(sys.s.project)?.length ?? 1) + (this.clusters.has(sys.s.project) ? 1 : 0);
        const ob = clamp(sr * k * 0.9, 9, 34);
        cands.push({
          key: sys.s.sessionId, bx: c[0], by: c[1], br: sr * k * 1.5 + 9, ox: ob, oy: ob, lines, alpha: nameA, ent: sys,
          prio: hovered ? 7 : waiting ? 6 : isP ? (sys.s.alive ? 5 : 4) : sys.s.alive ? 2 : 1,
          must: isP || hovered || waiting || isF,
          want: labelWanted({ primary: isP, hovered, waiting, zoom: k, groupSize: gs }),
        });
      }
      if (isF) {
        for (const { b, x, y } of bodies) {
          if (!b.depth) continue;
          const lines = [`${b.node.type}${b.node.effort ? ' · ' + b.node.effort : ''}`, b.ret !== null ? t('gx.canvas.returning') : short(b.node.currentTool ?? t('gx.canvas.start'), 30)];
          if (b.node.finishedChildren) lines.push(t('gx.canvas.finishedN', { n: b.node.finishedChildren }));
          if (b.depth === 1 && focus.t === 'sys') this.label(x + 10, y - 8, lines, this.colOf(b), z1 * (1 - z2));
          if (fBody && (b === fBody || b.parent === fBody)) this.label(x + 12, y - 10, b === fBody ? [lines[0] + '  ◉', ...lines.slice(1)] : lines, this.colOf(b), z2);
        }
        if (focus.t === 'sys') {
          const s = sys.s;
          this.label(c[0], c[1] - sr * k * 1.4, [`${s.project} · ${prettyModel(s.model)}${s.effort ? ' · ' + s.effort : ''}`, short(s.root.currentTool ?? s.statusReason ?? '', 44)], { h: sys.hue, s: 90, l: 76 }, z1 * (1 - z2), true);
        }
      }
      ctx.restore();
    }
    this.placeLabels(cands);
  }

  /**
   * Name labels by priority. Each label tries below its body, then above, right and left (its last side
   * first, so it does not hop around), avoiding other labels and other bodies. High-priority labels are
   * always drawn (below, if nothing is free); the rest are skipped where there is no room. All fade.
   */
  private placeLabels(cands: LabelCand[]) {
    const { ctx } = this;
    type R = { x: number; y: number; w: number; h: number };
    const hit = (a: R, b: R) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const bodies = cands.map((c) => ({ key: c.key, r: { x: c.bx - c.ox, y: c.by - c.oy, w: c.ox * 2, h: c.oy * 2 } }));
    const rects: R[] = [];
    const ease = Math.min(1, this.dt * 7);
    cands.sort((a, b) => b.prio - a.prio || a.key.localeCompare(b.key));
    ctx.save();
    ctx.textAlign = 'center';
    for (const c of cands) {
      let w = 0;
      for (const l of c.lines) { ctx.font = l.font; w = Math.max(w, ctx.measureText(l.text).width); }
      const h = c.lines.length * 15 + 4;
      // Label centre x and top y for each side: below, above, right, left.
      const at = (pos: number): R => {
        const x = pos === 2 ? c.bx + c.ox + 8 + w / 2 : pos === 3 ? c.bx - c.ox - 8 - w / 2 : c.bx;
        const y = pos === 0 ? c.by + c.br - 4 : pos === 1 ? c.by - c.br - h + 2 : c.by - h / 2;
        return { x: x - w / 2 - 4, y, w: w + 8, h };
      };
      const free = (r: R) => !rects.some((o) => hit(r, o)) && !bodies.some((b) => b.key !== c.key && hit(r, b.r));
      const order = c.ent.labelPos != null ? [c.ent.labelPos, 0, 1, 2, 3] : [0, 1, 2, 3];
      let pos = -1;
      if (c.want && c.alpha > 0.02) for (const p of order) if (free(at(p))) { pos = p; break; }
      if (pos < 0 && c.want && c.must && c.alpha > 0.02) pos = c.ent.labelPos ?? 0;
      const vis = pos >= 0;
      if (vis) {
        rects.push(at(pos));
        if (pos !== c.ent.labelPos) {
          // Moving to another side: fade from zero there instead of jumping.
          if (c.ent.labelPos != null) c.ent.labelA = 0;
          c.ent.labelPos = pos;
        }
      }
      c.ent.labelA += ((vis ? 1 : 0) - c.ent.labelA) * ease;
      const a = c.alpha * c.ent.labelA;
      if (a <= 0.02 || c.ent.labelPos == null) continue;
      const r = at(c.ent.labelPos);
      const cx = r.x + r.w / 2;
      c.lines.forEach((l, i) => {
        ctx.font = l.font;
        ctx.fillStyle = cA(l.color, 0.95 * a);
        ctx.fillText(l.text, cx, r.y + 13 + (i === 0 ? 0 : 16 + (i - 1) * 15));
      });
    }
    ctx.restore();
  }

  /** A star cluster: a few small stars in a soft nebula; dashed ring when most of it is automated runs. */
  private drawCluster(c: Clu, k: number, alpha: number, isF: boolean, cands: LabelCand[], alone: boolean) {
    const { ctx, A, T } = this;
    const [sx, sy] = this.S([c.fx * this.W, c.fy * this.H]);
    const R0 = this.cluR(c) * k;
    const rr = Math.min(R0, 70 + R0 * 0.25);
    const info = c.info;
    const n = info.sessions.length;
    const auto = info.automated * 2 >= n;
    const col: Col = { h: c.hue, s: auto ? 38 : 62, l: 70 };
    const act = info.working ? 1 : info.live ? 0.65 : 0.35;
    const hov = this.hover === c.key;
    // Varying part first: FNV of strings that differ only at the end is poorly spread.
    const hr = (salt: string, i: number) => hashStr(`${i}|${salt}|${c.key}`);
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let q = 0; q < 3; q++) {
      const a = hr('n', q) * 6.283 + A * 0.012 * (q - 1);
      const d = rr * 0.38 * hr('d', q);
      this.glow(sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.7, rr * (1.35 + 0.35 * q), col, 0.18 + 0.1 * act + (hov || isF ? 0.08 : 0));
    }
    if (auto) {
      ctx.save();
      ctx.setLineDash([3, 6]);
      ctx.lineDashOffset = -A * 4;
      ctx.strokeStyle = cA(col, 0.3 + (hov ? 0.2 : 0));
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(sx, sy, rr * 1.18, rr * 0.74, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }
    if (isF) {
      ctx.strokeStyle = cA(col, 0.45); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(sx, sy, rr * 1.4, rr * 0.9, 0, 0, 7); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    const m = clamp(Math.round(2 + Math.log2(1 + n) * 1.2), 3, 10);
    const sk = clamp(Math.sqrt(k), 1, 3) * this.U;
    const flareI = Math.floor(hr('f', Math.floor(c.flare * 10)) * m);
    const ff = (T - c.flare) / 0.8;
    for (let i = 0; i < m; i++) {
      const dir = i % 2 ? 1 : -1;
      const ang = hr('a', i) * 6.283 + A * 0.03 * dir * (0.5 + hr('s', i));
      const dist = rr * (0.12 + 0.78 * Math.sqrt(hr('r', i)));
      const px = sx + Math.cos(ang) * dist, py = sy + Math.sin(ang) * dist * 0.7;
      const size = (1 + 1.6 * hr('z', i)) * sk;
      const tw = 0.55 + 0.45 * Math.sin(A * 1.6 + i * 1.7);
      const sc: Col = { h: (c.hue + (hr('h', i) - 0.5) * 50 + 360) % 360, s: auto ? 30 : 70, l: 82 };
      this.glow(px, py, size * 4.5, sc, 0.75 * tw * (0.6 + 0.4 * act));
      ctx.fillStyle = cA('#ffffff', 0.6 + 0.4 * tw);
      ctx.beginPath(); ctx.arc(px, py, Math.max(1.1, size * 0.6), 0, 7); ctx.fill();
      if (ff < 1 && i === flareI) {
        ctx.strokeStyle = cA('#F2FDFF', 1 - ff); ctx.lineWidth = 1;
        const L = size * (2 + 4 * eOut(ff));
        ctx.beginPath(); ctx.moveTo(px - L, py); ctx.lineTo(px + L, py); ctx.moveTo(px, py - L); ctx.lineTo(px, py + L); ctx.stroke();
      }
    }
    if (info.working) {
      const pulse = 1 + 0.12 * Math.sin(A * 3 + hashStr(c.key) * 9);
      this.glow(sx, sy, rr * 0.5 * pulse, { h: c.hue, s: 85, l: 80 }, 0.55);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (T - c.absorb < 0.9) {
      const f = (T - c.absorb) / 0.9;
      ctx.strokeStyle = cA('#DFFBFF', (1 - f) * 0.8); ctx.lineWidth = 1.5 * (1 - f) + 0.5;
      ctx.beginPath(); ctx.ellipse(sx, sy, rr * (0.8 + f * 1.4), rr * (0.8 + f * 1.4) * 0.7, 0, 0, 7); ctx.stroke();
    }
    ctx.restore();
    this.hits.push({ x: sx, y: sy, r: Math.max(28, rr * 1.25), clu: c });
    const lines: LabelLine[] = [{ text: `${info.project} · ${tp('gx.cluster.count', n)}`, font: `600 12.5px ${MONO}`, color: '#C9D2E3' }];
    const parts = [info.live ? tp('gx.cluster.running', info.live) : '', info.automated ? tp('gx.cluster.automated', info.automated) : ''].filter(Boolean);
    if (parts.length) lines.push({ text: parts.join(' · '), font: `11px ${MONO}`, color: '#8D99B0' });
    cands.push({
      key: c.key, bx: sx, by: sy, br: rr * 0.8 + 8, ox: rr * 1.05, oy: rr * 0.75, lines, alpha, ent: c,
      prio: hov ? 7 : alone ? 4 : 3, must: hov || isF || alone, want: true,
    });
  }
}

function rand(n: number) { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }
export function short(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
export function prettyModel(m: string | null) {
  if (!m) return '—';
  const x = m.replace(/^claude-/, '').replace(/\[1m\]$/, ' 1M');
  const mm = x.match(/^(opus|sonnet|haiku|fable)-(\d+)-(\d+)/i);
  return mm ? `${mm[1][0].toUpperCase()}${mm[1].slice(1)} ${mm[2]}.${mm[3]}` : x;
}
