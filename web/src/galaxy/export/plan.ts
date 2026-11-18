// Video export plan (pure): which original moment every frame shows, the title / run / end phases, and the
// caption toasts. Frame i is at video time i / fps exactly; nothing here reads a clock, so the same replay and
// settings always give the same schedule.
import type { ReplayEvent, SessionReplay } from '@shared/api';
import { buildTargetMap, type TimeMap } from '@shared/replay';
import { fpsFor, logicalSize, overlayLayout, presetsFor, type Aspect, type ExportFormat, type OverlayLayout, type SizePreset } from './layout';

export type TargetDuration = 15 | 30 | 60 | 'real';

export interface OverlayToggles { title: boolean; end: boolean; clock: boolean; counters: boolean; captions: boolean }
export const ALL_OVERLAYS: OverlayToggles = { title: true, end: true, clock: true, counters: true, captions: true };

export interface ExportSettings {
  format: ExportFormat;
  /** A preset id of the format (layout.ts). */
  size: string;
  /** Original-time range; null: the whole session. */
  range: { from: number; to: number } | null;
  target: TargetDuration;
  overlays: OverlayToggles;
  anonymize: boolean;
}

/** Title card length, ms. */
export const TITLE_MS = 2400;
/** End card length, ms (without it: a short hold on the last moment). */
export const END_MS = 3000;
export const HOLD_MS = 1000;
/** Real speed is capped: a clip at most this long (longer runs are squeezed into it). */
export const REAL_MAX_MS: Record<ExportFormat, number> = { mp4: 10 * 60_000, webm: 10 * 60_000, gif: 60_000 };
/** The run itself never gets less than this, whatever the cards take. */
const MIN_CONTENT_MS = 4000;

export type Phase = 'title' | 'run' | 'end';
export interface FrameInfo {
  i: number;
  /** Video time, ms. */
  v: number;
  phase: Phase;
  /** Original time shown. */
  t: number;
  /** Position in the run, ms (0..contentMs). */
  c: number;
  /** Time into the current card, ms (title / end), else 0. */
  cardMs: number;
  /** Frame timestamp in µs (WebCodecs) and its duration. */
  us: number;
  durUs: number;
}

export interface FrameSchedule {
  fps: number;
  titleMs: number;
  contentMs: number;
  tailMs: number;
  total: number;
  at(i: number): FrameInfo;
}

/** Frame i ↔ phases: [0, titleMs) title, [titleMs, titleMs + contentMs] the run, then the tail (end card / hold). */
export function frameSchedule(fps: number, titleMs: number, contentMs: number, tailMs: number, map: Pick<TimeMap, 'toReal' | 'start' | 'end'>): FrameSchedule {
  const totalMs = titleMs + contentMs + tailMs;
  const total = Math.max(1, Math.round((totalMs * fps) / 1000));
  return {
    fps, titleMs, contentMs, tailMs, total,
    at(i: number): FrameInfo {
      const v = (i * 1000) / fps;
      const us = Math.round((i * 1e6) / fps);
      const durUs = Math.round(((i + 1) * 1e6) / fps) - us;
      if (v < titleMs) return { i, v, phase: 'title', t: map.start, c: 0, cardMs: v, us, durUs };
      const c = v - titleMs;
      if (c <= contentMs) return { i, v, phase: 'run', t: c >= contentMs ? map.end : map.toReal(c), c, cardMs: 0, us, durUs };
      return { i, v, phase: 'end', t: map.end, c: contentMs, cardMs: c - contentMs, us, durUs };
    },
  };
}

// ---------- captions ----------

export type CaptionKind = 'spawn' | 'finish' | 'wait';
export interface CaptionItem { kind: CaptionKind; ts: number; agentType: string; arg: string | null; tokens: number }
export interface Caption extends CaptionItem { v: number }

/** A caption lives this long (video ms): fades in, stays, fades out. */
export const CAPTION_LIFE = 2600;
/** At most one new caption per this many video ms (a burst of spawns shows its first ones, not a blur). */
export const CAPTION_GAP = 550;

