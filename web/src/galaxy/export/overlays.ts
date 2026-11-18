// Overlays drawn into exported frames (not DOM): title card, end card, corner clock, live counters and caption
// toasts. Everything is in logical px (layout.ts) and depends only on the frame and the replay state, so frames
// are reproducible. Text follows the UI language.
import type { SessionReplay } from '@shared/api';
import type { ReplayState } from '@shared/replay';
import { getLang, locale, t, tp } from '../../i18n';
import { prettyModel } from '../engine';
import { fmtClock, fmtDur, fmtTok } from '../format';
import { fmtSpan } from '../Scrubber';
import type { Box, OverlayLayout } from './layout';
import { captionsAt, CAPTION_LIFE, END_MS, TITLE_MS, type Caption, type FrameInfo, type OverlayToggles } from './plan';

const UI = `'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`;
const MONO = `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace`;
const WAIT = '#FFB15C';
const SPAWN = '#B58CFF';
const FINISH = '#4FE0B0';
const ACCENT = '#8FD8FF';
export const REPO_URL = 'github.com/MaxKarasha/clorbit';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const eOut = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

/** What the cards say: computed once per export. */
export interface CardText {
  heading: string;
  subtitle: string | null;
  meta: string;
  /** End card summary: agents · tool calls · tokens · length of the run. */
  summary: string;
}

export function cardText(r: SessionReplay, final: ReplayState, from: number, to: number, anonymized: boolean): CardText {
  const date = new Date(r.startedAt).toLocaleString(locale(getLang()), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const tokens = final.tokens[0] + final.tokens[1] + final.tokens[2] + final.tokens[3];
  return {
    heading: anonymized ? t('gx.export.ov.anonHeading') : r.project,
    subtitle: anonymized ? null : r.title,
    meta: [date, prettyModel(r.model), r.effort, fmtDur(to - from)].filter(Boolean).join(' · '),
    summary: [tp('gx.export.ov.sumAgents', final.subagentsTotal), tp('gx.export.ov.sumTools', final.toolCalls), t('gx.export.ov.sumTokens', { n: fmtTok(tokens) })].join(' · '),
  };
}

function ellipsize(ctx: CanvasRenderingContext2D, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ctx.measureText(s.slice(0, m) + '…').width <= maxW) lo = m; else hi = m - 1; }
  return s.slice(0, lo).trimEnd() + '…';
}

/** Up to `maxLines` lines of `s` within `maxW` (word wrap; the last line ellipsized). */
function wrap(ctx: CanvasRenderingContext2D, s: string, maxW: number, maxLines: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxW || !cur) { cur = next; continue; }
    lines.push(cur);
    cur = words[i];
    if (lines.length === maxLines - 1) { cur = words.slice(i).join(' '); break; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines).map((l, i, a) => (i === a.length - 1 ? ellipsize(ctx, l, maxW) : l));
}

function glass(ctx: CanvasRenderingContext2D, b: Box, a: number, r = 12) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(8, 12, 24, 0.74)';
  ctx.strokeStyle = 'rgba(130, 160, 230, 0.24)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, r);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** The Clorbit mark: a glowing star with a tilted orbit (as in the app's header). */
export function logoMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, a = 1) {
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x - size * 0.1, y - size * 0.1, 0, x, y, size * 0.9);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.2, '#ffffff');
  g.addColorStop(0.36, '#8fd8ff');
  g.addColorStop(1, 'rgba(120, 90, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, size * 0.9, 0, 7); ctx.fill();
  ctx.translate(x, y);
  ctx.rotate((-18 * Math.PI) / 180);
  ctx.strokeStyle = 'rgba(160, 200, 255, 0.7)';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.95, size * 0.95 * 0.38, 0, 0, 7); ctx.stroke();
  ctx.restore();
}

