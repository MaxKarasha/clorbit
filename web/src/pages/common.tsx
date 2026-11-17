import type { ReactNode } from 'react';
import { useApi, type ApiState } from '../lib/api';
import { fmtDay } from '../lib/format';
import { useRange, type ActiveRange } from '../lib/router';
import { t } from '../i18n';
import { Chip, ErrorState, Loading } from '../components/ui';

export function rangeQs(r: ActiveRange): string {
  return `from=${r.from}&to=${r.to}`;
}

export function rangeCaption(r: ActiveRange): string {
  return r.from === r.to ? fmtDay(r.from) : `${fmtDay(r.from)} — ${fmtDay(r.to)}`;
}

/** Analytics request for the current range. */
export function useRangeApi<T>(endpoint: string, extra = ''): ApiState<T> & { range: ActiveRange } {
  const range = useRange();
  const state = useApi<T>(`${endpoint}?${rangeQs(range)}${extra}`);
  return { ...state, range };
}

/** Loading / error / content, the same on every screen. */
export function Guard<T>({ state, children, label }: { state: ApiState<T>; children: (data: T) => ReactNode; label?: string }) {
  if (state.loading) return <Loading label={label} />;
  if (state.error && !state.data) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <Loading label={label} />;
  return <div className={state.refreshing ? 'is-refreshing' : undefined}>{children(state.data)}</div>;
}

export function Eyebrow({ section, range }: { section: string; range: ActiveRange }) {
  return (
    <>
      <span>{section}</span>
      <span className="eyebrow__sep" aria-hidden>
        ·
      </span>
      <span className="mono">{rangeCaption(range)}</span>
    </>
  );
}

/** "Never used" chip; a function so the text follows the current language. */
export function unusedChip() {
  return <Chip tone="muted">{t('common.unused')}</Chip>;
}
