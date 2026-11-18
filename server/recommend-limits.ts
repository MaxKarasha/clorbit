// Recommendations for the subscription-limits panel (page 'limits'), from the status-line capture and its forecast:
//  A. no limits source: how to connect it (/clorbit statusline shows a preview; nothing changes until you apply it);
//  B. the window runs out before its reset: what eats it now (projects, main sessions vs subagent types, models) and
//     the levers — other recommendations' savings expressed as a share of the window (an estimate);
//  C. otherwise the weekly pace: used % against the elapsed share of the 7-day window.
// Plans without a 5-hour window (only the weekly one) never get a 5-hour card.
import type { Insight, InsightPage, InsightTarget, LimitsForecast, Range, WindowForecast } from '../shared/api.ts';
import { TOKEN_WEIGHTS, WINDOW_MS } from '../shared/forecast';
import { homePage } from '../shared/insights';
import { Ctx } from './analytics';
import type { Lang } from './i18n';
import { insightText } from './insights-text';
import { stableId } from './recommend';
import type { Store } from './store';
import type { FileSummary } from './types';
import { localDate, type T4 } from './util';

const H = 3_600_000;
/** B: levers shown, and the most of the projected use they are assumed to remove together. */
const LEVERS_MAX = 4;
const LEVERS_CAP = 0.9;
/** C: the pace needs this much of the week behind it. */
const PACE_MIN_ELAPSED = 0.05;

const weight = (t: T4) => t[0] * TOKEN_WEIGHTS.input + t[1] * TOKEN_WEIGHTS.output + t[2] * TOKEN_WEIGHTS.cacheRead + t[3] * TOKEN_WEIGHTS.cacheWrite;
const shortModel = (m: string) => m.replace(/^claude-/, '').replace(/-(\d+)-(\d+)(\[1m\])?$/, ' $1.$2').replace(/-(\d+)$/, ' $1').replace(/^\w/, (c) => c.toUpperCase());

/** Other recommendations over the window's days: their savings become levers. */
export interface Levers { cards: Insight[]; range: Range }

/** Weighted token use since `from` (as subscription limits roughly count it): by project, by agent (main sessions or a
 *  subagent type) — from the per-hour buckets — and by model (per-day buckets, whole days). Shares 0..1. */
export function windowUsage(store: Store, from: number, now: number) {
  const ctx = new Ctx(store);
  const fromDate = localDate(from);
  const proj = new Map<string, number>(), agent = new Map<string, number>(), model = new Map<string, number>();
  let total = 0, modelTotal = 0, raw = 0;
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (const s of store.files.values()) {
    if (s.lastTs < from) continue;
    let w = 0;
    for (const [date, b] of Object.entries(s.days)) {
      if (date < fromDate) continue;
      const [y, mo, d] = date.split('-').map(Number);
      for (const [h, t] of Object.entries(b.hours)) {
        const start = new Date(y, mo - 1, d, Number(h)).getTime();
        if (start + H <= from || start > now) continue;
        w += weight(t);
        raw += t[0] + t[1] + t[2] + t[3];
      }
      for (const [m, u] of Object.entries(b.models)) { const v = weight(u.t); add(model, m, v); modelTotal += v; }
    }
    if (!w) continue;
    total += w;
    add(proj, ctx.project(s), w);
    add(agent, s.agentId === null ? '' : (s.meta?.agentType ?? 'general-purpose'), w);
  }
  const top = (m: Map<string, number>, of: number) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([k, v]) => ({ key: k, share: of ? v / of : 0 }));
  // `mix`: weighted per raw token, on average (cache reads dominate raw tokens but weigh little).
  return { total, mix: raw ? total / raw : 1, projects: top(proj, total), agents: top(agent, total), models: top(model, modelTotal) };
}

/** Projected use at the reset without the 100% cap: the current % plus the burn until the reset. */
function uncapped(w: WindowForecast, now: number): number | null {
  if (w.pct == null || w.resetsAt == null) return null;
  return w.pct + w.ratePerHour * Math.max(0, w.resetsAt - now) / H;
}

const runsOut = (w: WindowForecast) => !w.noWindow && w.pct != null && (!!w.exhausted || (w.hitsAt != null && w.resetsAt != null && w.hitsAt < w.resetsAt));

