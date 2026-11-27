// Recommendations for the "Sessions" tab (and, scoped to one session, the Session page):
//  A. frequent auto-compactions: split long tasks, /compact with a focus earlier, /clear between unrelated tasks
//     (a CLAUDE.md note for long tasks is the one concrete change);
//  B. idle gaps that expired the prompt cache: the next turn wrote the whole context again (measured from cache
//     writes after the gap, v9 summaries); the saving is what /clear or a fresh session would not have re-written;
//  C. sessions that keep running with a nearly full context (> 85% of the window);
//  D. raised effort (xhigh / max) on simple prompt rounds — a review, no saving claimed;
//  E. automated sessions (claude -p, SDK, scheduled routines, the GitHub Action) that burn a large share of tokens;
//  F. days with a low cache hit rate, with the causes visible in the data (idle-gap rebuilds, model switches,
//     compactions, many new sessions and subagents). The measurable part of the saving is card B's.
// `scope: 'session'` runs A–C over one session's files (see sessionView) with lower thresholds.
import type { Insight, InsightTarget, Range } from '../shared/api.ts';
import { sessionKind } from '../shared/automation';
import { buildPrompts, instructionNoteItem, PROMPT_NOTES } from '../shared/prompts';
import { Ctx } from './analytics';
import type { Lang } from './i18n';
import { insightText } from './insights-text';
import { stableId, type RecommendEnv } from './recommend';
import { Store } from './store';
import type { DayBucket, FileSummary } from './types';
import { contextLimitFor, estTokens, localDate, sumT4 } from './util';
import { sessionTitle } from './titles';

/** Effort levels above Claude Code's usual default ("high" is the default for the top models, so it is not flagged). */
export const RAISED_EFFORT = new Set(['xhigh', 'max']);

/** Thresholds per scope: the whole range ('all') or one session ('session'). */
const TH = {
  all: { compactTotal: 3, rebuildN: 3, rebuildSave: 200_000, hiTurns: 10, hiShare: 0.25, hiSessions: 2 },
  session: { compactTotal: 1, rebuildN: 1, rebuildSave: 20_000, hiTurns: 5, hiShare: 0.2, hiSessions: 1 },
};
/** D: rounds at a raised effort, simple ones among them and their share. */
const EFFORT_MIN_ROUNDS = 20;
const EFFORT_MIN_SIMPLE = 10;
const EFFORT_MIN_SHARE = 0.3;
/** E: automated sessions' share of all tokens (and an absolute floor), or a large absolute amount. */
const AUTO_MIN_SHARE = 0.1;
const AUTO_MIN_TOKENS = 1e6;
const AUTO_ALWAYS_TOKENS = 50e6;
/** F: a day counts with at least this many input-side tokens. */
const CACHE_DAY_MIN = 1e6;
const MAX_ITEMS = 6;

const inRange = (d: string, r: Range) => d >= r.from && d <= r.to;
const rangeDays = (range: Range) => Math.max(1, Math.round((new Date(`${range.to}T00:00:00`).getTime() - new Date(`${range.from}T00:00:00`).getTime()) / 86_400_000) + 1);
const startupTok = (s: FileSummary) => estTokens(Object.values(s.startup).reduce((n, c) => n + c, 0));

/** The day buckets of a file within the range. */
function daysOf(s: FileSummary, range: Range): DayBucket[] {
  const out: DayBucket[] = [];
  for (const [d, b] of Object.entries(s.days)) if (inRange(d, range)) out.push(b);
  return out;
}

/**
 * A store holding only one session's files (main transcript and subagents): rules run over it unchanged, so the
 * Session page reuses the tab rules instead of copying them. It has no database and never scans.
 */
export function sessionView(store: Store, sessionId: string): Store {
  const v = new Store(store.projectsDir, null, store.opts);
  const files = store.sessionFiles(sessionId);
  for (const s of files) v.files.set(s.path, s);
  v.bySession.set(sessionId, new Set(files.map((s) => s.path)));
  v.version = store.version;
  return v;
}

/** The local days a session's files cover (null: nothing stored for it). */
export function sessionRange(store: Store, sessionId: string): Range | null {
  const days = store.sessionFiles(sessionId).flatMap((s) => Object.keys(s.days)).sort();
  return days.length ? { from: days[0], to: days[days.length - 1] } : null;
}

