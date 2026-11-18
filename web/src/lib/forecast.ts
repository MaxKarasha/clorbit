// How a limits forecast reads in the UI: the compact line, its severity, the tick and the tooltip.
// Shared by the galaxy's status bar and the Overview's limits panel.
import type { WindowForecast } from '@shared/api';
import { forecastSeverity } from '@shared/forecast';
import { locale, t, type MsgKey } from '../i18n';
import { fmtDuration } from './format';

export type Severity = 'out' | 'warn' | 'ok' | 'none';
export const SEV_COLOR: Record<Severity, string> = { out: '#FF6B8B', warn: '#FFD66B', ok: '#7FE0C4', none: '#9FB0CC' };

/** "14:20" today, "Thu 14:20" on another day. */
export function whenText(ts: number, now: number): string {
  const d = new Date(ts);
  const same = d.toDateString() === new Date(now).toDateString();
  return d.toLocaleString(locale(), same ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

/** The compact line under a ring, its severity, and the tooltip. */
export function forecastView(f: WindowForecast, label: string, now: number): { sub: string; sev: Severity; tick: number | null; title: string } {
  const lines: string[] = [];
  if (f.pct != null) lines.push(t('gx.fc.tipTitle', { w: label, pct: Math.round(f.pct) }));
  if (f.reset) return { sub: t('gx.fc.reset'), sev: 'none', tick: null, title: [...lines, t('gx.fc.tipReset')].join('\n') };
  if (f.resetsAt) lines.push(t('gx.fc.tipResets', { at: whenText(f.resetsAt, now) }));
  const basis = f.basis === 'none' ? t('gx.fc.basis.none') : t(f.basis === 'tokens' ? 'gx.fc.basis.tokens' : 'gx.fc.basis.limits', { n: f.points });
  if (f.basis !== 'none' && !f.exhausted) {
    lines.push(t('gx.fc.tipRate', { rate: f.ratePerHour < 10 ? f.ratePerHour.toFixed(1) : String(Math.round(f.ratePerHour)) }));
    if (f.hitsAt && f.resetsAt) lines.push(t('gx.fc.tipHits', { at: whenText(f.hitsAt, now), left: fmtDuration(f.resetsAt - f.hitsAt) }));
    if (f.pctAtReset != null) lines.push(t('gx.fc.tipAtReset', { pct: Math.round(f.pctAtReset) }));
  }
  lines.push(f.basis === 'none' ? basis : t('gx.fc.tipConf', { c: t(`gx.fc.conf.${f.confidence}` as MsgKey), basis }));
  const title = lines.join('\n');
  if (f.exhausted) return { sub: t('gx.fc.out', { time: f.resetsAt ? whenText(f.resetsAt, now) : '—' }), sev: 'out', tick: 100, title };
  if (f.basis === 'none') return { sub: f.resetsAt ? t('gx.bar.resets', { at: whenText(f.resetsAt, now) }) : '', sev: 'none', tick: null, title };
  const sev = forecastSeverity(f, now);
  const tick = f.pctAtReset ?? (f.hitsAt ? 100 : null);
  if (f.hitsAt) return { sub: t(f.confidence === 'low' ? 'gx.fc.runsOutApprox' : 'gx.fc.runsOut', { time: whenText(f.hitsAt, now) }), sev, tick, title };
  return { sub: t('gx.fc.lasts'), sev: 'ok', tick, title };
}

