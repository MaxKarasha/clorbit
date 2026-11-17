// Galaxy engine: canvas scene, camera, animations. Data comes from outside (snapshot + events).
import type { AgentNode, ClorbitEvent, LiveSession, LiveSnapshot } from '@shared/api';
import { t } from '../i18n';

export type Col = { h: number; s: number; l: number };
export type Focus =
  | { t: 'none' }
  | { t: 'sys'; sessionId: string }
  | { t: 'agent'; sessionId: string; agentId: string };

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
  private frameN = 0;
  private raf = 0;
  private systems = new Map<string, Sys>();
  private bodies = new Map<string, Body>();
  private focus: Focus = { t: 'none' };
  private cam = { x: 0, y: 0, s: 1 };
  private camInit = false;
  private timeScale = 1;
  private hits: { x: number; y: number; r: number; sys: Sys; body?: Body }[] = [];
  private firstSync = true;
  private distant: (Distant & { ang: number; rr: number; tw: number })[] = [];
  private distantHits: { x: number; y: number; name: string }[] = [];
  private stars: { x: number; y: number; z: number; s: number }[];
  private ro: ResizeObserver;
  lastUser = -99;
  tourOn = true;
  private lastTour = 0;
  private tourI = 0;

  constructor(private canvas: HTMLCanvasElement, private cb: EngineCallbacks) {
    this.ctx = canvas.getContext('2d')!;
    this.stars = Array.from({ length: 420 }, (_, i) => ({ x: rand(i), y: rand(i + 500), z: rand(i + 900), s: rand(i + 1300) }));
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    canvas.addEventListener('click', this.onClick);
    this.lastUser = this.T;
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener('click', this.onClick);
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    const d = Math.min(2, devicePixelRatio || 1);
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(r.width * d);
    this.canvas.height = Math.round(r.height * d);
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
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

  setFocus(f: Focus, user = false) {
    if (user) this.lastUser = this.T;
    this.focus = f;
    this.cb.onFocus(f);
  }

  /* ---------- data sync ---------- */

  sync(snap: LiveSnapshot) {
    const now = this.T;
    const seen = new Set<string>();
    for (const s of snap.sessions) {
      seen.add(s.sessionId);
      let sys = this.systems.get(s.sessionId);
      if (!sys) {
        const hue = Math.round(hashStr(s.project) * 360);
        const root = this.makeBody(s.sessionId, s.root, null, this.firstSync ? -99 : now, hue, 0);
        sys = { s, root, hue, fx: 0.5, fy: 0.5, tx: 0.5, ty: 0.5, belt: [], appear: this.firstSync ? -99 : now };
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

  /** Layout: live sessions closer to the center, sessions of one project side by side (binary stars). */
  private layout() {
    const list = [...this.systems.values()].sort((a, b) => Number(b.s.alive) - Number(a.s.alive) || b.s.lastActivity - a.s.lastActivity);
    const byProject = new Map<string, Sys[]>();
    for (const s of list) {
      const arr = byProject.get(s.s.project) ?? [];
      arr.push(s);
      byProject.set(s.s.project, arr);
    }
    // Stable order by project name: stars do not jump when activity changes.
    const groups = [...byProject.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, g]) => g.sort((x, y) => x.s.startedAt - y.s.startedAt));
    const n = groups.length;
    groups.forEach((g, i) => {
      const r = n === 1 ? 0 : Math.sqrt((i + 0.6) / n) * 0.4;
      const a = i * 2.39996 + 0.6;
      const cx = 0.5 + r * Math.cos(a) * 0.98;
      const cy = 0.53 + r * Math.sin(a) * 0.82;
      g.forEach((s, j) => {
        const off = g.length > 1 ? 0.045 : 0;
        const aa = (j / g.length) * 6.283 + i;
        s.tx = clamp(cx + Math.cos(aa) * off, 0.07, 0.93);
        s.ty = clamp(cy + Math.sin(aa) * off * 1.3, 0.14, 0.86);
        if (s.fx === 0.5 && s.fy === 0.5 && s.appear === -99) { s.fx = s.tx; s.fy = s.ty; }
      });
    });
  }

  /* ---------- events ---------- */

  pushEvent(e: ClorbitEvent) {
    const now = this.T;
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

  private camTarget() {
    const panel = 200;
    if (this.focus.t === 'sys') {
      const sys = this.systems.get(this.focus.sessionId);
      if (sys) { const c = this.pos(sys.root); return { x: c[0] + panel / 4.2, y: c[1], s: 4.2 }; }
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
    let best: (typeof this.hits)[number] | null = null;
    let bd = 1e9;
    for (const h of this.hits) {
      const d = Math.hypot(h.x - mx, h.y - my);
      if (d < h.r && d / h.r < bd) { bd = d / h.r; best = h; }
    }
    const f = this.focus;
    if (!best && f.t === 'none') {
      const d = this.distantHits.find((h) => Math.hypot(h.x - mx, h.y - my) < 16);
      if (d) return this.cb.onDistant?.(d.name);
    }
    if (best && f.t === 'none') return this.setFocus({ t: 'sys', sessionId: best.sys.s.sessionId }, true);
    if (best?.body && best.body.depth > 0) return this.setFocus({ t: 'agent', sessionId: best.sys.s.sessionId, agentId: best.body.node.id }, true);
    if (best && !(f.t === 'sys' && f.sessionId === best.sys.s.sessionId) && !best.body) return this.setFocus({ t: 'sys', sessionId: best.sys.s.sessionId }, true);
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
    this.frameN++;
    if (this.tourOn && this.T - this.lastUser > 25 && this.T - this.lastTour > 5) { this.lastTour = this.T; this.tour(); }
    this.step(dt);
    this.draw();
  };

  private step(dt: number) {
    const ts = this.focus.t === 'agent' ? 0.25 : this.focus.t === 'sys' ? 0.45 : 1;
    this.timeScale += (ts - this.timeScale) * Math.min(1, dt * 2);
    for (const sys of this.systems.values()) {
      sys.fx += (sys.tx - sys.fx) * Math.min(1, dt * 1.5);
      sys.fy += (sys.ty - sys.fy) * Math.min(1, dt * 1.5);
      for (const b of [...this.walk(sys.root)]) {
        const working = b.node.status === 'working';
        b.ang += dt * b.speed * this.timeScale * (b.ret !== null ? 3 : 1) * (working ? 1 : 0.35);
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
    const f = 1 - Math.exp(-dt * 3.2);
    this.cam.x += (tg.x - this.cam.x) * f;
    this.cam.y += (tg.y - this.cam.y) * f;
    this.cam.s *= Math.pow(tg.s / this.cam.s, f);
  }

  private background() {
    const { ctx, W, H, cam, T } = this;
    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, W, H);
    const neb: [number, number, string][] = [[0.22, 0.32, '#3a1d6e'], [0.74, 0.64, '#0c3d5e'], [0.52, 0.12, '#1a2a5a'], [0.08, 0.82, '#2a1450'], [0.9, 0.2, '#123a4a']];
    neb.forEach(([x, y, c], i) => {
      const sx = x * W - (cam.x - W / 2) * 0.15, sy = y * H - (cam.y - H / 2) * 0.15, r = W * 0.42;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, hexA(c, 0.3 + 0.05 * Math.sin(T * 0.3 + i)));
      g.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
    const lk = Math.log(cam.s);
    for (const s of this.stars) {
      const k = 1 + lk * s.z * 0.25;
      const x = ((((s.x * W - (cam.x - W / 2) * s.z * 0.5) - W / 2) * k) % W + W * 1.5) % W;
      const y = ((((s.y * H - (cam.y - H / 2) * s.z * 0.5) - H / 2) * k) % H + H * 1.5) % H;
      ctx.fillStyle = `rgba(220,230,255,${0.18 + 0.6 * s.s * (0.6 + 0.4 * Math.sin(T * 2 + s.x * 40))})`;
      const z = s.z * 1.5 + 0.4;
      ctx.fillRect(x, y, z, z);
    }
  }

  /** Distant projects at the galaxy's edge: brightness is tokens over 30 days. */
  private drawDistant(z1: number) {
    const { ctx, W, H, T, cam } = this;
    this.distantHits = [];
    const live = new Set([...this.systems.values()].map((s) => s.s.project));
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
      this.glow(x, y, r * 5, { h: hue, s: 70, l: 75 }, 0.35 + 0.25 * d.tw + 0.08 * Math.sin(T * 1.3 + d.ang * 7));
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
    const { ctx, T } = this;
    const c = this.colOf(b);
    const st = b.depth === 0 ? sys.s.status : b.node.status;
    const act = st === 'working' ? 1 : st === 'waiting' ? 0.8 : sys.s.alive ? 0.4 : 0.18;
    const R0 = Math.max(4, this.bodyR(b, sys) * k);
    if (b.depth === 0) {
      const r0 = this.starR(sys) * k;
      const r = Math.min(r0, 30 + r0 * 0.25);
      const pulse = st === 'working' ? 1 + 0.09 * Math.sin(T * 3 + hashStr(b.key) * 9) : st === 'waiting' ? 1 + 0.16 * Math.max(0, Math.sin(T * 5)) : 1;
      this.glow(x, y, r * (2.2 + 1.4 / Math.sqrt(k)) * pulse, c, 0.9 * act + 0.06);
      if (st === 'working') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(T * 0.18 + hashStr(b.key) * 6);
        ctx.strokeStyle = cA(c, 0.22); ctx.lineWidth = 1;
        for (let q = 0; q < 6; q++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(r * 0.8, 0); ctx.lineTo(r * (2.1 + 0.5 * Math.sin(T * 4 + q)), 0); ctx.stroke(); }
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
      const sh = st === 'working' ? 1 + 0.14 * Math.sin(T * 6 + hashStr(b.key) * 9) : 1;
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
        const ph = (T * 0.6 + q * 0.5) % 1;
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
    const { ctx, T } = this;
    this.background();
    const k = this.cam.s;
    const z1 = clamp((k - 1) / 3.2, 0, 1), z2 = clamp((k - 4.2) / 4.5, 0, 1);
    const focus = this.focus;
    const fSys = focus.t === 'none' ? null : focus.sessionId;
    const fBody = focus.t === 'agent' ? this.bodies.get(`${focus.sessionId}:${focus.agentId}`) ?? null : null;
    this.hits = [];
    this.placed = [];
    this.drawDistant(z1);
    const systems = [...this.systems.values()].sort((a, b) => a.fy - b.fy);
    for (const sys of systems) {
      const isF = fSys === sys.s.sessionId;
      const appear = clamp((T - sys.appear) / 1.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = (fSys && !isF ? 1 - z1 * 0.82 : 1) * appear;
      const c = this.S(this.pos(sys.root));
      const sr = this.starR(sys);
      // belt of finished subagents
      for (const d of sys.belt) {
        const ang = d.ang + T * 0.035, R = (this.beltR(sys) + d.r) * k;
        const x = c[0] + Math.cos(ang) * R, y = c[1] + Math.sin(ang) * R * 0.42, s = Math.max(1.3, Math.min(2.8, d.s * k * 0.9));
        const nb = d.born > 0 ? clamp(1 - (T - d.born) / 2, 0, 1) : 0;
        ctx.fillStyle = cA(nb > 0 ? '#E8FCFF' : { h: (sys.hue + d.hs + 360) % 360, s: 60, l: 72 }, Math.min(1, d.a * 1.5) * (sys.s.alive ? 1 : 0.55) * (0.65 + 0.35 * Math.sin(T + d.ang * 9)) + nb);
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
          const f = (T * 0.6 + q / 3 + hashStr(b.key)) % 1;
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
        this.hits.push(b.depth ? { x, y, r: Math.max(24, this.bodyR(b, sys) * k * 3), sys, body: b } : { x, y, r: Math.max(34, sr * k * 2.2), sys });
      }
      ctx.globalCompositeOperation = 'source-over';
      // labels
      const nameA = 1 - z1 * (isF ? 1 : 0);
      if (nameA > 0.02) {
        const yy = c[1] + sr * k * 1.5 + 22;
        ctx.textAlign = 'center';
        ctx.font = `600 13px ${MONO}`;
        ctx.fillStyle = cA(sys.s.alive ? '#E3EAF7' : '#8792A8', 0.95 * nameA);
        ctx.fillText(sys.s.project, c[0], yy);
        ctx.font = `11.5px ${MONO}`;
        ctx.fillStyle = cA(sys.s.status === 'waiting' ? WAIT : '#A9B4C8', 0.95 * nameA);
        const n = sys.s.subagentsActive;
        const sub = sys.s.status === 'waiting' ? t('gx.canvas.waiting') : n ? t('gx.canvas.subs', { active: n, done: sys.s.subagentsTotal - n }) : sys.s.alive ? (sys.s.status === 'working' ? t('gx.canvas.working') : t('gx.canvas.idle')) : t('gx.canvas.asleep');
        ctx.fillText(sub, c[0], yy + 16);
        if (sys.s.effort || sys.s.model) {
          ctx.fillStyle = cA('#8D99B0', 0.9 * nameA);
          ctx.fillText([prettyModel(sys.s.model), sys.s.effort].filter(Boolean).join(' · '), c[0], yy + 31);
        }
        ctx.textAlign = 'left';
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
