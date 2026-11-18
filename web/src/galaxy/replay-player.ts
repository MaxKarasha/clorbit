// The replay clock: plays a SessionReplay into the galaxy engine and the event console.
// The scene at time t comes from shared/replay.ts (pure); this class only decides when to animate (playing
// forward) and when to snap (seeks, steps, jumps).
import type { LiveSnapshot, RecentEvent, ReplayEvent, SessionReplay } from '@shared/api';
import {
  autoRate, buildTimeMap, extractMarkers, nearestEventTs, nearestMarker, ReplayCursor, replaySession,
  type ReplayMarker, type TimeMap,
} from '@shared/replay';
import type { GalaxyEngine } from './engine';

export type Speed = 1 | 2 | 5 | 10 | 30 | 60 | 'auto';
export const SPEEDS: Speed[] = ['auto', 1, 2, 5, 10, 30, 60];

/** A seek or a frame that crosses more than this snaps instead of animating every birth. */
const SNAP_EVENTS = 1500;
/** Console lines kept when the scene is rebuilt for a moment. */
const CONSOLE_BACKLOG = 300;

export interface PlayerView {
  t: number;
  playing: boolean;
  speed: Speed;
  /** The effective rate (auto: the adaptive one). */
  rate: number;
  atEnd: boolean;
  version: number;
}

/** A replay event as a console event (names resolved from the replay itself). */
export function consoleEvent(e: ReplayEvent, r: SessionReplay, names: Map<string, { type: string; parent: string }>): RecentEvent | null {
  const base = { ts: e.ts, sessionId: r.sessionId, project: r.project };
  const name = (id: string | undefined) => (!id || id === 'main' ? null : names.get(id)?.type ?? null);
  switch (e.kind) {
    case 'tool': return { ...base, kind: 'tool', agentId: e.agentId, tool: '', label: e.label, agentName: name(e.agentId) };
    case 'spawn': return { ...base, kind: 'spawn', parentId: e.parentId, agentId: e.agentId, agentType: e.agentType, description: e.description, parentName: name(e.parentId) };
    case 'finish': {
      const parent = names.get(e.agentId)?.parent ?? 'main';
      return { ...base, kind: 'finish', agentId: e.agentId, parentId: parent, tokens: e.tokens, agentName: name(e.agentId), parentName: name(parent) };
    }
    case 'status': return e.status === 'waiting' ? { ...base, kind: 'status', status: 'waiting', reason: e.reason, code: e.code, arg: e.arg } : null;
    case 'prompt': return { ...base, kind: 'prompt' };
    case 'compact': return { ...base, kind: 'compact' };
    default: return null;
  }
}

export class ReplayPlayer {
  replay!: SessionReplay;
  private cursor!: ReplayCursor;
  map!: TimeMap;
  markers: ReplayMarker[] = [];
  private names = new Map<string, { type: string; parent: string }>();
  t = 0;
  playing = false;
  speed: Speed = 'auto';
  private raf = 0;
  private last = 0;
  private listeners = new Set<() => void>();
  private view: PlayerView;
  private lastEmit = 0;
  private pendingConsole: RecentEvent[] = [];
  private lastConsole = 0;
  /** Called on every frame with the play position (0..1): the scrubber moves its playhead without React. */
  onFrame: ((f: number) => void) | null = null;

  constructor(
    replay: SessionReplay,
    private eng: GalaxyEngine,
    private out: { console(lines: RecentEvent[], reset: boolean): void },
  ) {
    this.load(replay);
    this.t = replay.startedAt;
    this.view = this.makeView();
    this.render(true);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.listeners.clear();
  }

  private load(r: SessionReplay) {
    this.replay = r;
    this.cursor = new ReplayCursor(r);
    this.markers = extractMarkers(r.events);
    this.names.clear();
    for (const e of r.events) if (e.kind === 'spawn') this.names.set(e.agentId, { type: e.agentType, parent: e.parentId });
    this.autoDur = buildTimeMap(r.events.map((e) => e.ts), r.startedAt, r.endedAt, true).duration;
    this.remap();
  }
  private autoDur = 0;
  /** The rate "auto" plays at (also while another speed is chosen). */
  autoRateValue() { return autoRate(this.autoDur); }

  private remap() {
    const r = this.replay;
    this.map = buildTimeMap(r.events.map((e) => e.ts), r.startedAt, r.endedAt, this.speed === 'auto');
  }

  /** Follow live: a live session keeps playing at its end as new builds arrive (see update). */
  follow = false;

  /** A newer build of the same session (follow live): keeps the position and the scene, extends the end. */
  update(r: SessionReplay) {
    this.load(r);
    this.t = Math.min(this.t, r.endedAt);
    this.cursor.moveTo(this.t);
    this.eng.sync(this.snapshot());
    this.emit(true);
  }

