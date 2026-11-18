// Encoders for the video export: MP4 (H.264 via WebCodecs + mp4-muxer), WebM (VP9/VP8 via WebCodecs +
// webm-muxer) and GIF (gifenc). Frames are encoded one by one as they are rendered and their chunks go
// straight into the muxer, so memory holds the encoded output and a few frames in flight, never the clip.
import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from 'mp4-muxer';
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from 'webm-muxer';
import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import type { ExportFormat } from './layout';

/** H.264 candidates: High, Main, Baseline at level 4.0 (1080p30, also 1080×1920), then level 5.1. */
const AVC = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640033'];
const VPX: [string, 'V_VP9' | 'V_VP8'][] = [['vp09.00.40.08', 'V_VP9'], ['vp8', 'V_VP8']];

/** Bits per pixel per frame for the bitrate: 1080p30 ≈ 7.5 Mbit/s. */
const BPP = 0.12;
export const videoBitrate = (w: number, h: number, fps: number) => Math.round(w * h * fps * BPP);

export interface CodecChoice { codec: string; mux: string }

async function firstSupported(cands: [string, string][], w: number, h: number, fps: number): Promise<CodecChoice | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  for (const [codec, mux] of cands) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate: videoBitrate(w, h, fps), framerate: fps });
      if (r.supported) return { codec, mux };
    } catch { /* malformed for this browser: try the next */ }
  }
  return null;
}

/** The codec a format would use at this size, or null when the browser cannot encode it (GIF always works). */
export async function detectCodec(format: ExportFormat, w: number, h: number, fps: number): Promise<CodecChoice | null> {
  if (format === 'gif') return { codec: 'gif', mux: 'gif' };
  if (format === 'mp4') return firstSupported(AVC.map((c) => [c, 'avc']), w, h, fps);
  return firstSupported(VPX, w, h, fps);
}

export interface FrameSink {
  /** Encodes the canvas as frame `us` (timestamp, µs) lasting `durUs`; resolves when there is room for more. */
  add(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, us: number, durUs: number, key: boolean): Promise<void>;
  finish(): Promise<Blob>;
  abort(): void;
  /** Encoded bytes so far (for the progress line). */
  bytes(): number;
}

/** At most this many frames queued in the encoder before rendering waits. */
const MAX_QUEUE = 6;

function videoSink(format: 'mp4' | 'webm', choice: CodecChoice, w: number, h: number, fps: number): FrameSink {
  let failed: Error | null = null;
  let size = 0;
  const mp4 = format === 'mp4' ? new Mp4Muxer({ target: new Mp4Target(), video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' }) : null;
  const webm = format === 'webm' ? new WebmMuxer({ target: new WebmTarget(), video: { codec: choice.mux, width: w, height: h, frameRate: fps }, firstTimestampBehavior: 'offset' }) : null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => {
      size += chunk.byteLength;
      if (mp4) mp4.addVideoChunk(chunk, meta);
      else webm!.addVideoChunk(chunk, meta);
    },
    error: (e) => { failed = e instanceof Error ? e : new Error(String(e)); wake?.(); },
  });
  /** Resolves a pending drain wait (an encoder error ends it as well as a dequeue). */
  let wake: (() => void) | null = null;
  enc.configure({
    codec: choice.codec, width: w, height: h, bitrate: videoBitrate(w, h, fps), framerate: fps, latencyMode: 'quality',
    ...(format === 'mp4' ? { avc: { format: 'avc' as const } } : {}),
  });
  const drained = () => new Promise<void>((res) => {
    const done = () => { enc.removeEventListener('dequeue', check); wake = null; res(); };
    const check = () => { if (enc.encodeQueueSize <= MAX_QUEUE / 2 || failed) done(); };
    wake = done;
    enc.addEventListener('dequeue', check);
    check();
  });
  return {
    async add(canvas, _ctx, us, durUs, key) {
      if (failed) throw failed;
      // Straight from the (GPU) canvas: reading pixels back would move the canvas to the CPU, where drawing a
      // 1080p frame is several times slower. Such a frame is only resolved when the page paints, which the live
      // preview takes care of (run.ts); in a background tab encoding waits until the tab is shown again.
      const frame = new VideoFrame(canvas, { timestamp: us, duration: durUs, alpha: 'discard' });
      enc.encode(frame, { keyFrame: key });
      frame.close();
      if (enc.encodeQueueSize > MAX_QUEUE) await drained();
      if (failed) throw failed;
    },
    async finish() {
      await enc.flush();
      if (failed) throw failed;
      enc.close();
      if (mp4) { mp4.finalize(); return new Blob([mp4.target.buffer], { type: 'video/mp4' }); }
      webm!.finalize();
      return new Blob([webm!.target.buffer], { type: 'video/webm' });
    },
    abort() { try { enc.close(); } catch { /* already closed */ } },
    bytes: () => size,
  };
}

