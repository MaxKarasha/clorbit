// Notification sounds, synthesized with Web Audio (no audio files). Three themes, one sound per event:
//   Orbit   — soft sine bells with inharmonic partials;
//   Minimal — short filtered ticks and clicks;
//   Retro   — 8-bit square-wave blips through a low-pass, so they stay friendly.
// "Waiting for you" is the most noticeable sound of every theme (a repeated two-note figure).
import type { NotifyEventType, SoundTheme } from '@shared/api';

/** One synthesized voice; times in seconds relative to the start of the sound. */
export interface Voice {
  f: number;                 // frequency, Hz
  at: number;                // start
  dur: number;               // length to silence
  gain: number;              // peak, 0..1 before the master volume
  wave?: OscillatorType;     // default 'sine'
  attack?: number;           // default 5 ms
  glide?: number;            // end frequency (exponential glide)
  partials?: [number, number][]; // extra [ratio, gain] partials (bells)
  lowpass?: number;          // Hz
  noise?: boolean;           // a band-passed noise click at f instead of an oscillator
}

const BELL: [number, number][] = [[2.76, 0.16], [5.4, 0.05]];
const SOFT_BELL: [number, number][] = [[2.76, 0.1]];
const bell = (f: number, at: number, gain: number, dur = 1.1, partials = BELL): Voice => ({ f, at, dur, gain, partials, attack: 0.006 });
const tick = (f: number, at: number, gain = 0.32, dur = 0.07): Voice => ({ f, at, dur, gain, wave: 'triangle', attack: 0.002, lowpass: 6000 });
const click = (f: number, at: number, gain = 0.5): Voice => ({ f, at, dur: 0.035, gain, noise: true, attack: 0.001 });
const sq = (f: number, at: number, dur = 0.08, gain = 0.16, glide?: number): Voice => ({ f, at, dur, gain, wave: 'square', attack: 0.003, lowpass: 2600, glide });

// Note frequencies.
const N = { F4: 349.2, G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, B5: 987.8, C6: 1046.5, E6: 1318.5, G6: 1568 };

export const THEMES: Record<SoundTheme, Record<NotifyEventType, Voice[]>> = {
  orbit: {
    // Ding-dong, twice, the second softer: clearly "come here", never shrill.
    session_waiting: [bell(N.E5, 0, 0.5), bell(N.B5, 0.17, 0.45, 1.3), bell(N.E5, 0.72, 0.3), bell(N.B5, 0.89, 0.28, 1.4)],
    // A rising major arpeggio: something is ready.
    session_done: [bell(N.C5, 0, 0.3, 0.9), bell(N.E5, 0.09, 0.28, 0.9), bell(N.G5, 0.18, 0.28, 1), bell(N.C6, 0.27, 0.26, 1.2)],
    // One small, high "ting".
    subagent_finished: [bell(N.A5, 0, 0.2, 0.6, SOFT_BELL)],
    // A short rising whoosh.
    subagent_spawned: [{ f: 420, at: 0, dur: 0.38, gain: 0.12, glide: 900, attack: 0.04 }, bell(N.G6, 0.3, 0.06, 0.4, SOFT_BELL)],
    // Folding down: three descending notes.
    compaction: [bell(N.G5, 0, 0.22, 0.7), bell(N.D5, 0.12, 0.2, 0.7), bell(N.G4, 0.24, 0.2, 0.9)],
    // Low and minor: worth a look.
    context_high: [bell(N.A4, 0, 0.32, 0.8), bell(N.F4, 0.26, 0.3, 1)],
    limit_high: [bell(N.E5, 0, 0.28, 0.7), bell(N.C5, 0.18, 0.26, 0.7), bell(N.A4, 0.36, 0.26, 1)],
  },
  minimal: {
    session_waiting: [tick(1760, 0), tick(1760, 0.09), tick(1320, 0.42, 0.3), tick(1760, 0.51, 0.3)],
    session_done: [tick(1180, 0, 0.28), tick(1760, 0.07, 0.3)],
    subagent_finished: [tick(2350, 0, 0.18, 0.045)],
    subagent_spawned: [click(3200, 0, 0.35)],
    compaction: [tick(1600, 0, 0.26), tick(1060, 0.08, 0.24)],
    context_high: [tick(700, 0, 0.36, 0.09), tick(700, 0.13, 0.32, 0.09)],
    limit_high: [tick(940, 0, 0.3), tick(740, 0.1, 0.3), tick(560, 0.2, 0.3, 0.1)],
  },
  retro: {
    session_waiting: [sq(N.C6, 0), sq(N.G5, 0.09), sq(N.C6, 0.18), sq(N.G5, 0.45, 0.08, 0.13), sq(N.C6, 0.54, 0.08, 0.13), sq(N.E6, 0.63, 0.14, 0.13)],
    session_done: [sq(N.B5, 0, 0.07), sq(N.E6, 0.07, 0.32)],
    subagent_finished: [sq(N.G6, 0, 0.05, 0.1)],
    subagent_spawned: [sq(220, 0, 0.16, 0.1, 880)],
    compaction: [sq(880, 0, 0.24, 0.12, 220)],
    context_high: [sq(330, 0, 0.1, 0.16), sq(330, 0.14, 0.1, 0.16)],
    limit_high: [sq(N.G5, 0, 0.08), sq(N.E5, 0.09, 0.08), sq(N.C5, 0.18, 0.08), sq(N.G4, 0.27, 0.16)],
  },
};

