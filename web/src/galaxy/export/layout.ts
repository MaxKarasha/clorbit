// Video export geometry (pure): output sizes per format and aspect, the logical canvas the engine draws in,
// safe margins per aspect, where each overlay goes, and how the camera fits the system into what is left.
export type Aspect = '16:9' | '1:1' | '9:16';
export type ExportFormat = 'mp4' | 'webm' | 'gif';

export interface Box { x: number; y: number; w: number; h: number }

export interface SizePreset { id: string; aspect: Aspect; width: number; height: number }

/** Video sizes (even dimensions, as H.264 / VP9 want). */
export const VIDEO_PRESETS: SizePreset[] = [
  { id: '16:9-1080', aspect: '16:9', width: 1920, height: 1080 },
  { id: '16:9-720', aspect: '16:9', width: 1280, height: 720 },
  { id: '1:1', aspect: '1:1', width: 1080, height: 1080 },
  { id: '9:16', aspect: '9:16', width: 1080, height: 1920 },
];
/** GIF sizes: at most 720 px wide, so files stay shareable. */
export const GIF_PRESETS: SizePreset[] = [
  { id: '16:9', aspect: '16:9', width: 720, height: 405 },
  { id: '1:1', aspect: '1:1', width: 540, height: 540 },
  { id: '9:16', aspect: '9:16', width: 405, height: 720 },
];
export const VIDEO_FPS = 30;
export const GIF_FPS = 15;
export const GIF_MAX_WIDTH = 720;

export function presetsFor(format: ExportFormat): SizePreset[] {
  return format === 'gif' ? GIF_PRESETS : VIDEO_PRESETS;
}
export function fpsFor(format: ExportFormat): number {
  return format === 'gif' ? GIF_FPS : VIDEO_FPS;
}

/**
 * The logical canvas: the engine and the overlays draw in units whose short side is at most 600, scaled to the
 * output. Text and bodies then have the same proportions at 720p, 1080p and in a vertical clip.
 */
export const LOGICAL_SHORT = 600;
export function logicalSize(width: number, height: number): { w: number; h: number; scale: number } {
  const short = Math.min(width, height);
  const scale = short > LOGICAL_SHORT ? short / LOGICAL_SHORT : 1;
  return { w: width / scale, h: height / scale, scale };
}

/** Safe margins (fractions of the frame). Vertical clips keep clear of the app chrome of Reels / Stories / Threads. */
export const SAFE: Record<Aspect, { x: number; top: number; bottom: number }> = {
  '16:9': { x: 0.05, top: 0.06, bottom: 0.06 },
  '1:1': { x: 0.06, top: 0.06, bottom: 0.06 },
  '9:16': { x: 0.06, top: 0.12, bottom: 0.18 },
};

export function safeArea(w: number, h: number, aspect: Aspect): Box {
  const m = SAFE[aspect];
  return { x: w * m.x, y: h * m.top, w: w * (1 - 2 * m.x), h: h * (1 - m.top - m.bottom) };
}

export interface OverlayLayout {
  safe: Box;
  /** Corner clock: original time and elapsed. */
  clock: Box;
  /** Live counters: agents, tool calls, tokens. */
  counters: Box;
  /** Caption toasts: `rows` rows of `rowH`, the newest at the bottom (or at the top on vertical clips). */
  captions: Box;
  captionRows: number;
  captionRowH: number;
  captionAlign: 'left' | 'center';
  /** Where the system is fitted. */
  system: Box;
  /** Title and end cards: the text block. */
  card: Box;
  /** Base font size of the overlays (logical px). */
  font: number;
}

const GAP = 12;

/**
 * Overlay boxes in logical px. Landscape and square: the clock top-left, counters top-right, captions
 * bottom-left, the system between the top row and the bottom. Vertical: clock and counters as two full-width
 * rows at the top, captions centred at the bottom, the system in the middle.
 */
export function overlayLayout(w: number, h: number, aspect: Aspect): OverlayLayout {
  const safe = safeArea(w, h, aspect);
  const font = 13;
  const rows = 3, rowH = 30;
  const capH = rows * rowH + (rows - 1) * 6;
  if (aspect === '9:16') {
    const clock = { x: safe.x, y: safe.y, w: safe.w, h: 52 };
    const counters = { x: safe.x, y: clock.y + clock.h + 8, w: safe.w, h: 62 };
    const captions = { x: safe.x, y: safe.y + safe.h - capH, w: safe.w, h: capH };
    const top = counters.y + counters.h + GAP;
    const system = { x: safe.x, y: top, w: safe.w, h: captions.y - GAP - top };
    return { safe, clock, counters, captions, captionRows: rows, captionRowH: rowH, captionAlign: 'center', system, card: safe, font };
  }
  const clock = { x: safe.x, y: safe.y, w: Math.min(250, safe.w * 0.42), h: 54 };
  const cw = Math.min(340, safe.w * 0.55);
  const counters = { x: safe.x + safe.w - cw, y: safe.y, w: cw, h: 54 };
  const captions = { x: safe.x, y: safe.y + safe.h - capH, w: Math.min(430, safe.w * 0.74), h: capH };
  const top = clock.y + clock.h + GAP;
  const system = { x: safe.x, y: top, w: safe.w, h: safe.y + safe.h - top };
  return { safe, clock, counters, captions, captionRows: rows, captionRowH: rowH, captionAlign: 'left', system, card: safe, font };
}

/** Screen room kept above and below a fitted system for the star's name label (logical px). */
export const FIT_LABEL_PX = 40;

/**
 * Camera for a replayed system fitted into `box` (canvas px): the system's outer radius R (its widest orbit or
 * belt, world units) spans the box's width, and its flattened height (orbits are drawn at 0.42 of their radius)
 * plus room for the star's label its height, with a little padding; the system's centre lands on the box's centre.
 */
export function fitSystem(center: [number, number], R: number, box: Box, W: number, H: number): { x: number; y: number; s: number } {
  const pad = 0.92;
  const sw = (box.w * pad) / (2 * R);
  const sh = Math.max(0, box.h * pad - 2 * FIT_LABEL_PX) / (2 * 0.42 * R);
  const s = Math.min(6, Math.max(0.3, Math.min(sw, sh)));
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  return { x: center[0] - (cx - W / 2) / s, y: center[1] - (cy - H / 2) / s, s };
}

export function inside(inner: Box, outer: Box, eps = 1e-6): boolean {
  return inner.x >= outer.x - eps && inner.y >= outer.y - eps && inner.x + inner.w <= outer.x + outer.w + eps && inner.y + inner.h <= outer.y + outer.h + eps;
}
export function overlapsBox(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
