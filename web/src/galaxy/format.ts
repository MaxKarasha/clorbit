// Number and time formatting for the galaxy; follows the UI language.
import type { Tokens } from '@shared/api';
import { getLang, t } from '../i18n';

const dec = (n: number, d = 1) => {
  const s = n.toFixed(d).replace(/\.0+$/, '');
  return getLang() === 'uk' ? s.replace('.', ',') : s;
};

export function fmtTok(n: number): string {
  if (!isFinite(n)) return '—';
  if (n >= 1e9) return t('fmt.billion', { n: dec(n / 1e9, 2) });
  if (n >= 1e6) return t('fmt.million', { n: dec(n / 1e6, n >= 1e8 ? 0 : 1) });
  if (n >= 1e3) return t('fmt.thousand', { n: dec(n / 1e3, n >= 1e5 ? 0 : 1) });
  return String(Math.round(n));
}
export const tSum = (tk: Tokens) => tk.input + tk.output + tk.cacheRead + tk.cacheWrite;

export function fmtDur(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return t('fmt.sec', { n: s });
  const m = Math.floor(s / 60);
  if (m < 60) return t('fmt.min', { n: m });
  const h = Math.floor(m / 60);
  if (h < 48) return t('fmt.hourMin', { h, m: m % 60 });
  return t('fmt.days', { n: Math.floor(h / 24) });
}
export function fmtAgo(ts: number, now = Date.now()): string {
  const d = now - ts;
  return d < 5000 ? t('fmt.justNow') : t('fmt.ago', { d: fmtDur(d) });
}
export function fmtClock(ts: number): string {
  return new Date(ts).toTimeString().slice(0, 8);
}
export function fmtPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
