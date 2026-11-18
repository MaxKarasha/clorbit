// Which subscription windows a plan has, and how the UI decides whether to show a 5-hour window.
// Data from the status line always wins; the table below only fills in while there is no reading yet.
import type { Limits, Plan, WindowPresence } from './api';

/**
 * Known windows by plan name (first match wins). Easy to update when Anthropic changes the plans:
 * add a row, or drop one when a plan gets a window back. Anything not listed is 'unknown'.
 */
export const PLAN_WINDOWS: { match: RegExp; fiveHour: WindowPresence; sevenDay: WindowPresence }[] = [
  // Ultra has only the weekly limit.
  { match: /ultra/i, fiveHour: 'none', sevenDay: 'present' },
];

export function planWindows(plan: Plan | null | undefined): { fiveHour: WindowPresence; sevenDay: WindowPresence } {
  const name = plan?.name ?? '';
  const row = name ? PLAN_WINDOWS.find((r) => r.match.test(name)) : undefined;
  return row ? { fiveHour: row.fiveHour, sevenDay: row.sevenDay } : { fiveHour: 'unknown', sevenDay: 'unknown' };
}

/** What the status line says about the 5-hour window (older servers without `fiveHourWindow`: inferred from the %). */
export function dataFiveHour(limits: Limits | null | undefined): WindowPresence {
  if (!limits) return 'unknown';
  if (limits.fiveHourWindow) return limits.fiveHourWindow;
  return limits.fiveHourPct != null ? 'present' : 'unknown';
}

/** The 5-hour window to show: the status line's answer when it has one, else the plan table's. */
export function fiveHourWindow(data: WindowPresence, plan: Plan | null | undefined): { state: WindowPresence; from: 'data' | 'plan' | null } {
  if (data !== 'unknown') return { state: data, from: 'data' };
  const p = planWindows(plan).fiveHour;
  return p !== 'unknown' ? { state: p, from: 'plan' } : { state: 'unknown', from: null };
}
