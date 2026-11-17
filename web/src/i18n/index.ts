// Tiny i18n runtime: a module-level current language, t()/tp() lookups and a React hook.
// English is the default; Ukrainian is the second language. Choice order:
// `?lang=` in the URL (hash or search) → localStorage → 'en'.
import { useSyncExternalStore } from 'react';
import en from './en';
import uk from './uk';

export type Lang = 'en' | 'uk';
export const LANGS: Lang[] = ['en', 'uk'];
export type MsgKey = keyof typeof en;
export type Params = Record<string, string | number>;

const DICTS: Record<Lang, Record<MsgKey, string>> = { en, uk };
const STORAGE_KEY = 'clorbit.lang';

const isLang = (v: unknown): v is Lang => v === 'en' || v === 'uk';

function urlLang(): Lang | null {
  if (typeof window === 'undefined') return null;
  const hashQ = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const v = hashQ.get('lang') ?? new URLSearchParams(window.location.search).get('lang');
  return isLang(v) ? v : null;
}

function storedLang(): Lang | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

function persist(l: Lang) {
  try {
    window.localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* storage unavailable (private mode, blocked site data) */
  }
}

/** The language was chosen in this browser (URL or a saved choice), not just the default. */
const explicit = urlLang() != null || storedLang() != null;
export function hasExplicitLang(): boolean {
  return explicit;
}

let current: Lang = urlLang() ?? storedLang() ?? 'en';
const listeners = new Set<() => void>();

function apply(l: Lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}
apply(current);

/** Switches the UI language, persists it and re-renders subscribers. */
export function setLang(l: Lang): void {
  persist(l);
  if (l === current) return;
  current = l;
  apply(l);
  listeners.forEach((fn) => fn());
}

export function getLang(): Lang {
  return current;
}

/** BCP 47 locale for Intl formatters. */
export function locale(l: Lang = current): string {
  return l === 'uk' ? 'uk-UA' : 'en-US';
}

if (typeof window !== 'undefined') {
  // A `?lang=` in the URL wins whenever it changes.
  window.addEventListener('hashchange', () => {
    const l = urlLang();
    if (l && l !== current) setLang(l);
  });
  const l = urlLang();
  if (l) persist(l);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** Calls cb with the new language whenever it changes. */
export function onLangChange(cb: (l: Lang) => void): () => void {
  return subscribe(() => cb(current));
}

/** Current language; re-renders the component when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

function fill(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Translated message with `{name}` placeholders. Falls back to English, then to the key. */
export function t(key: MsgKey, params?: Params): string {
  const s = DICTS[current][key] ?? DICTS.en[key] ?? key;
  return fill(s, params);
}

const pluralRules: Partial<Record<Lang, Intl.PluralRules>> = {};
/**
 * Plural message. Dictionary values hold forms separated by `|`:
 * en — `one|other`, uk — `one|few|many`. `{n}` is replaced by the count (or params.n).
 */
export function tp(key: MsgKey, n: number, params?: Params): string {
  const raw = DICTS[current][key] ?? DICTS.en[key] ?? key;
  const forms = raw.split('|');
  const rules = (pluralRules[current] ??= new Intl.PluralRules(locale(current)));
  const cat = rules.select(Math.round(Math.abs(n)));
  const idx = current === 'uk' ? (cat === 'one' ? 0 : cat === 'few' ? 1 : 2) : cat === 'one' ? 0 : 1;
  const form = forms[Math.min(idx, forms.length - 1)];
  return fill(form, { n, ...params });
}

/** Adds `lang=<current>` to an API path so server-generated text follows the UI language. */
export function withLang(path: string, l: Lang = current): string {
  if (/[?&]lang=/.test(path)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}lang=${l}`;
}