export function sessionRecommendations(store: Store, range: Range, lang: Lang, env: RecommendEnv, o: { scope?: 'all' | 'session' } = {}): Insight[] {
  const scope = o.scope ?? 'all';
  const th = TH[scope];
  const one = scope === 'session';
  const TT = insightText(lang);
  const T = TT.rec.sessions;
  const ctx = new Ctx(store);
  const days = rangeDays(range);
  const mains: FileSummary[] = [];
  for (const s of store.files.values()) if (s.agentId === null && Object.keys(s.days).some((d) => inRange(d, range))) mains.push(s);
  if (!mains.length) return [];
  const name = (s: FileSummary) => { const t = sessionTitle(s); return t ? TT.quote(t) : s.sessionId.slice(0, 8); };
  const where = (s: FileSummary) => `${name(s)} (${ctx.project(s)})`;
  const sessionTarget = (s: FileSummary, note: string): InsightTarget => ({ key: s.sessionId, label: sessionTitle(s) ?? s.sessionId.slice(0, 8), kind: 'session', note });
  const out: Insight[] = [];

  // ---------- A. Frequent auto-compactions ----------
  {
    const rows: { s: FileSummary; n: number; pre: number }[] = [];
    for (const s of mains) {
      let n = 0, pre = 0;
      for (const b of daysOf(s, range)) { n += b.autoCompactions; pre += b.compactPre ?? 0; }
      if (n > 0) rows.push({ s, n, pre });
    }
    const total = rows.reduce((n, r) => n + r.n, 0);
    if (rows.length && (total >= th.compactTotal || rows.some((r) => r.n >= 2))) {
      rows.sort((a, b) => b.n - a.n || a.s.sessionId.localeCompare(b.s.sessionId));
      const withPre = rows.filter((r) => r.pre > 0);
      const avgPre = withPre.length ? Math.round(withPre.reduce((n, r) => n + r.pre, 0) / withPre.reduce((n, r) => n + r.n, 0)) : 0;
      const facts = (r: (typeof rows)[number]) => T.compact.facts(r.n, r.pre ? Math.round(r.pre / r.n) : 0);
      out.push({
        id: stableId('auto-compactions', rows.slice(0, MAX_ITEMS).map((r) => r.s.sessionId)),
        severity: total >= 10 ? 'warn' : 'info',
        title: one ? T.compact.titleOne(total) : T.compact.title(total, rows.length),
        detail: T.compact.detail,
        evidence: [
          ...(one ? [] : rows.slice(0, MAX_ITEMS).map((r) => `${where(r.s)}: ${facts(r)}`)),
          ...(avgPre ? [T.compact.avg(avgPre)] : []),
          ...(env.autoCompactPct ? [T.compact.pctEnv(env.autoCompactPct)] : []),
        ],
        pages: ['sessions'],
        scope: 'range',
        targets: one ? undefined : rows.slice(0, MAX_ITEMS).map((r) => sessionTarget(r.s, facts(r))),
        prompts: buildPrompts({
          lang,
          summary: one ? T.compact.summaryOne(total) : T.compact.summary(total, rows.length),
          items: [instructionNoteItem(lang, { name: T.compact.name, file: env.userClaudeMd, section: T.compact.section, text: T.compact.noteText, why: T.compact.why(total, rows.length) })],
          notes: [...PROMPT_NOTES[lang].note(env.userClaudeMd), T.compact.noteRule],
        }),
      });
    }
  }

  // ---------- B. Idle gaps that expired the cache ----------
  {
    const rows: { s: FileSummary; n: number; n60: number; write: number; save: number }[] = [];
    for (const s of mains) {
      let n = 0, n60 = 0, write = 0;
      for (const b of daysOf(s, range)) if (b.rebuilds) { n += b.rebuilds.n; n60 += b.rebuilds.n60; write += b.rebuilds.write; }
      // After /clear (or in a fresh session) the next turn still writes its startup context: that part is not saved.
      if (n) rows.push({ s, n, n60, write, save: Math.max(0, write - n * startupTok(s)) });
    }
    const n = rows.reduce((a, r) => a + r.n, 0);
    const period = Math.round(rows.reduce((a, r) => a + r.save, 0));
    if (n >= th.rebuildN && period >= th.rebuildSave) {
      rows.sort((a, b) => b.save - a.save || a.s.sessionId.localeCompare(b.s.sessionId));
      const n60 = rows.reduce((a, r) => a + r.n60, 0);
      const write = rows.reduce((a, r) => a + r.write, 0);
      const facts = (r: (typeof rows)[number]) => T.idle.facts(r.n, r.n60, r.write);
      out.push({
        id: stableId('idle-rebuilds', rows.slice(0, MAX_ITEMS).map((r) => r.s.sessionId)),
        severity: period >= 20e6 ? 'high' : period >= 2e6 ? 'warn' : 'info',
        title: one ? T.idle.titleOne(n, write) : T.idle.title(n, rows.length, write),
        detail: T.idle.detail,
        evidence: [
          T.idle.total(n, n60, write),
          ...(one ? [] : rows.slice(0, MAX_ITEMS).map((r) => `${where(r.s)}: ${facts(r)}`)),
        ],
        fix: T.idle.fix,
        estSavingTokens: period,
        pages: ['sessions'],
        scope: 'range',
        saving: { period, days, basis: 'range' },
        targets: one ? undefined : rows.slice(0, MAX_ITEMS).map((r) => sessionTarget(r.s, facts(r))),
      });
    }
  }

  // ---------- C. Context near full ----------
  {
    const rows: { s: FileSummary; hi: number; turns: number; share: number; limit: number; compactions: number }[] = [];
    for (const s of mains) {
      const limit = contextLimitFor(s.model, s.requestedModel, s.carry.maxCtx) ?? 200_000;
      let hi = 0, turns = 0, compactions = 0;
      for (const b of daysOf(s, range)) { turns += b.turns; compactions += b.autoCompactions; hi += b.ctxHi ? b.ctxHi[limit > 200_000 ? 1 : 0] : 0; }
      if (turns && hi >= th.hiTurns && hi / turns >= th.hiShare) rows.push({ s, hi, turns, share: hi / turns, limit, compactions });
    }
    if (rows.length >= th.hiSessions) {
      rows.sort((a, b) => b.hi - a.hi || a.s.sessionId.localeCompare(b.s.sessionId));
      const facts = (r: (typeof rows)[number]) => T.full.facts(r.share, r.hi, r.limit, r.compactions);
      out.push({
        id: stableId('context-full', rows.slice(0, MAX_ITEMS).map((r) => r.s.sessionId)),
        severity: rows.length >= 5 ? 'warn' : 'info',
        title: one ? T.full.titleOne(rows[0].share) : T.full.title(rows.length),
        detail: T.full.detail,
        evidence: one ? [facts(rows[0])] : rows.slice(0, MAX_ITEMS).map((r) => `${where(r.s)}: ${facts(r)}`),
        fix: T.full.fix,
        pages: ['sessions'],
        scope: 'range',
        targets: one ? undefined : rows.slice(0, MAX_ITEMS).map((r) => sessionTarget(r.s, facts(r))),
      });
    }
  }

  if (one) return out;

  // ---------- D. Raised effort on simple rounds ----------
  {
    const by = new Map<string, { rounds: number; simple: number; tok: number; sessions: Set<string> }>();
    for (const s of mains) {
      for (const b of daysOf(s, range)) {
        for (const [lvl, e] of Object.entries(b.effort ?? {})) {
          if (!RAISED_EFFORT.has(lvl)) continue;
          const a = by.get(lvl) ?? { rounds: 0, simple: 0, tok: 0, sessions: new Set<string>() };
          a.rounds += e.rounds; a.simple += e.simple; a.tok += e.tok;
          if (e.simple) a.sessions.add(s.sessionId);
          by.set(lvl, a);
        }
      }
    }
    const rounds = [...by.values()].reduce((n, a) => n + a.rounds, 0);
    const simple = [...by.values()].reduce((n, a) => n + a.simple, 0);
    if (rounds >= EFFORT_MIN_ROUNDS && simple >= EFFORT_MIN_SIMPLE && simple / rounds >= EFFORT_MIN_SHARE) {
      const levels = [...by.entries()].sort((a, b) => b[1].simple - a[1].simple || a[0].localeCompare(b[0]));
      out.push({
        id: stableId('effort-simple', levels.map(([l]) => l)),
        severity: 'info',
        title: T.effort.title(simple, rounds, levels.map(([l]) => l).join(' / ')),
        detail: T.effort.detail,
        evidence: levels.map(([l, a]) => T.effort.evidence(l, a.simple, a.rounds, a.tok, a.sessions.size)),
        fix: T.effort.fix,
        pages: ['sessions'],
        scope: 'range',
      });
    }
  }

  // ---------- E. Automated sessions ----------
  {
    let all = 0;
    const tokOf = new Map<string, number>();
    for (const s of store.files.values()) {
      let t = 0;
      for (const b of daysOf(s, range)) t += sumT4(b.t);
      if (!t) continue;
      all += t;
      tokOf.set(s.sessionId, (tokOf.get(s.sessionId) ?? 0) + t);
    }
    const groups = new Map<string, { project: string; via: string; runs: number; tok: number; models: Map<string, number>; last: number }>();
    for (const s of mains) {
      if (sessionKind({ entrypoint: s.entrypoint, promptOrigin: s.promptOrigin }) !== 'automated') continue;
      const via = s.entrypoint && s.entrypoint !== 'cli' ? s.entrypoint : s.promptOrigin || 'sdk';
      const project = ctx.project(s);
      const k = `${project}\u0001${via}`;
      const g = groups.get(k) ?? { project, via, runs: 0, tok: 0, models: new Map<string, number>(), last: 0 };
      const t = tokOf.get(s.sessionId) ?? 0;
      g.runs++; g.tok += t; g.last = Math.max(g.last, s.lastTs);
      if (s.model) g.models.set(s.model, (g.models.get(s.model) ?? 0) + t);
      groups.set(k, g);
    }
    const tok = [...groups.values()].reduce((n, g) => n + g.tok, 0);
    const share = all ? tok / all : 0;
    if (groups.size && ((share >= AUTO_MIN_SHARE && tok >= AUTO_MIN_TOKENS) || tok >= AUTO_ALWAYS_TOKENS)) {
      const list = [...groups.values()].sort((a, b) => b.tok - a.tok || a.project.localeCompare(b.project));
      const runs = list.reduce((n, g) => n + g.runs, 0);
      const topModel = (g: (typeof list)[number]) => [...g.models.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
      const facts = (g: (typeof list)[number]) => T.auto.facts(g.runs, g.tok, all ? g.tok / all : 0, topModel(g), localDate(g.last));
      out.push({
        id: stableId('automated-sessions', list.slice(0, MAX_ITEMS).map((g) => `${g.project}|${g.via}`)),
        severity: share >= 0.3 ? 'warn' : 'info',
        title: T.auto.title(runs, share),
        detail: T.auto.detail,
        evidence: list.slice(0, MAX_ITEMS).map((g) => `${g.project} · ${g.via}: ${facts(g)}`),
        fix: T.auto.fix,
        pages: ['sessions'],
        scope: 'range',
        targets: list.slice(0, MAX_ITEMS).map((g): InsightTarget => ({ key: `${g.project}|${g.via}`, label: `${g.project} · ${g.via}`, kind: 'other', note: facts(g) })),
      });
    }
  }

  // ---------- F. Days with a low cache hit rate, and why ----------
  {
    interface Day { input: number; read: number; write: number; rebuildN: number; rebuildW: number; switchN: number; switchW: number; compactions: number; starts: number; startW: number }
    const byDay = new Map<string, Day>();
    const at = (d: string) => {
      let x = byDay.get(d);
      if (!x) byDay.set(d, (x = { input: 0, read: 0, write: 0, rebuildN: 0, rebuildW: 0, switchN: 0, switchW: 0, compactions: 0, starts: 0, startW: 0 }));
      return x;
    };
    for (const s of store.files.values()) {
      for (const [d, b] of Object.entries(s.days)) {
        if (!inRange(d, range)) continue;
        const x = at(d);
        x.input += b.t[0]; x.read += b.t[2]; x.write += b.t[3];
        if (b.rebuilds) { x.rebuildN += b.rebuilds.n; x.rebuildW += b.rebuilds.write; }
        if (b.switches) { x.switchN += b.switches.n; x.switchW += b.switches.write; }
        x.compactions += b.compactions;
      }
      // Every new session and subagent writes its own startup context to the cache.
      if (s.firstTs && Object.keys(s.startup).length) {
        const d = localDate(s.firstTs);
        if (inRange(d, range)) { const x = at(d); x.starts++; x.startW += startupTok(s); }
      }
    }
    const rates = [...byDay.entries()].map(([date, x]) => ({ date, x, denom: x.input + x.read + x.write })).filter((r) => r.denom > CACHE_DAY_MIN)
      .map((r) => ({ ...r, rate: r.x.read / r.denom }));
    if (rates.length) {
      const avg = rates.reduce((n, r) => n + r.x.read, 0) / rates.reduce((n, r) => n + r.denom, 0);
      const low = rates.filter((r) => r.rate < Math.min(0.85, avg - 0.05)).sort((a, b) => a.rate - b.rate);
      if (low.length) {
        const causes = (x: Day) => [
          x.rebuildN ? T.cache.causeIdle(x.rebuildN, x.rebuildW) : '',
          x.switchN ? T.cache.causeSwitch(x.switchN, x.switchW) : '',
          x.compactions ? T.cache.causeCompact(x.compactions) : '',
          x.starts && x.startW >= x.write * 0.2 ? T.cache.causeStarts(x.starts, x.startW) : '',
        ].filter(Boolean);
        out.push({
          id: stableId('low-cache-days', low.map((r) => r.date)),
          severity: low.some((r) => r.rate < 0.7) ? 'warn' : 'info',
          title: TT.lowCache.title(low.length, avg),
          detail: T.cache.detail,
          evidence: low.slice(0, 8).map((r) => {
            const c = causes(r.x);
            return `${TT.lowCache.evidence(r.date, r.rate, r.x.write, r.x.input)} — ${c.length ? T.cache.likely(c.join(', ')) : T.cache.unknown}`;
          }),
          fix: TT.lowCache.fix,
          pages: ['sessions'],
          // No saving of its own: the measurable part (the cache rebuilt after idle gaps) is the idle-gap card's.
          scope: 'range',
        });
      }
    }
  }

  return out;
}