  get rate(): number { return this.speed === 'auto' ? this.autoRateValue() : this.speed; }

  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => void this.listeners.delete(cb); };
  getView = () => this.view;
  private makeView(): PlayerView {
    return { t: this.t, playing: this.playing, speed: this.speed, rate: this.rate, atEnd: this.t >= this.replay.endedAt, version: (this.view?.version ?? 0) + 1 };
  }
  private emit(force = false) {
    const now = performance.now();
    if (!force && now - this.lastEmit < 200) return;
    this.lastEmit = now;
    this.view = this.makeView();
    this.listeners.forEach((l) => l());
  }

  /** Position on the track (0..1) of an original time. */
  frac(t = this.t) { return this.map.duration > 0 ? this.map.toPlay(t) / this.map.duration : 0; }
  /** Original time at a track position (0..1). */
  timeAt(f: number) { return this.map.toReal(Math.min(1, Math.max(0, f)) * this.map.duration); }

  play() {
    if (this.t >= this.replay.endedAt) this.seek(this.replay.startedAt);
    this.playing = true;
    this.last = performance.now();
    this.emit(true);
  }
  pause() { this.playing = false; this.emit(true); }
  toggle() { if (this.playing) this.pause(); else this.play(); }
  setSpeed(s: Speed) {
    this.speed = s;
    this.remap();
    this.emit(true);
  }
  /** Jumps to t: the scene is rebuilt for that moment at once. */
  seek(t: number) {
    this.t = Math.min(this.replay.endedAt, Math.max(this.replay.startedAt, t));
    this.render(true);
    this.emit(true);
  }
  /** ←/→: the previous / next event. */
  step(dir: 1 | -1) {
    this.pause();
    const ts = nearestEventTs(this.replay.events, this.t, dir);
    this.seek(ts ?? (dir > 0 ? this.replay.endedAt : this.replay.startedAt));
  }
  /** Shift+←/→: the previous / next marker (spawn, wait, compaction, prompt). */
  jump(dir: 1 | -1) {
    const m = nearestMarker(this.markers, this.t, dir);
    if (m) this.seek(m.ts);
    else this.seek(dir > 0 ? this.replay.endedAt : this.replay.startedAt);
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    const now = performance.now();
    const dt = Math.min(250, now - this.last);
    this.last = now;
    if (this.playing) {
      const r = this.replay;
      let t: number;
      if (this.speed === 'auto') t = this.map.toReal(this.map.toPlay(this.t) + dt * this.rate);
      else t = this.t + dt * this.speed;
      // At the end: stop, unless following a live session (it waits there for the next build).
      if (t >= r.endedAt) { t = r.endedAt; if (!(this.follow && r.live)) this.playing = false; }
      this.t = t;
      this.render(false);
      this.emit(!this.playing);
    }
    this.flushConsole(now);
    this.onFrame?.(this.frac());
  };

  /** The snapshot the engine draws at the current state. */
  snapshot(): LiveSnapshot {
    const s = replaySession(this.cursor.state, this.replay);
    s.lastActivity = Math.min(s.lastActivity, this.t);
    return {
      now: this.t, sessions: [s],
      totals: {
        tokens24h: s.tokens, tokensToday: s.tokens, burnPerMin: 0, burnSeries: [], activeSessions: 1,
        workingSessions: s.status === 'working' ? 1 : 0, waitingSessions: s.status === 'waiting' ? 1 : 0,
        workingSubagents: s.subagentsActive, finishedSubagents24h: s.subagentsTotal - s.subagentsActive, cacheHitRate24h: 0, projects24h: 1,
      },
      limits: null, hooksInstalled: true, statuslineCapture: false, scan: { done: true, filesTotal: 0, filesDone: 0 },
    };
  }
  get state() { return this.cursor.state; }

  /** Moves the cursor to this.t and updates the scene: animated going forward, rebuilt otherwise. */
  private render(snap: boolean) {
    const { crossed, snapped } = this.cursor.moveTo(this.t);
    const eng = this.eng;
    if (snap || snapped || crossed.length > SNAP_EVENTS) {
      eng.resetScene();
      eng.sync(this.snapshot());
      const f = eng.getFocus();
      if (f.t === 'agent' && !eng.hasBody(f.sessionId, f.agentId)) eng.setFocus({ t: 'sys', sessionId: f.sessionId });
      // The console shows what happened up to now.
      const lines: RecentEvent[] = [];
      const evs = this.replay.events;
      for (let i = this.cursor.state.next - 1; i >= 0 && lines.length < CONSOLE_BACKLOG; i--) {
        const c = consoleEvent(evs[i], this.replay, this.names);
        if (c) lines.push(c);
      }
      this.pendingConsole = [];
      this.out.console(lines.reverse(), true);
      return;
    }
    if (!crossed.length) return;
    eng.sync(this.snapshot());
    for (const e of crossed) {
      if (e.kind === 'prompt' || e.kind === 'compact') eng.pushEvent({ kind: e.kind, ts: e.ts, sessionId: this.replay.sessionId });
      const c = consoleEvent(e, this.replay, this.names);
      if (c) this.pendingConsole.push(c);
    }
  }

  /** Console lines go out a few times a second, not every frame (an open drawer re-renders its list). */
  private flushConsole(now: number) {
    if (!this.pendingConsole.length || now - this.lastConsole < 200) return;
    this.lastConsole = now;
    const lines = this.pendingConsole.length > CONSOLE_BACKLOG ? this.pendingConsole.slice(-CONSOLE_BACKLOG) : this.pendingConsole;
    this.pendingConsole = [];
    this.out.console(lines, false);
  }
}
