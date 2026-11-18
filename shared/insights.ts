// Pure helpers over recommendation cards, shared by the server and the web app (demo data, Insights page).
import type { Insight, InsightPage } from './api';

const SEV_RANK = { high: 0, warn: 1, info: 2 } as const;

/** The tab a card belongs to: the first of its `pages` (null: Insights page only). */
export function homePage(ins: Insight): InsightPage | null {
  return ins.pages?.[0] ?? null;
}

/** How many cards the Overview strip shows. */
export const OVERVIEW_MAX = 3;

/** Highest saving first (tokens, then waiting time), then severity, then id (stable). */
export function bySavings(a: Insight, b: Insight): number {
  return (b.estSavingTokens ?? 0) - (a.estSavingTokens ?? 0)
    || (b.saving?.waitMs ?? 0) - (a.saving?.waitMs ?? 0)
    || SEV_RANK[a.severity] - SEV_RANK[b.severity]
    || a.id.localeCompare(b.id);
}

/**
 * The Overview's picks: the best cards of every tab, ranked by savings. A card qualifies when it has a measured
 * saving (tokens or waiting time) or is at least "worth a look". Cards of the limits panel are left out (the panel
 * is on the Overview itself), and so are cards without a tab of their own. The strip shows the first OVERVIEW_MAX
 * that are not hidden, so a few more are returned.
 */
export function pickOverview(list: Insight[], n = OVERVIEW_MAX * 4): Insight[] {
  return list
    .filter((i) => {
      const home = homePage(i);
      if (!home || home === 'limits' || home === 'session' || home === 'overview') return false;
      return (i.estSavingTokens ?? 0) > 0 || (i.saving?.waitMs ?? 0) > 0 || i.severity !== 'info';
    })
    .sort(bySavings)
    .slice(0, n);
}

/**
 * The Insights page totals without double counting: `estSavingTokens` is set only on cards whose saving is their own
 * (a card that points to another card's fix, a limits card or a diagnosis leaves it out); waiting time is summed apart.
 */
export function insightTotals(list: Insight[]): { tokens: number; waitMs: number } {
  let tokens = 0, waitMs = 0;
  for (const i of list) {
    tokens += i.estSavingTokens ?? 0;
    waitMs += i.saving?.waitMs ?? 0;
  }
  return { tokens, waitMs };
}
