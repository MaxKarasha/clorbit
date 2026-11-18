// Edge indicators: chips at the edge of the view pointing at active systems that are off screen. Pure math.
export interface Rect { x: number; y: number; w: number; h: number }
export type Side = 'top' | 'right' | 'bottom' | 'left';

/** A HUD element that takes a strip of the screen away from the view (status bar, side panel, console). */
export interface Cut { rect: Rect; side: Side }

/** The part of the canvas not covered by the HUD: each cut moves one edge of the view inward. */
export function edgeView(w: number, h: number, cuts: Cut[]): Rect {
  let x0 = 0, y0 = 0, x1 = w, y1 = h;
  for (const { rect: r, side } of cuts) {
    if (!r.w || !r.h) continue;
    if (side === 'top') y0 = Math.max(y0, r.y + r.h);
    else if (side === 'bottom') y1 = Math.min(y1, r.y);
    else if (side === 'right') x1 = Math.min(x1, r.x);
    else x0 = Math.max(x0, r.x + r.w);
  }
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export function inRect(px: number, py: number, r: Rect, inset = 0): boolean {
  return px >= r.x + inset && px <= r.x + r.w - inset && py >= r.y + inset && py <= r.y + r.h - inset;
}

export interface EdgeTarget {
  key: string;
  /** Where the system is, in screen px (outside the view). */
  x: number; y: number;
  /** Chip size. */
  w: number; h: number;
  /** Higher keeps its chip when there is not enough room (waiting before working). */
  prio: number;
}
export interface EdgeChip { key: string; x: number; y: number; w: number; h: number; side: Side; /** Arrow direction (radians), chip → target. */ ang: number }

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Places one chip per target on the edge of `view` (inset by `margin`) where the line from the view's
 * centre to the target leaves it. Chips on one side are stacked along it without overlapping, step around
 * `avoid` rects (zoom pad, ticker…), and corners are left to the top and bottom rows. When a side is full
 * the lowest-priority chips are dropped. Deterministic.
 */
export function placeEdgeChips(targets: EdgeTarget[], view: Rect, avoid: Rect[], opt: { margin?: number; gap?: number; max?: number } = {}): EdgeChip[] {
  const m = opt.margin ?? 10, gap = opt.gap ?? 6, max = opt.max ?? 8;
  const inner: Rect = { x: view.x + m, y: view.y + m, w: view.w - 2 * m, h: view.h - 2 * m };
  if (inner.w <= 40 || inner.h <= 40 || !targets.length) return [];
  const cx = inner.x + inner.w / 2, cy = inner.y + inner.h / 2;
  const chosen = [...targets].sort((a, b) => b.prio - a.prio || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).slice(0, max);
  const band = Math.max(...chosen.map((t) => t.h));
  type Item = { t: EdgeTarget; side: Side; want: number };
  const bySide: Record<Side, Item[]> = { top: [], right: [], bottom: [], left: [] };
  for (const t of chosen) {
    const dx = t.x - cx, dy = t.y - cy;
    const kx = Math.abs(dx) > 1e-9 ? (inner.w / 2) / Math.abs(dx) : Infinity;
    const ky = Math.abs(dy) > 1e-9 ? (inner.h / 2) / Math.abs(dy) : Infinity;
    const k = Math.min(kx, ky);
    if (!Number.isFinite(k)) continue;
    const side: Side = kx < ky ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top';
    const want = side === 'top' || side === 'bottom' ? cx + dx * k : cy + dy * k;
    bySide[side].push({ t, side, want });
  }
  const out: EdgeChip[] = [];
  for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
    let items = bySide[side];
    if (!items.length) continue;
    const horiz = side === 'top' || side === 'bottom';
    // Along-the-side range of chip centres; left/right stay clear of the top and bottom rows.
    const lo = horiz ? inner.x : inner.y + band + gap;
    const hi = horiz ? inner.x + inner.w : inner.y + inner.h - band - gap;
    const rectAt = (it: Item, pos: number): Rect => {
      const { w, h } = it.t;
      if (side === 'top') return { x: pos - w / 2, y: inner.y, w, h };
      if (side === 'bottom') return { x: pos - w / 2, y: inner.y + inner.h - h, w, h };
      if (side === 'left') return { x: inner.x, y: pos - h / 2, w, h };
      return { x: inner.x + inner.w - w, y: pos - h / 2, w, h };
    };
    const size = (it: Item) => (horiz ? it.t.w : it.t.h);
    // Blocked stretches of the side for this chip (an avoid rect crossing its row or column).
    const blocked = (it: Item): [number, number][] => {
      const probe = rectAt(it, horiz ? inner.x + inner.w / 2 : inner.y + inner.h / 2);
      const res: [number, number][] = [];
      for (const a of avoid) {
        const crosses = horiz ? a.y < probe.y + probe.h && a.y + a.h > probe.y : a.x < probe.x + probe.w && a.x + a.w > probe.x;
        if (!crosses) continue;
        const s = size(it) / 2 + gap;
        res.push(horiz ? [a.x - s, a.x + a.w + s] : [a.y - s, a.y + a.h + s]);
      }
      return res;
    };
    const fit = (list: Item[]): number[] | null => {
      const pos: number[] = [];
      let prevEnd = -Infinity;
      for (const it of list) {
        const half = size(it) / 2;
        let p = Math.max(it.want, lo + half, prevEnd + gap + half);
        for (let guard = 0, moved = true; moved && guard < 20; guard++) {
          moved = false;
          for (const [a, b] of blocked(it)) if (p > a && p < b) { p = b; moved = true; }
        }
        pos.push(p);
        prevEnd = p + half;
      }
      // Too far: walk back from the end, stepping before blocked stretches.
      let next = hi;
      for (let i = list.length - 1; i >= 0; i--) {
        const half = size(list[i]) / 2;
        if (pos[i] + half > next) {
          let p = next - half;
          for (let guard = 0, moved = true; moved && guard < 20; guard++) {
            moved = false;
            for (const [a, b] of blocked(list[i])) if (p > a && p < b) { p = a; moved = true; }
          }
          pos[i] = p;
        }
        next = pos[i] - half - gap;
      }
      for (let i = 0; i < list.length; i++) {
        const half = size(list[i]) / 2;
        if (pos[i] - half < lo - 0.5 || pos[i] + half > hi + 0.5) return null;
        if (i && pos[i] - half < pos[i - 1] + size(list[i - 1]) / 2 + gap - 0.5) return null;
        if (blocked(list[i]).some(([a, b]) => pos[i] > a + 0.5 && pos[i] < b - 0.5)) return null;
      }
      return pos;
    };
    const ordered = (l: Item[]) => [...l].sort((a, b) => a.want - b.want || (a.t.key < b.t.key ? -1 : 1));
    let pos = fit(ordered(items));
    while (!pos && items.length > 1) {
      // Drop the least important chip and try again.
      const drop = [...items].sort((a, b) => a.t.prio - b.t.prio || (a.t.key < b.t.key ? 1 : -1))[0];
      items = items.filter((i) => i !== drop);
      pos = fit(ordered(items));
    }
    if (!pos) continue;
    ordered(items).forEach((it, i) => {
      const r = rectAt(it, pos![i]);
      out.push({ key: it.t.key, ...r, side, ang: Math.atan2(it.t.y - (r.y + r.h / 2), it.t.x - (r.x + r.w / 2)) });
    });
  }
  // Chips never overlap each other (sides are disjoint by construction); this is a cheap guard.
  return out.filter((c, i) => !out.slice(0, i).some((o) => overlaps(o, c)));
}
