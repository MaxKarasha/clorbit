// A small glowing pill with the subscription plan, e.g. «Ultra · 20×». Used in the galaxy's status bar,
// the Overview's limits panel and Settings → Connection. Renders nothing without a known plan.
import type { Plan } from '@shared/api';
import { locale, t } from '../i18n';

/** "Ultra · 20×", "Pro", or '' when nothing is known. */
export function planLabel(p: Plan | null | undefined): string {
  return p ? [p.name, p.tier].filter(Boolean).join(' · ') : '';
}

/** "Mar 2026" in the UI language; null when unknown. */
export function planSince(p: Plan | null | undefined): string | null {
  const ms = p?.since ? Date.parse(p.since) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString(locale(), { month: 'short', year: 'numeric' }) : null;
}

/** Colour family: the top tiers glow warm, Pro cool, anything else neutral. */
function tone(p: Plan): 'top' | 'pro' | 'plain' {
  const k = `${p.type ?? ''} ${p.name ?? ''}`.toLowerCase();
  if (/max|ultra|enterprise|team/.test(k) || (p.tier && Number.parseInt(p.tier, 10) >= 5)) return 'top';
  if (/pro/.test(k)) return 'pro';
  return 'plain';
}

export default function PlanBadge({ plan, className }: { plan: Plan | null | undefined; className?: string }) {
  const label = planLabel(plan);
  if (!plan || !label) return null;
  const since = planSince(plan);
  const title = [
    t('plan.tip', { plan: label }),
    plan.tier ? t('plan.tipTier', { tier: plan.tier }) : null,
    since ? t('plan.tipSince', { date: since }) : null,
  ].filter(Boolean).join('\n');
  return (
    <span className={`plan-badge plan-badge--${tone(plan)}${className ? ` ${className}` : ''}`} title={title}>
      <svg className="plan-badge__glyph" viewBox="0 0 10 10" aria-hidden>
        <path d="M5 0 C5.4 3.3 6.7 4.6 10 5 C6.7 5.4 5.4 6.7 5 10 C4.6 6.7 3.3 5.4 0 5 C3.3 4.6 4.6 3.3 5 0 Z" />
      </svg>
      {label}
    </span>
  );
}