/** A soft blue glow behind a heading (a gradient: canvas shadowBlur is costly on the GPU, frame after frame). */
function halo(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(110, 180, 255, 0.16)');
  g.addColorStop(1, 'rgba(110, 180, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill();
  ctx.restore();
}

function veil(ctx: CanvasRenderingContext2D, w: number, h: number, a: number) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(5, 7, 16, 0.9)');
  g.addColorStop(1, 'rgba(2, 3, 8, 0.97)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Title card: veil, mark, project (or a neutral heading), the session title, date · model · effort · length. */
function titleCard(ctx: CanvasRenderingContext2D, L: OverlayLayout, w: number, h: number, ms: number, text: CardText) {
  const out = clamp((TITLE_MS - ms) / 650, 0, 1);
  veil(ctx, w, h, out);
  const a = eOut(ms / 450) * out;
  if (a <= 0.01) return;
  const b = L.card;
  const cx = b.x + b.w / 2;
  const narrow = b.w < 560;
  const head = narrow ? 34 : 40;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const dy = (1 - eOut(ms / 600)) * 10;
  let y = b.y + b.h * 0.36 + dy;
  logoMark(ctx, cx, y - head - 30, 15);
  ctx.font = `600 ${L.font - 2}px ${MONO}`;
  ctx.fillStyle = 'rgba(200, 220, 255, 0.78)';
  ctx.fillText(t('gx.export.ov.brand').toUpperCase().split('').join(' '), cx, y - head + 2);
  ctx.font = `700 ${head}px ${UI}`;
  const lines = wrap(ctx, text.heading, b.w * 0.92, 2);
  halo(ctx, cx, y + head * 0.7 * lines.length, Math.min(b.w * 0.5, 60 + ctx.measureText(lines[0] ?? '').width * 0.7), head * 1.4 * lines.length);
  ctx.fillStyle = '#F2F6FF';
  for (const l of lines) { y += head * 1.05; ctx.fillText(l, cx, y); }
  if (text.subtitle) {
    ctx.font = `500 ${narrow ? 16 : 18}px ${UI}`;
    ctx.fillStyle = '#C9D3E6';
    y += 12;
    for (const l of wrap(ctx, text.subtitle, b.w * 0.86, 3)) { y += 25; ctx.fillText(l, cx, y); }
  }
  ctx.font = `500 ${L.font}px ${MONO}`;
  ctx.fillStyle = '#93A0BA';
  y += 34;
  for (const l of wrap(ctx, text.meta, b.w * 0.92, 2)) { ctx.fillText(l, cx, y); y += 19; }
  ctx.restore();
}

/** End card: mark, "Made with Clorbit", the repository, and what the run did. */
function endCard(ctx: CanvasRenderingContext2D, L: OverlayLayout, w: number, h: number, ms: number, text: CardText) {
  veil(ctx, w, h, clamp(ms / 500, 0, 1) * 0.96);
  const a = eOut((ms - 250) / 500);
  if (a <= 0.01) return;
  const b = L.card;
  const cx = b.x + b.w / 2;
  const narrow = b.w < 560;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  let y = b.y + b.h * 0.4 + (1 - a) * 10;
  logoMark(ctx, cx, y - 26, 24);
  y += 34;
  ctx.font = `700 ${narrow ? 26 : 30}px ${UI}`;
  const made = t('gx.export.ov.made');
  halo(ctx, cx, y - 10, 60 + ctx.measureText(made).width * 0.7, 70);
  ctx.fillStyle = '#F2F6FF';
  ctx.fillText(made, cx, y);
  y += 30;
  ctx.font = `600 ${L.font + 2}px ${MONO}`;
  ctx.fillStyle = ACCENT;
  ctx.fillText(REPO_URL, cx, y);
  y += 40;
  ctx.font = `500 ${L.font}px ${MONO}`;
  ctx.fillStyle = '#A6B1C6';
  for (const l of wrap(ctx, text.summary, b.w * 0.92, 2)) { ctx.fillText(l, cx, y); y += 19; }
  ctx.restore();
}

/** Corner clock: the original time, elapsed / total, and a thin progress line of the clip's run. */
function clock(ctx: CanvasRenderingContext2D, L: OverlayLayout, f: FrameInfo, r: SessionReplay, contentMs: number, a: number) {
  const b = L.clock;
  glass(ctx, b, a);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'left';
  const x = b.x + 14;
  logoMark(ctx, x + 6, b.y + 18, 6);
  ctx.font = `700 20px ${MONO}`;
  ctx.fillStyle = '#F2F6FF';
  ctx.fillText(fmtClock(f.t), x + 22, b.y + 25);
  ctx.font = `500 ${L.font - 1.5}px ${MONO}`;
  ctx.fillStyle = '#9AA6BE';
  ctx.fillText(ellipsize(ctx, t('gx.export.ov.elapsed', { elapsed: fmtSpan(f.t - r.startedAt), total: fmtSpan(r.endedAt - r.startedAt) }), b.w - 28), x, b.y + 43);
  const p = contentMs > 0 ? clamp(f.c / contentMs, 0, 1) : 1;
  ctx.fillStyle = 'rgba(140, 190, 255, 0.16)';
  ctx.fillRect(b.x + 10, b.y + b.h - 4, b.w - 20, 1.5);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(b.x + 10, b.y + b.h - 4, (b.w - 20) * p, 1.5);
  ctx.restore();
}

/** Live counters: agents (active / total), tool calls, tokens. */
function counters(ctx: CanvasRenderingContext2D, L: OverlayLayout, s: ReplayState, a: number) {
  const b = L.counters;
  glass(ctx, b, a);
  const tokens = s.tokens[0] + s.tokens[1] + s.tokens[2] + s.tokens[3];
  const cols: [string, string, string | null][] = [
    [t('gx.export.ov.agents'), String(s.subagentsActive), `/ ${s.subagentsTotal}`],
    [t('gx.export.ov.tools'), String(s.toolCalls), null],
    [t('gx.export.ov.tokens'), fmtTok(tokens), null],
  ];
  const cw = b.w / cols.length;
  const big = b.h > 58 ? 22 : 19;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'left';
  cols.forEach(([label, value, sub], i) => {
    const x = b.x + i * cw + 14;
    if (i) { ctx.fillStyle = 'rgba(130, 160, 230, 0.18)'; ctx.fillRect(b.x + i * cw, b.y + 10, 1, b.h - 20); }
    ctx.font = `600 ${L.font - 3.5}px ${UI}`;
    ctx.fillStyle = '#8D99B0';
    ctx.fillText(ellipsize(ctx, label.toUpperCase(), cw - 22), x, b.y + 19);
    // The value (and its "/ total") shrink to fit the column instead of running into the next one.
    const room = cw - 24;
    ctx.font = `500 ${L.font - 1}px ${MONO}`;
    const subW = sub ? ctx.measureText(sub).width + 5 : 0;
    ctx.font = `700 ${big}px ${MONO}`;
    const natural = ctx.measureText(value).width + subW;
    const size = natural > room ? Math.max(12, Math.floor(big * (room / natural))) : big;
    ctx.font = `700 ${size}px ${MONO}`;
    ctx.fillStyle = '#F2F6FF';
    const vy = b.y + b.h - (b.h > 58 ? 16 : 12);
    ctx.fillText(value, x, vy);
    if (sub) {
      const vw = ctx.measureText(value).width;
      ctx.font = `500 ${L.font - 1}px ${MONO}`;
      ctx.fillStyle = '#8D99B0';
      ctx.fillText(sub, x + vw + 5, vy);
    }
  });
  ctx.restore();
}

function captionLine(c: Caption): { color: string; text: string } {
  if (c.kind === 'spawn') return { color: SPAWN, text: t('gx.export.ov.capSpawn', { type: c.agentType }) };
  if (c.kind === 'finish') return { color: FINISH, text: c.tokens ? t('gx.export.ov.capFinishTok', { type: c.agentType, tokens: fmtTok(c.tokens) }) : t('gx.export.ov.capFinish', { type: c.agentType }) };
  return { color: WAIT, text: c.arg ? t('gx.export.ov.capWaitArg', { arg: c.arg }) : t('gx.export.ov.capWait') };
}

/** Caption toasts: the newest at the bottom; each slides in, stays and fades. */
function captions(ctx: CanvasRenderingContext2D, L: OverlayLayout, list: readonly Caption[], v: number, a: number) {
  const vis = captionsAt(list, v, L.captionRows, CAPTION_LIFE);
  if (!vis.length) return;
  const b = L.captions;
  ctx.save();
  ctx.font = `500 ${L.font}px ${MONO}`;
  ctx.textBaseline = 'middle';
  vis.forEach(({ cap, a: ca, age }, k) => {
    const row = L.captionRows - vis.length + k;
    const y = b.y + row * (L.captionRowH + 6);
    const { color, text } = captionLine(cap);
    const tw = ctx.measureText(text).width;
    const w = Math.min(b.w, tw + 40);
    const slide = (1 - eOut(age / 260)) * 14;
    const x = L.captionAlign === 'center' ? b.x + (b.w - w) / 2 : b.x - slide;
    const box = { x, y, w, h: L.captionRowH };
    glass(ctx, box, ca * a, L.captionRowH / 2);
    ctx.globalAlpha = ca * a;
    const dy = y + L.captionRowH / 2;
    const g = ctx.createRadialGradient(x + 16, dy, 0, x + 16, dy, 9);
    g.addColorStop(0, color);
    g.addColorStop(0.45, color);
    g.addColorStop(0.5, `${color}66`);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x + 16, dy, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#E6EBF5';
    ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, text, w - 40), x + 28, y + L.captionRowH / 2 + 0.5);
  });
  ctx.restore();
}

