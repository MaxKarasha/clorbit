/** Deterministic generator: the same range always yields the same demo data. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number | string) {
  let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    weighted: <T,>(arr: readonly (readonly [T, number])[]): T => {
      const total = arr.reduce((s, [, w]) => s + w, 0);
      let x = next() * total;
      for (const [v, w] of arr) {
        x -= w;
        if (x <= 0) return v;
      }
      return arr[arr.length - 1][0];
    },
    id: (len = 8) => {
      const abc = '0123456789abcdef';
      let s = '';
      for (let i = 0; i < len; i++) s += abc[Math.floor(next() * 16)];
      return s;
    },
  };
}
export type Rng = ReturnType<typeof rng>;