/** `leversFor(from)`: the other cards over the days since `from` (the window's start), or null. */
export function limitRecommendations(store: Store, f: LimitsForecast, lang: Lang, leversFor: (from: number) => Levers | null): Insight[] {
  const TT = insightText(lang);
  const T = TT.rec.limits;
  const now = f.now;

  // ---------- A. No source ----------
  if (f.source !== 'statusline') {
    return [{
      id: 'limits-connect',
      severity: 'info',
      title: T.connect.title,
      detail: T.connect.detail,
      evidence: T.connect.evidence,
      fix: '/clorbit statusline',
      pages: ['limits'],
    }];
  }

  const startOf = (w: WindowForecast) => Math.min(now, w.window === '7d' && w.resetsAt != null ? w.resetsAt - WINDOW_MS['7d'] : now - WINDOW_MS[w.window]);
  const consumers = (w: WindowForecast) => {
    const u = windowUsage(store, startOf(w), now);
    if (!u.total) return [];
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    return [
      T.eat.projects(u.projects.map((p) => `${p.key} ${pct(p.share)}`).join(', ')),
      T.eat.agents(u.agents.map((a) => `${a.key ? a.key : T.eat.main} ${pct(a.share)}`).join(', ')),
      ...(u.models.length ? [T.eat.models(u.models.map((m) => `${shortModel(m.key)} ${pct(m.share)}`).join(', '))] : []),
    ];
  };
  const out: Insight[] = [];

  // ---------- B. The window runs out before its reset ----------
  const w = runsOut(f.sevenDay) ? f.sevenDay : runsOut(f.fiveHour) ? f.fiveHour : null;
  if (w) {
    const total = uncapped(w, now) ?? 100;
    const leverRows: { ins: Insight; page: InsightPage | null; pct: number }[] = [];
    const levers = leversFor(startOf(w));
    const use = windowUsage(store, startOf(w), now);
    if (levers && use.total > 0) {
      const spanDays = Math.max(1, Math.round((new Date(`${levers.range.to}T00:00:00`).getTime() - new Date(`${levers.range.from}T00:00:00`).getTime()) / 86_400_000) + 1);
      for (const ins of levers.cards) {
        const est = ins.estSavingTokens ?? 0;
        if (est <= 0 || ins.pages?.includes('limits')) continue;
        // A 30-day projection is scaled to the window's days; range savings already cover them.
        const tokens = ins.saving?.basis === 'projection' ? (est * spanDays) / (ins.saving.days ?? 30) : est;
        // Context that is no longer loaded or rebuilt is mostly cache writes; a cheaper model saves a share of
        // everything, so its tokens' worth gets the window's average weight.
        const weighted = tokens * (ins.saving?.costShare ? use.mix : TOKEN_WEIGHTS.cacheWrite);
        const share = Math.min(1, weighted / use.total);
        if (share >= 0.002) leverRows.push({ ins, page: homePage(ins), pct: share * total });
      }
    }
    leverRows.sort((a, b) => b.pct - a.pct || a.ins.id.localeCompare(b.ins.id));
    const shown = leverRows.slice(0, LEVERS_MAX);
    const leverPct = Math.min(total * LEVERS_CAP, shown.reduce((n, r) => n + r.pct, 0));
    const early = w.exhausted ? null : (w.resetsAt ?? now) - (w.hitsAt ?? now);
    const pageName = (p: InsightPage | null) => (p ? T.page[p] : '');
    out.push({
      id: stableId('limits-runout', [w.window, String(w.resetsAt ? Math.round(w.resetsAt / H) : 0)]),
      severity: w.exhausted || (w.window === '7d' && (early ?? 0) >= 24 * H) ? 'high' : 'warn',
      title: w.exhausted ? T.runout.titleExhausted(w.window, w.resetsAt ? w.resetsAt - now : null) : T.runout.title(w.window, early ?? 0),
      detail: T.runout.detail(w.window, shown.length > 0),
      evidence: [
        T.runout.now(w.window, Math.round(w.pct ?? 0), w.ratePerHour, w.hitsAt, w.resetsAt, Math.round(total)),
        ...consumers(w),
        ...shown.map((r) => T.runout.lever(r.ins.title, r.pct, w.window, pageName(r.page))),
      ],
      fix: shown.length ? undefined : T.runout.fixNone,
      pages: ['limits'],
      ...(leverPct >= 0.5 ? { saving: { windowPct: Math.round(leverPct * 10) / 10, window: w.window } } : {}),
      targets: shown.length ? shown.map((r): InsightTarget => ({ key: r.ins.id, label: r.ins.title, kind: 'other', note: T.runout.leverNote(r.pct, w.window, pageName(r.page)) })) : undefined,
      ...(shown[0]?.page ? { seeAlso: shown[0].page } : {}),
    });
    return out;
  }

  // ---------- C. Weekly pace ----------
  const s = f.sevenDay;
  if (!s.noWindow && s.pct != null && s.resetsAt != null && !s.reset) {
    const elapsed = Math.min(1, Math.max(0, 1 - (s.resetsAt - now) / WINDOW_MS['7d']));
    if (elapsed >= PACE_MIN_ELAPSED) {
      // Without a forecast (a thin history), a straight line through the use so far.
      const line = s.pct / elapsed;
      const projected = s.pctAtReset ?? Math.min(100, line);
      const room = projected < 80;
      out.push({
        id: stableId('limits-pace', [String(Math.round(s.resetsAt / H))]),
        severity: room ? 'info' : 'warn',
        title: room ? T.pace.titleRoom(Math.round(projected)) : s.pctAtReset == null && line >= 100 ? T.pace.titleOver(Math.round(line)) : T.pace.titleTight(Math.round(projected)),
        detail: T.pace.detail(Math.round(s.pct), elapsed, s.resetsAt - now, s.pctAtReset != null),
        evidence: [T.pace.line(Math.round(s.pct), elapsed, Math.round(projected)), ...consumers(s)],
        pages: ['limits'],
      });
    }
  }
  return out;
}
