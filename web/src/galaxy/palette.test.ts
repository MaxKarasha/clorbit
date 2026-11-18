import { describe, expect, it } from 'vitest';
import { branchCol, projectHue, safeHue } from './engine';

// Orange is reserved for "waiting for you": no project or branch color may land there.
const isOrange = (h: number) => h >= 15 && h < 50;

describe('palette', () => {
  it('maps every hue outside the orange band, monotonically', () => {
    let prev = -1;
    for (let h = 0; h < 360; h += 0.5) {
      const s = safeHue(h);
      expect(isOrange(s)).toBe(false);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(360);
      if (h < 340) {
        expect(s).toBeGreaterThan(prev);
        prev = s;
      }
    }
  });

  it('never gives a star or a planet an orange color', () => {
    for (let i = 0; i < 400; i++) {
      const hue = projectHue(`project-${i}`);
      for (let depth = 0; depth < 4; depth++)
        for (let branch = 0; branch < 8; branch++)
          for (let slot = 0; slot < 6; slot++) expect(isOrange(branchCol(hue, depth, branch, slot).h)).toBe(false);
    }
  });

  it('is stable per project name', () => {
    expect(projectHue('clorbit')).toBe(projectHue('clorbit'));
  });
});
