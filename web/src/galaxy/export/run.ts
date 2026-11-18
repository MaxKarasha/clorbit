// The video export: an off-screen galaxy engine on a manual clock renders the replay frame by frame (plan.ts),
// overlays are drawn into each frame, and the frame goes straight to the encoder. Runs in small steps that yield
// to the page, can be cancelled, and never reads the wall clock while drawing (only to report its own speed).
import type { SessionReplay } from '@shared/api';
import { ReplayCursor, replayStateAt } from '@shared/replay';
import { GalaxyEngine } from '../engine';
import { replaySnapshot, SNAP_EVENTS } from '../replay-player';
import { anonymizeReplay } from './anonymize';
import { createSink, detectCodec, type CodecChoice } from './encode';
import { cardText, drawOverlays, type CardText } from './overlays';
import { exportFileName, planExport, type ExportPlan, type ExportSettings, type FrameInfo } from './plan';

/** Renders the frames of one plan in order (frame i must follow frame i - 1: animations carry over). */
export class FrameRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private eng: GalaxyEngine;
  private cursor: ReplayCursor;
  private started = false;
  private text: CardText;

  /** A small visible canvas that shows every rendered frame (see runExport). */
  private preview: CanvasRenderingContext2D | null = null;

  constructor(private r: SessionReplay, readonly plan: ExportPlan, preview?: HTMLCanvasElement | null) {
    this.preview = preview?.getContext('2d') ?? null;
    this.canvas = document.createElement('canvas');
    // GIF frames are read back on the CPU (a CPU-backed canvas); video frames go to the encoder from the GPU canvas.
    this.ctx = this.canvas.getContext('2d', { alpha: false, willReadFrequently: plan.settings.format === 'gif' })!;
    this.eng = new GalaxyEngine(this.canvas, { onFocus: () => {} }, { manual: { width: plan.lw, height: plan.lh, scale: plan.scale } });
    this.eng.setReplayMode(true, r.sessionId);
    this.eng.setFraming(plan.layout.system);
    this.cursor = new ReplayCursor(r);
    this.text = cardText(r, replayStateAt(r, plan.to), plan.from, plan.to, plan.settings.anonymize);
  }

  get total() { return this.plan.schedule.total; }

  render(i: number): FrameInfo {
    const p = this.plan;
    const f = p.schedule.at(i);
    const eng = this.eng;
    eng.renderAt(i / p.fps, () => {
      const { crossed, snapped } = this.cursor.moveTo(f.t);
      const snap = () => replaySnapshot(this.cursor.state, this.r, f.t);
      if (!this.started || snapped || crossed.length > SNAP_EVENTS) {
        this.started = true;
        eng.resetScene();
        eng.sync(snap());
        return;
      }
      if (!crossed.length) return;
      eng.sync(snap());
      for (const e of crossed) if (e.kind === 'prompt' || e.kind === 'compact') eng.pushEvent({ kind: e.kind, ts: e.ts, sessionId: this.r.sessionId });
    });
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(p.scale, 0, 0, p.scale, 0, 0);
    drawOverlays(ctx, {
      layout: p.layout, w: p.lw, h: p.lh, frame: f, contentMs: p.schedule.contentMs, state: this.cursor.state, replay: this.r,
      captions: p.captions, toggles: p.settings.overlays, text: this.text,
    });
    ctx.restore();
    const pv = this.preview;
    if (pv) pv.drawImage(this.canvas, 0, 0, pv.canvas.width, pv.canvas.height);
    return f;
  }

  destroy() { this.eng.destroy(); }
}

export interface ExportProgress { frame: number; total: number; bytes: number }
export interface ExportResult {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  fps: number;
  frames: number;
  durationMs: number;
  codec: string;
  /** How long the export took (wall clock), ms. */
  tookMs: number;
}

export class ExportCancelled extends Error {
  constructor() { super('cancelled'); this.name = 'ExportCancelled'; }
}

/** Yields to the page (a macrotask; unlike timers, not throttled in a background tab). */
function yieldToPage(): Promise<void> {
  return new Promise((res) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => { ch.port1.close(); res(); };
    ch.port2.postMessage(0);
  });
}

/**
 * The web fonts the canvas uses, so no frame falls back to another font while one is still loading. Web fonts
 * come in unicode-range subsets loaded on first use: the sample text pulls in the Latin and the Cyrillic ones.
 */