/** Minimal gap between two sounds of the same event type; a burst collapses into one. */
export const THROTTLE_MS = 1200;

/** Pure throttle: returns whether to play now and updates `last`. */
export function shouldPlay(last: Map<NotifyEventType, number>, type: NotifyEventType, now: number, gap = THROTTLE_MS): boolean {
  const prev = last.get(type);
  if (prev != null && now - prev < gap) return false;
  last.set(type, now);
  return true;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const lastPlayed = new Map<NotifyEventType, number>();

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  return ctx;
}

/** Browsers start audio only after a user gesture: resume on the first one. */
export function unlockAudioOnGesture(): () => void {
  const go = () => {
    const c = audio();
    if (c && c.state === 'suspended') void c.resume().catch(() => {});
  };
  const opts = { capture: true, passive: true } as const;
  window.addEventListener('pointerdown', go, opts);
  window.addEventListener('keydown', go, opts);
  return () => {
    window.removeEventListener('pointerdown', go, opts);
    window.removeEventListener('keydown', go, opts);
  };
}

function voice(c: AudioContext, out: AudioNode, v: Voice, t0: number) {
  const start = t0 + v.at;
  const end = start + v.dur;
  const env = c.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(v.gain, start + (v.attack ?? 0.005));
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  let tail: AudioNode = env;
  if (v.lowpass) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = v.lowpass;
    env.connect(lp);
    tail = lp;
  }
  tail.connect(out);
  if (v.noise) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, Math.round(c.sampleRate * 0.1), c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = v.f;
    bp.Q.value = 2.5;
    src.connect(bp).connect(env);
    src.start(start);
    src.stop(end + 0.02);
    return;
  }
  for (const [ratio, g] of [[1, 1] as [number, number], ...(v.partials ?? [])]) {
    const osc = c.createOscillator();
    osc.type = v.wave ?? 'sine';
    osc.frequency.setValueAtTime(v.f * ratio, start);
    if (v.glide) osc.frequency.exponentialRampToValueAtTime(v.glide * ratio, end - 0.01);
    let node: AudioNode = osc;
    if (g !== 1) {
      const pg = c.createGain();
      pg.gain.value = g;
      osc.connect(pg);
      node = pg;
    }
    node.connect(env);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

/**
 * Plays the sound of an event. Throttled per event type unless `force` (previews).
 * Returns false when nothing was played (throttled, no audio, or the context is still locked).
 */
export function playSound(type: NotifyEventType, theme: SoundTheme, volume: number, force = false): boolean {
  if (!force && !shouldPlay(lastPlayed, type, Date.now())) return false;
  const c = audio();
  if (!c || !master) return false;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  if (c.state !== 'running' && !force) return false;
  // Perceived loudness is closer to the square of the slider.
  master.gain.setValueAtTime(Math.max(0, Math.min(1, volume)) ** 2 * 0.9, c.currentTime);
  const t0 = c.currentTime + 0.02;
  for (const v of THEMES[theme][type]) voice(c, master, v, t0);
  return true;
}