/** Caption-worthy events of a replay in [from, to]: spawns, returns and the start of each wait. */
export function captionItems(r: SessionReplay, from: number, to: number): CaptionItem[] {
  const types = new Map<string, string>();
  const out: CaptionItem[] = [];
  let waiting = false;
  for (const e of r.events as ReplayEvent[]) {
    if (e.kind === 'spawn') types.set(e.agentId, e.agentType);
    const inside = e.ts >= from && e.ts <= to;
    if (e.kind === 'spawn' && inside) out.push({ kind: 'spawn', ts: e.ts, agentType: e.agentType, arg: null, tokens: 0 });
    else if (e.kind === 'finish' && inside) out.push({ kind: 'finish', ts: e.ts, agentType: types.get(e.agentId) ?? 'agent', arg: null, tokens: e.tokens });
    else if (e.kind === 'status') {
      if (e.status === 'waiting' && !waiting && inside) out.push({ kind: 'wait', ts: e.ts, agentType: '', arg: e.arg, tokens: 0 });
      waiting = e.status === 'waiting';
    }
  }
  return out;
}

/**
 * Places caption items on the video axis (`toVideo`: original time → video ms) and thins them: one at most every
 * CAPTION_GAP ms; a wait always gets its caption (it replaces a spawn/finish that would crowd it).
 */
export function scheduleCaptions(items: readonly CaptionItem[], toVideo: (ts: number) => number, gap = CAPTION_GAP): Caption[] {
  const out: Caption[] = [];
  for (const it of items) {
    const v = toVideo(it.ts);
    const last = out[out.length - 1];
    if (last && v - last.v < gap) {
      if (it.kind === 'wait' && last.kind !== 'wait') out[out.length - 1] = { ...it, v: last.v };
      continue;
    }
    out.push({ ...it, v });
  }
  return out;
}

/** Captions visible at video time v (newest last), each with its opacity, at most `rows`. */
export function captionsAt(list: readonly Caption[], v: number, rows: number, life = CAPTION_LIFE): { cap: Caption; a: number; age: number }[] {
  // Binary search for the first caption after v.
  let lo = 0, hi = list.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].v <= v) lo = m + 1; else hi = m; }
  const out: { cap: Caption; a: number; age: number }[] = [];
  for (let i = lo - 1; i >= 0 && out.length < rows; i--) {
    const age = v - list[i].v;
    if (age > life) break;
    const a = Math.min(1, age / 180, (life - age) / 450);
    if (a > 0) out.unshift({ cap: list[i], a, age });
  }
  return out;
}

// ---------- the whole plan ----------

export interface ExportPlan {
  settings: ExportSettings;
  preset: SizePreset;
  aspect: Aspect;
  width: number;
  height: number;
  /** Logical canvas (layout.ts) and its scale to the output. */
  lw: number;
  lh: number;
  scale: number;
  fps: number;
  from: number;
  to: number;
  map: TimeMap;
  schedule: FrameSchedule;
  layout: OverlayLayout;
  captions: Caption[];
}

export function presetOf(format: ExportFormat, id: string): SizePreset {
  const list = presetsFor(format);
  return list.find((p) => p.id === id) ?? list.find((p) => p.aspect === id.split('-')[0]) ?? list[0];
}

/** Everything the renderer needs, from a replay (already anonymized if asked) and the settings. */
export function planExport(r: SessionReplay, settings: ExportSettings): ExportPlan {
  const preset = presetOf(settings.format, settings.size);
  const fps = fpsFor(settings.format);
  const from = Math.max(r.startedAt, Math.min(r.endedAt, settings.range?.from ?? r.startedAt));
  const to = Math.max(from, Math.min(r.endedAt, settings.range?.to ?? r.endedAt));
  const titleMs = settings.overlays.title ? TITLE_MS : 0;
  const tailMs = settings.overlays.end ? END_MS : HOLD_MS;
  const target = settings.target === 'real' ? REAL_MAX_MS[settings.format] : Math.max(MIN_CONTENT_MS, settings.target * 1000 - titleMs - tailMs);
  const ts = r.events.map((e) => e.ts);
  const map = buildTargetMap(ts, from, to, target);
  const schedule = frameSchedule(fps, titleMs, map.duration, tailMs, map);
  const { w: lw, h: lh, scale } = logicalSize(preset.width, preset.height);
  const layout = overlayLayout(lw, lh, preset.aspect);
  const captions = settings.overlays.captions ? scheduleCaptions(captionItems(r, from, to), (t) => titleMs + map.toPlay(t)) : [];
  return { settings, preset, aspect: preset.aspect, width: preset.width, height: preset.height, lw, lh, scale, fps, from, to, map, schedule, layout, captions };
}

/** `clorbit-<project|session>-<yyyy-mm-dd>.<ext>`, ASCII only. */
export function exportFileName(project: string | null, startedAt: number, format: ExportFormat): string {
  const slug = (project ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'session';
  const d = new Date(startedAt);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `clorbit-${slug}-${day}.${format}`;
}