export interface OverlayInput {
  layout: OverlayLayout;
  w: number;
  h: number;
  frame: FrameInfo;
  contentMs: number;
  state: ReplayState;
  replay: SessionReplay;
  captions: readonly Caption[];
  toggles: OverlayToggles;
  text: CardText;
}

/** Draws every enabled overlay of a frame (ctx in logical px). */
export function drawOverlays(ctx: CanvasRenderingContext2D, o: OverlayInput) {
  const f = o.frame;
  // The HUD (clock, counters, captions) fades in as the title card leaves and out under the end card.
  const hud = f.phase === 'title' ? clamp((f.cardMs - (TITLE_MS - 700)) / 700, 0, 1) : f.phase === 'end' && o.toggles.end ? clamp(1 - f.cardMs / 400, 0, 1) : 1;
  if (hud > 0.01) {
    if (o.toggles.clock) clock(ctx, o.layout, f, o.replay, o.contentMs, hud);
    if (o.toggles.counters) counters(ctx, o.layout, o.state, hud);
    if (o.toggles.captions) captions(ctx, o.layout, o.captions, f.v, hud);
  }
  if (f.phase === 'title' && o.toggles.title) titleCard(ctx, o.layout, o.w, o.h, f.cardMs, o.text);
  if (f.phase === 'end' && o.toggles.end) endCard(ctx, o.layout, o.w, o.h, Math.min(f.cardMs, END_MS), o.text);
}