const FONT_SAMPLE = 'Aa09·…ЯяІіЇїЄєҐґ';
async function loadFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  const specs = ['500 12px "JetBrains Mono"', '600 12px "JetBrains Mono"', '700 20px "JetBrains Mono"', '500 16px Inter', '600 12px Inter', '700 40px Inter'];
  await Promise.race([
    Promise.allSettled(specs.map((s) => document.fonts.load(s, FONT_SAMPLE))).then(() => document.fonts.ready),
    new Promise((r) => setTimeout(r, 4000)),
  ]);
}

/** The replay the clip is made from: anonymized when asked. */
export function prepareReplay(r: SessionReplay, s: ExportSettings): SessionReplay {
  return s.anonymize ? anonymizeReplay(r) : r;
}

/**
 * Renders and encodes a clip. `preview`: a canvas on the page that shows the frames as they are rendered. It is
 * more than a progress picture: a video frame made from the (GPU) render canvas is only resolved when the page
 * paints, and a page that does not change does not paint, so without a visible canvas that changes every frame
 * encoding stalls (Chrome). Without one, a tiny, nearly transparent one is added for the duration.
 */
export async function runExport(
  original: SessionReplay,
  settings: ExportSettings,
  hooks: { onProgress?(p: ExportProgress): void; signal?: AbortSignal; preview?: HTMLCanvasElement | null } = {},
): Promise<ExportResult> {
  const started = performance.now();
  const r = prepareReplay(original, settings);
  const plan = planExport(r, settings);
  const choice: CodecChoice | null = await detectCodec(settings.format, plan.width, plan.height, plan.fps);
  if (!choice) throw new Error(`${settings.format} is not supported by this browser`);
  await loadFonts();
  let own: HTMLCanvasElement | null = null;
  if (!hooks.preview) {
    own = document.createElement('canvas');
    own.width = own.height = 2;
    own.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:0.02;pointer-events:none;z-index:2147483647';
    document.body.appendChild(own);
  }
  const renderer = new FrameRenderer(r, plan, hooks.preview ?? own);
  const sink = createSink(settings.format, choice, plan.width, plan.height, plan.fps);
  const total = plan.schedule.total;
  const keyEvery = plan.fps * 2;
  try {
    for (let i = 0; i < total; i++) {
      if (hooks.signal?.aborted) throw new ExportCancelled();
      const f = renderer.render(i);
      await sink.add(renderer.canvas, renderer.ctx, f.us, f.durUs, i % keyEvery === 0);
      hooks.onProgress?.({ frame: i + 1, total, bytes: sink.bytes() });
      await yieldToPage();
    }
    if (hooks.signal?.aborted) throw new ExportCancelled();
    const blob = await sink.finish();
    return {
      blob, fileName: exportFileName(settings.anonymize ? null : original.project, original.startedAt, settings.format),
      width: plan.width, height: plan.height, fps: plan.fps, frames: total, durationMs: (total * 1000) / plan.fps, codec: choice.codec,
      tookMs: performance.now() - started,
    };
  } catch (e) {
    sink.abort();
    throw e;
  } finally {
    renderer.destroy();
    own?.remove();
  }
}

/** FNV-1a over a frame's pixels: determinism checks (dev hook). */
export function frameHash(ctx: CanvasRenderingContext2D, w: number, h: number): string {
  const d = ctx.getImageData(0, 0, w, h).data;
  let x = 2166136261;
  for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619);
  return (x >>> 0).toString(16).padStart(8, '0');
}

/** Renders frames 0..max(indices) without encoding and returns the hashes of the requested ones (dev hook). */
export async function frameHashes(original: SessionReplay, settings: ExportSettings, indices: number[]): Promise<string[]> {
  await loadFonts();
  const r = prepareReplay(original, settings);
  const plan = planExport(r, settings);
  const renderer = new FrameRenderer(r, plan);
  const want = new Set(indices);
  const out = new Map<number, string>();
  const last = Math.min(plan.schedule.total - 1, Math.max(...indices));
  for (let i = 0; i <= last; i++) {
    renderer.render(i);
    if (want.has(i)) out.set(i, frameHash(renderer.ctx, renderer.canvas.width, renderer.canvas.height));
    if (i % 10 === 9) await yieldToPage();
  }
  renderer.destroy();
  return indices.map((i) => out.get(i) ?? '');
}