/**
 * Below this (sum of |ΔR| + |ΔG| + |ΔB|) a GIF pixel counts as unchanged and is left to the previous frame.
 * Once a second a tight threshold catches slow fades that never cross the loose one (no ghosts under the cards).
 */
const GIF_SAME = 18;
const GIF_SAME_TIGHT = 4;

/**
 * GIF: a palette per frame (255 colours, rgb565) plus one transparent slot. After the first frame, pixels that
 * did not visibly change (GIF_SAME) are written as transparent (the previous frame shows through), which LZW packs into
 * almost nothing: a mostly still starfield costs little. Frame delays alternate so the average is exactly 1/fps.
 */
function gifSink(w: number, h: number, fps: number): FrameSink {
  const gif = GIFEncoder();
  // What a decoder shows after the frames so far (RGBA layout).
  let shown: Uint8ClampedArray | null = null;
  let n = 0;
  return {
    async add(_canvas, ctx, _us, _durUs) {
      const { data } = ctx.getImageData(0, 0, w, h);
      const palette = quantize(data, 255, { format: 'rgb565' });
      const index = applyPalette(data, palette, 'rgb565');
      // GIF delays are in 1/100 s: alternate them so the average is exactly 1/fps (e.g. 60, 70, 70, 60 … ms at 15 fps).
      const delay = (Math.round(((n + 1) * 100) / fps) - Math.round((n * 100) / fps)) * 10;
      if (!shown) {
        shown = new Uint8ClampedArray(data.length);
        for (let p = 0, k = 0; p < index.length; p++, k += 4) { const c = palette[index[p]]; shown[k] = c[0]; shown[k + 1] = c[1]; shown[k + 2] = c[2]; }
        gif.writeFrame(index, w, h, { palette, delay, repeat: 0 });
      } else {
        const tIdx = palette.length;
        palette.push([0, 0, 0]);
        const same = n % Math.round(fps) === 0 ? GIF_SAME_TIGHT : GIF_SAME;
        for (let p = 0, k = 0; p < index.length; p++, k += 4) {
          if (Math.abs(data[k] - shown[k]) + Math.abs(data[k + 1] - shown[k + 1]) + Math.abs(data[k + 2] - shown[k + 2]) <= same) { index[p] = tIdx; continue; }
          const c = palette[index[p]];
          shown[k] = c[0]; shown[k + 1] = c[1]; shown[k + 2] = c[2];
        }
        gif.writeFrame(index, w, h, { palette, delay, transparent: true, transparentIndex: tIdx, dispose: 1 });
      }
      n++;
    },
    async finish() {
      gif.finish();
      return new Blob([gif.bytes()], { type: 'image/gif' });
    },
    abort() { /* nothing held outside memory */ },
    bytes: () => gif.bytesView().byteLength,
  };
}

export function createSink(format: ExportFormat, choice: CodecChoice, w: number, h: number, fps: number): FrameSink {
  return format === 'gif' ? gifSink(w, h, fps) : videoSink(format, choice, w, h, fps);
}

/** A GIF can go to the clipboard only where the browser accepts image/gif there. */
export function canCopyGif(): boolean {
  const CI = (globalThis as { ClipboardItem?: { supports?: (t: string) => boolean } }).ClipboardItem;
  return !!CI && typeof CI.supports === 'function' && CI.supports('image/gif') && !!navigator.clipboard?.write;
}

/** Rough size of the result, bytes: the bitrate for video; for GIF, measured on Clorbit replays with frame diffing (≈ 0.05 byte/px/frame). */
export function estimateBytes(format: ExportFormat, w: number, h: number, fps: number, ms: number): number {
  const frames = (ms / 1000) * fps;
  if (format === 'gif') return w * h * frames * GIF_BYTES_PER_PX;
  return (videoBitrate(w, h, fps) / 8) * (ms / 1000) * 0.7;
}
export const GIF_BYTES_PER_PX = 0.05;
