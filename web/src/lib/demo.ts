import { useRoute } from './router';

/**
 * Demo mode: invented data instead of the server. It is only ever turned on explicitly —
 * `?demo=1` (or the older alias `?mock=1`) in the hash or the page URL, or the "Try the demo"
 * buttons, which add `demo=1` to the hash. The param is sticky (see router.ts), so demo mode
 * survives navigation between the galaxy and analytics. `?mock=scan` is demo mode with a
 * history scan in progress.
 */

const KEYS = ['demo', 'mock'] as const;

function hashQuery(): URLSearchParams {
  return new URLSearchParams(window.location.hash.split('?')[1] ?? '');
}

/** The raw demo param value ('1', 'scan', …) or null when demo mode is off. */
export function demoValue(): string | null {
  for (const q of [hashQuery(), new URLSearchParams(window.location.search)]) {
    for (const k of KEYS) {
      const v = q.get(k);
      if (v != null) return v === '0' ? null : v;
    }
  }
  return null;
}

export function isDemo(): boolean {
  return demoValue() != null;
}

/** Re-renders on navigation, so entering or leaving demo mode updates every screen. */
export function useDemo(): boolean {
  useRoute();
  return isDemo();
}

function hashWith(patch: (q: URLSearchParams) => void): string {
  const [path, qs = ''] = window.location.hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(qs);
  patch(q);
  const s = q.toString();
  return `${path || '/'}${s ? `?${s}` : ''}`;
}

/** Turns demo mode on for the current screen (and, through the sticky param, the next ones). */
export function enterDemo(): void {
  window.location.hash = hashWith((q) => {
    q.delete('mock');
    q.set('demo', '1');
  });
}

/** Leaves demo mode and shows the user's own data on the current screen. */
export function exitDemo(): void {
  const search = new URLSearchParams(window.location.search);
  const inSearch = KEYS.some((k) => search.has(k));
  const hash = hashWith((q) => KEYS.forEach((k) => q.delete(k)));
  if (inSearch) {
    // The param is in the page URL: rewrite it and reload so nothing demo-related lingers.
    KEYS.forEach((k) => search.delete(k));
    const s = search.toString();
    window.location.replace(`${window.location.pathname}${s ? `?${s}` : ''}#${hash}`);
    return;
  }
  window.location.hash = hash;
}
