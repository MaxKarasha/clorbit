import { useSyncExternalStore } from 'react';
import type { Range } from '@shared/api';
import { t, useLang, type MsgKey } from '../i18n';

/** Tiny hash router: '#/analytics/overview?range=7d' */
export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function readHash(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

let cachedHash = '';
let cachedRoute: Route = parseRoute('/');

export function parseRoute(hash: string): Route {
  const [rawPath, rawQuery = ''] = hash.split('?');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return {
    path,
    parts: path.split('/').filter(Boolean).map(decodeURIComponent),
    query: new URLSearchParams(rawQuery),
  };
}

function getSnapshot(): Route {
  const h = readHash();
  if (h !== cachedHash) {
    cachedHash = h;
    cachedRoute = parseRoute(h);
  }
  return cachedRoute;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Params that carry over between screens: range and demo mode. */
const STICKY = ['range', 'from', 'to', 'demo', 'mock'];

/**
 * Builds a link that keeps the current route's range and demo mode.
 * patch: a null value removes the param.
 */
export function href(path: string, patch: Record<string, string | null | undefined> = {}): string {
  const cur = getSnapshot().query;
  const q = new URLSearchParams();
  for (const k of STICKY) {
    const v = cur.get(k);
    if (v != null) q.set(k, v);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') q.delete(k);
    else q.set(k, v);
  }
  const qs = q.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(path: string, patch: Record<string, string | null | undefined> = {}): void {
  window.location.hash = href(path, patch).slice(1);
}

/** Updates the current route's params without changing the path. */
export function setQuery(patch: Record<string, string | null | undefined>): void {
  const r = getSnapshot();
  const q = new URLSearchParams(r.query);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') q.delete(k);
    else q.set(k, v);
  }
  const qs = q.toString();
  window.location.hash = `${r.path}${qs ? `?${qs}` : ''}`;
}

// ---------- Range ----------

export type RangePreset = '24h' | '7d' | '14d' | '30d' | '90d';
export const RANGE_PRESETS: { id: RangePreset; labelKey: MsgKey; days: number }[] = [
  { id: '24h', labelKey: 'range.24h', days: 2 },
  { id: '7d', labelKey: 'range.7d', days: 7 },
  { id: '14d', labelKey: 'range.14d', days: 14 },
  { id: '30d', labelKey: 'range.30d', days: 30 },
  { id: '90d', labelKey: 'range.90d', days: 90 },
];

/** Localized preset label, evaluated at render time. */
export function presetLabel(id: RangePreset): string {
  const p = RANGE_PRESETS.find((r) => r.id === id);
  return p ? t(p.labelKey) : id;
}
export const DEFAULT_RANGE: RangePreset = '14d';

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export interface ActiveRange extends Range {
  preset: RangePreset | null;
  /** Localized for the language that was current when the range was computed (useRange recomputes on change). */
  label: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function rangeFromQuery(q: URLSearchParams, now = new Date()): ActiveRange {
  const from = q.get('from');
  const to = q.get('to');
  if (from && to && DATE_RE.test(from) && DATE_RE.test(to)) {
    return { from, to, preset: null, label: `${from} — ${to}` };
  }
  const id = (q.get('range') as RangePreset) || DEFAULT_RANGE;
  const p = RANGE_PRESETS.find((r) => r.id === id) ?? RANGE_PRESETS.find((r) => r.id === DEFAULT_RANGE)!;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (p.days - 1));
  return { from: dayKey(start), to: dayKey(now), preset: p.id, label: t(p.labelKey) };
}

export function useRange(): ActiveRange {
  const r = useRoute();
  const lang = useLang();
  const key = `${lang}|${r.query.get('range')}|${r.query.get('from')}|${r.query.get('to')}`;
  return rangeMemo(key, r.query);
}

let lastRangeKey = '';
let lastRange: ActiveRange | null = null;
function rangeMemo(key: string, q: URLSearchParams): ActiveRange {
  if (key !== lastRangeKey || !lastRange) {
    lastRangeKey = key;
    lastRange = rangeFromQuery(q);
  }
  return lastRange;
}
