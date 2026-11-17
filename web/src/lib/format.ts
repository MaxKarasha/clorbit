// Number, date and duration formatting for the analytics pages; follows the UI language.
import type { Tokens } from '@shared/api';
import { getLang, locale, t, type Lang } from '../i18n';

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(digits: number, l: Lang = getLang()): Intl.NumberFormat {
  const key = `${l}:${digits}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale(l), { maximumFractionDigits: digits, minimumFractionDigits: 0 });
    nfCache.set(key, f);
  }
  return f;
}

/** Integer with thousands separators: 1,430 (en) · 1 430 (uk). */
export function fmtInt(n: number): string {
  return nf(0).format(Math.round(n));
}

/** Tokens in words: 384K, 1.24M, 2.1B (en) · 384 тис., 1,24 млн, 2,1 млрд (uk). */
export function fmtTokens(n: number): string {
  const a = Math.abs(n);
  if (a < 1000) return nf(0).format(Math.round(n));
  if (a < 1e6) return t('fmt.thousand', { n: nf(a < 1e4 ? 1 : 0).format(n / 1e3) });
  if (a < 1e9) return t('fmt.million', { n: nf(a < 1e7 ? 2 : 1).format(n / 1e6) });
  return t('fmt.billion', { n: nf(2).format(n / 1e9) });
}

/** Dense format for chart axes and labels: 12.3k · 1.2M. */
export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a < 1000) return nf(0).format(Math.round(n));
  if (a < 1e6) return `${nf(a < 1e4 ? 1 : 0).format(n / 1e3)}k`;
  if (a < 1e9) return `${nf(a < 1e7 ? 2 : 1).format(n / 1e6)}M`;
  return `${nf(2).format(n / 1e9)}B`;
}

export function fmtPct(x: number, digits = 1): string {
  return t('fmt.pct', { n: nf(digits).format(x * 100) });
}

export function fmtDuration(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return t('fmt.sec', { n: s });
  const m = Math.round(s / 60);
  if (m < 60) return t('fmt.min', { n: m });
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return mm ? t('fmt.hourMin', { h, m: mm }) : t('fmt.hour', { n: h });
  const d = Math.floor(h / 24);
  return t('fmt.dayHour', { d, h: h % 24 });
}

type DateFmts = { short: Intl.DateTimeFormat; time: Intl.DateTimeFormat; timeSec: Intl.DateTimeFormat; weekday: Intl.DateTimeFormat; rel: Intl.RelativeTimeFormat };
const dfCache = new Map<Lang, DateFmts>();
function df(l: Lang = getLang()): DateFmts {
  let f = dfCache.get(l);
  if (!f) {
    const loc = locale(l);
    f = {
      short: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }),
      time: new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' }),
      timeSec: new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      weekday: new Intl.DateTimeFormat(loc, { weekday: 'short' }),
      rel: new Intl.RelativeTimeFormat(loc, { numeric: 'auto' }),
    };
    dfCache.set(l, f);
  }
  return f;
}

export function parseDay(d: string): Date {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd);
}

/** '2026-11-17' → 'Nov 17' (en) · '17 лист.' (uk). */
export function fmtDay(d: string | number): string {
  return df().short.format(typeof d === 'string' ? parseDay(d) : new Date(d));
}

export function fmtWeekday(d: string): string {
  return df().weekday.format(parseDay(d));
}

export function fmtTime(ts: number, seconds = false): string {
  const f = df();
  return (seconds ? f.timeSec : f.time).format(new Date(ts));
}

export function fmtDateTime(ts: number): string {
  const f = df();
  return `${f.short.format(new Date(ts))}, ${f.time.format(new Date(ts))}`;
}

export function fmtAgo(ts: number | undefined, now = Date.now()): string {
  if (!ts) return '—';
  const diff = (ts - now) / 1000;
  const a = Math.abs(diff);
  const rtf = df().rel;
  if (a < 60) return t('fmt.justNow');
  if (a < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (a < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return rtf.format(Math.round(diff / (86400 * 30)), 'month');
}

export function sumTokens(tk: Tokens): number {
  return tk.input + tk.output + tk.cacheRead + tk.cacheWrite;
}

/** Short model name: 'claude-opus-5-5' → 'Opus 5.5'. */
export function fmtModel(m: string | null | undefined): string {
  if (!m) return '—';
  const one = m.includes('[1m]') ? ' · 1M' : '';
  const base = m.replace(/\[1m\]/, '').replace(/^claude-/, '');
  const match = base.match(/^([a-z]+)-(\d+)(?:-(\d+))?/);
  if (!match) return m;
  const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const ver = match[3] && match[3].length <= 2 ? `${match[2]}.${match[3]}` : match[2];
  return `${name} ${ver}${one}`;
}
