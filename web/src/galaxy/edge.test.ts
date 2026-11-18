// Edge indicators: the free view, which side a chip goes to, stacking without overlaps, avoiding the HUD.
import { describe, expect, it } from 'vitest';
import { edgeView, inRect, placeEdgeChips, type EdgeChip, type EdgeTarget, type Rect } from './edge';

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const t = (key: string, x: number, y: number, prio = 1, w = 160, h = 26): EdgeTarget => ({ key, x, y, w, h, prio });
function sane(chips: EdgeChip[], view: Rect, avoid: Rect[] = []) {
  for (let i = 0; i < chips.length; i++) {
    const c = chips[i];
    expect(c.x).toBeGreaterThanOrEqual(view.x - 1e-6);
    expect(c.y).toBeGreaterThanOrEqual(view.y - 1e-6);
    expect(c.x + c.w).toBeLessThanOrEqual(view.x + view.w + 1e-6);
    expect(c.y + c.h).toBeLessThanOrEqual(view.y + view.h + 1e-6);
    for (const a of avoid) expect(overlap(c, a)).toBe(false);
    for (let j = i + 1; j < chips.length; j++) expect(overlap(c, chips[j])).toBe(false);
  }
}

describe('edgeView', () => {
  it('the status bar, side panel and console cut the view', () => {
    const v = edgeView(1440, 900, [
      { side: 'top', rect: { x: 14, y: 14, w: 1412, h: 76 } },
      { side: 'top', rect: { x: 20, y: 106, w: 300, h: 24 } },
      { side: 'right', rect: { x: 1066, y: 96, w: 360, h: 790 } },
      { side: 'bottom', rect: { x: 14, y: 600, w: 1000, h: 286 } },
      { side: 'bottom', rect: { x: 0, y: 0, w: 0, h: 0 } },
    ]);
    expect(v).toEqual({ x: 0, y: 130, w: 1066, h: 470 });
    expect(inRect(500, 300, v)).toBe(true);
    expect(inRect(1200, 300, v)).toBe(false);
    expect(inRect(500, 135, v, 10)).toBe(false);
  });
});

describe('placeEdgeChips', () => {
  const view = { x: 0, y: 130, w: 1440, h: 770 };
  const inner = { x: 10, y: 140, w: 1420, h: 750 };

  it('a chip sits where the line to the target leaves the view, and points at it', () => {
    const [c] = placeEdgeChips([t('a', 3000, 515)], view, []);
    expect(c.side).toBe('right');
    expect(c.x + c.w).toBeCloseTo(inner.x + inner.w);
    expect(c.y + c.h / 2).toBeCloseTo(515, 0);
    expect(Math.abs(c.ang)).toBeLessThan(0.01);
    const [u] = placeEdgeChips([t('u', 720, -2000)], view, []);
    expect(u.side).toBe('top');
    expect(u.y).toBeCloseTo(inner.y);
    expect(u.x + u.w / 2).toBeCloseTo(720, 0);
    expect(u.ang).toBeCloseTo(-Math.PI / 2, 1);
  });

  it('chips for targets in the same direction stack without overlapping', () => {
    const chips = placeEdgeChips([t('a', 3000, 500), t('b', 3000, 505), t('c', 3000, 510), t('d', 3000, 515)], view, []);
    expect(chips).toHaveLength(4);
    sane(chips, view);
    // Deterministic.
    expect(placeEdgeChips([t('d', 3000, 515), t('c', 3000, 510), t('b', 3000, 505), t('a', 3000, 500)], view, [])).toEqual(chips);
  });

  it('steps around the HUD (zoom pad, ticker) and keeps corners to the top and bottom rows', () => {
    const zoom = { x: 1380, y: 700, w: 40, h: 190 };
    const ticker = { x: 22, y: 820, w: 600, h: 70 };
    const targets = [t('r1', 4000, 820), t('r2', 4000, 760), t('b1', 300, 3000), t('b2', 330, 3000), t('corner', 4000, 4000), t('l', -3000, 160)];
    const chips = placeEdgeChips(targets, view, [zoom, ticker]);
    expect(chips.map((c) => c.key).sort()).toEqual(['b1', 'b2', 'corner', 'l', 'r1', 'r2']);
    sane(chips, view, [zoom, ticker]);
  });

  it('drops the least important chips when a side is full, waiting first', () => {
    const small = { x: 0, y: 0, w: 400, h: 300 };
    const many = Array.from({ length: 12 }, (_, i) => t(`w${String(i).padStart(2, '0')}`, 3000, 150, i < 2 ? 2 : 1));
    const chips = placeEdgeChips(many, small, [], { max: 12 });
    sane(chips, small);
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThan(12);
    expect(chips.map((c) => c.key)).toContain('w00');
    expect(chips.map((c) => c.key)).toContain('w01');
    // The overall cap.
    expect(placeEdgeChips(many, view, []).length).toBeLessThanOrEqual(8);
  });

  it('no room, no chips', () => {
    expect(placeEdgeChips([t('a', 3000, 0)], { x: 0, y: 0, w: 50, h: 50 }, [])).toEqual([]);
    expect(placeEdgeChips([], view, [])).toEqual([]);
  });
});
