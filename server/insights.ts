// Insights: rules with evidence and a concrete fix. Wording lives in insights-text.ts (en/uk).
import { DEFAULT_SETTINGS, type Insight, type InsightPage, type LimitsForecast, type Range } from '../shared/api';
import { bySavings, homePage, pickOverview } from '../shared/insights';
import { attribution, Ctx, memoize, overview } from './analytics';
import { readSettings } from './config';
import type { Store } from './store';
import { deriveWaits, WAIT_CAP_MS, type HookLog } from './hook-log';
import type { FileSummary } from './types';
import { localDate } from './util';
import type { Lang } from './i18n';
import { insightText, type InsightText } from './insights-text';
import { defaultEnv, hash8, type RecommendEnv } from './recommend';
import { agentRecommendations } from './recommend-agents';
import { mcpRecommendations } from './recommend-mcp';
import { skillRecommendations } from './recommend-skills';
import { startupRecommendations } from './recommend-startup';
import { permissionRecommendation, toolRecommendations } from './recommend-tools';
import { limitRecommendations } from './recommend-limits';
import { sessionRange, sessionRecommendations, sessionView } from './recommend-sessions';

const sevRank = { high: 0, warn: 1, info: 2 } as const;

function filesActiveIn(store: Store, range: Range): FileSummary[] {
  const out: FileSummary[] = [];
  for (const s of store.files.values()) {
    if (Object.keys(s.days).some((d) => d >= range.from && d <= range.to)) out.push(s);
  }
  return out;
}

export interface InsightOptions {
  /** Only the cards for this analytics tab (Insight.pages); omitted = all. */
  page?: InsightPage;
  /** "Consider unused after N days" (Settings.recommendations.unusedDays). */
  unusedDays?: number;
  /** Overrides of the outside facts (tests); disables memoization. */
  env?: Partial<RecommendEnv>;
  /** With page 'session': the session whose own cards are wanted (over its whole span; the range is ignored). */
  session?: string;
  /** The current subscription-limits forecast (the limits panel's cards); omitted = no limits cards. */
  limits?: () => LimitsForecast | null;
}

const bySaving = (a: Insight, b: Insight) => (b.estSavingTokens ?? 0) - (a.estSavingTokens ?? 0) || sevRank[a.severity] - sevRank[b.severity];

export function insights(store: Store, range: Range, hookLog?: HookLog | null, lang: Lang = 'en', opts: InsightOptions = {}): Insight[] {
  const env: RecommendEnv = { ...defaultEnv({ unusedDays: opts.unusedDays ?? DEFAULT_SETTINGS.recommendations.unusedDays }), ...opts.env };
  if (opts.page === 'session') return opts.session ? sessionInsights(store, opts.session, lang, env) : [];
  const base = baseInsights(store, range, lang, env, !!opts.env);
  const extra = hookLog ? waitInsights(store, hookLog, range, lang, env) : [];
  // The limits panel's cards follow the current window, not the range; the Overview leaves them out (the panel is there).
  const forecast = opts.limits && (!opts.page || opts.page === 'limits') ? opts.limits() : null;
  const lim = forecast ? limitRecommendations(store, forecast, lang, (from) => {
    const r = { from: localDate(from), to: localDate(env.now) };
    return { cards: baseInsights(store, r, lang, env, !!opts.env), range: r };
  }) : [];
  const all = extra.length || lim.length ? [...base, ...extra, ...lim].sort(bySaving) : base;
  if (opts.page === 'overview') return pickOverview(all);
  return opts.page ? all.filter((i) => i.pages?.includes(opts.page!)) : all;
}

/** The range's cards (memoized per store version, settings that matter and day). */
function baseInsights(store: Store, range: Range, lang: Lang, env: RecommendEnv, noMemo: boolean): Insight[] {
  // Recommendations also depend on the enabled plugins, the threshold and the day ("unused for N days").
  const key = `ins:${lang}:${range.from}:${range.to}:${env.unusedDays}:${localDate(env.now)}:${hash8(JSON.stringify([env.enabledPlugins, env.mcp.user, env.mcp.local, env.autoCompactPct]))}`;
  return noMemo ? compute(store, range, lang, env) : memoize(store, key, () => compute(store, range, lang, env));
}

/**
 * One session's own cards (the Session page): the Sessions rules (compactions, idle-gap rebuilds, a nearly full
 * context), repeated reads and huge outputs (Tools) and read-only subagents on a top-tier model (Subagents), run over
 * a store that holds only this session's files, over the days it covers. Each card links to the tab of its rule.
 */
export function sessionInsights(store: Store, sessionId: string, lang: Lang = 'en', env?: RecommendEnv): Insight[] {
  const range = sessionRange(store, sessionId);
  if (!range) return [];
  const e = env ?? defaultEnv({ unusedDays: DEFAULT_SETTINGS.recommendations.unusedDays });
  const view = sessionView(store, sessionId);
  const cards = [
    ...sessionRecommendations(view, range, lang, e, { scope: 'session' }),
    ...toolRecommendations(view, range, lang, e).filter((i) => /^(repeated-reads|big-outputs):/.test(i.id)),
    ...agentRecommendations(view, range, lang, e).filter((i) => i.id.startsWith('agent-model:')),
  ];
  return cards.map((i): Insight => {
    const home = homePage(i);
    // A distinct id: hiding a card here does not hide the tab's card (and the other way round).
    return { ...i, id: i.id.replace(/^([^:]+)/, '$1@session'), pages: ['session'], ...(home && home !== 'session' ? { seeAlso: home } : {}) };
  }).sort(bySavings);
}

/** Local-day range → [from, to) epoch ms. */
function rangeMs(range: Range): { from: number; to: number } {
  const at = (d: string, plus: number) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd + plus).getTime(); };
  return { from: at(range.from, 0), to: at(range.to, 1) };
}

const waitMemo = new Map<string, { key: string; v: Insight[] }>();

/**
 * From stored hook events (empty without hook data): "agents waited for you" (sessions / overview) and the permission
 * prompts you keep approving (Tools: precise allow rules). The wait card then points to the Tools tab for the rules.
 */
export function waitInsights(store: Store, hookLog: HookLog, range: Range, lang: Lang = 'en', env?: RecommendEnv): Insight[] {
  const { from, to } = rangeMs(range);
  if (!hookLog.hasEvents(from, to)) return [];
  const e = env ?? defaultEnv({ unusedDays: DEFAULT_SETTINGS.recommendations.unusedDays });
  const memoKey = `${hookLog.version}:${store.version}:${e.settingsFile}:${localDate(e.now)}`;
  const cacheKey = `${lang}:${range.from}:${range.to}`;
  const hit = waitMemo.get(cacheKey);
  if (hit && hit.key === memoKey) return hit.v;
  const T = insightText(lang);
  // Read one cap past both edges so waits starting near the edges are closed correctly; keep those starting in range.
  const waits = deriveWaits(hookLog.waitEvents(from - WAIT_CAP_MS, to + WAIT_CAP_MS)).filter((w) => w.start >= from && w.start < to && w.end > w.start);
  const v: Insight[] = [];
  const allow = permissionRecommendation(hookLog.permissionEvents(from - WAIT_CAP_MS, to + WAIT_CAP_MS), range, lang, e, { from, to });
  if (allow) v.push(allow);
  if (waits.length) {
    const ctx = new Ctx(store);
    const total = waits.reduce((n, w) => n + (w.end - w.start), 0);
    const perm = waits.filter((w) => w.kind === 'permission');
    const input = waits.filter((w) => w.kind === 'input');
    const permMs = perm.reduce((n, w) => n + (w.end - w.start), 0);
    const inputMs = total - permMs;
    const longest = waits.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
    const where = (sid: string) => {
      const main = store.mainOf(sid);
      const project = ctx.projectOfSession.get(sid);
      return main?.title ? `${T.quote(main.title)}${project ? ` (${project})` : ''}` : project ?? sid.slice(0, 8);
    };
    const UNKNOWN = '\u0000unknown';
    const byTool = new Map<string, { n: number; ms: number }>();
    for (const w of perm) {
      const k = w.tool ?? UNKNOWN;
      const a = byTool.get(k) ?? { n: 0, ms: 0 };
      a.n++; a.ms += w.end - w.start;
      byTool.set(k, a);
    }
    const tools = [...byTool.entries()].sort((a, b) => b[1].n - a[1].n || b[1].ms - a[1].ms);
    const allowed = tools.map(([t]) => t).filter((t) => t !== UNKNOWN).slice(0, 4);
    const capH = WAIT_CAP_MS / 3_600_000;
    v.push({
      id: 'hook-waits',
      pages: ['sessions'],
      severity: total > 60 * 60_000 ? 'warn' : 'info',
      title: T.waits.title(total, longest.end - longest.start),
      detail: T.waits.detail(
        waits.length,
        perm.length ? { n: perm.length, ms: permMs } : null,
        input.length ? { n: input.length, ms: inputMs } : null,
        where(longest.sessionId), localDate(longest.start), capH,
      ),
      evidence: [
        ...tools.slice(0, 6).map(([t, a]) => T.waits.toolLine(t === UNKNOWN ? T.unknownTool : t, a.n, a.ms)),
        ...(input.length ? [T.waits.inputLine(input.length, inputMs)] : []),
      ],
      // The allow rules are the Tools card's (one card per issue); without one, the generic advice stays here.
      fix: perm.length && !allow
        ? T.waits.fixPerm(allowed.map((t) => `"${t === 'Bash' ? 'Bash(pnpm test *)' : t}"`).join(', '))
        : T.waits.fixInput,
      ...(allow ? { seeAlso: 'tools' as const } : {}),
    });
  }
  waitMemo.set(cacheKey, { key: memoKey, v });
  if (waitMemo.size > 50) waitMemo.delete(waitMemo.keys().next().value!);
  return v;
}

function compute(store: Store, range: Range, lang: Lang, env: RecommendEnv): Insight[] {
  const T = insightText(lang);
  // Skills & plugins: unused plugins and skills, hook context, duplicates (they replace the older per-plugin rules).
  const skills = skillRecommendations(store, range, lang, env);
  const attr = attribution(store, range, lang);
  // MCP: unused servers, failing ones, heavy results, user-scope servers used in few projects (replaces 'unused-mcp').
  const coveredPlugins = new Set(skills.filter((i) => i.id.startsWith('unused-plugins:')).flatMap((i) => (i.targets ?? []).map((t) => t.label)));
  // Startup context: instruction files, memory, settings hooks, the skill listing and the total (replace the older cards).
  const out: Insight[] = [
    ...skills,
    ...mcpRecommendations(store, range, lang, env, { plugins: coveredPlugins }),
    ...startupRecommendations(store, range, lang, env, { attr, skillCards: skills }),
    // Tools: repeated reads, huge built-in tool results, failing tools (permission prompts come from hooks: waitInsights).
    ...toolRecommendations(store, range, lang, env),
    // Subagents: cheaper models for read-only agents, startup overhead, bursts / deep nesting, failing agents.
    ...agentRecommendations(store, range, lang, env),
  ];
  const settings = readSettings();
  // Sessions: auto-compactions, idle gaps that expired the cache, a nearly full context, raised effort on simple
  // rounds, automated sessions and days with a low cache hit rate (replace the older 'auto-compactions' / 'low-cache-days').
  out.push(...sessionRecommendations(store, range, lang, env));
  const ov = overview(store, range);
  const grand = ov.totals.total || 1;
  const pluginKey = (name: string) => Object.keys(settings.enabledPlugins).find((k) => k.split('@')[0] === name) ?? `${name}@…`;

  const filesInRange = filesActiveIn(store, range);

  // (f) Skills: load frequency vs. share of tokens.
  const skillsSorted = attr.skills.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  for (const r of skillsSorted.slice(0, 3)) {
    const share = r.total / grand;
    if (share < 0.03) continue;
    const loads = Number(r.extra?.loads ?? 0);
    out.push({
      id: `skill-share-${r.key}`,
      pages: ['skills'],
      severity: share >= 0.15 ? 'warn' : 'info',
      title: T.skillShare.title(r.key, share, loads),
      detail: T.skillShare.detail(r.key, r.total, r.sessions, loads ? r.total / loads : null),
      evidence: [T.skillShare.turns(r.turns, r.sessions), T.skillShare.tokens(r.tokens.output, r.tokens.cacheWrite)],
      fix: T.skillShare.fix,
    });
  }
  const oftenLoaded = attr.skills.filter((r) => Number(r.extra?.loads ?? 0) >= 10).sort((a, b) => Number(b.extra!.loads) - Number(a.extra!.loads));
  if (oftenLoaded.length) {
    out.push({
      id: 'skills-loads',
      pages: [],
      severity: 'info',
      title: T.skillLoads.title,
      detail: T.skillLoads.detail,
      evidence: oftenLoaded.slice(0, 8).map((r) => T.skillLoads.evidence(r.key, r.extra!.loads, r.total / grand)),
    });
  }

  // (h) Plugin hooks: frequent runs, time spent and errors.
  const hookAgg = new Map<string, { n: number; ms: number; err: number; names: Set<string> }>();
  for (const s of filesInRange) {
    for (const [d, b] of Object.entries(s.days)) {
      if (d < range.from || d > range.to) continue;
      for (const [k, h] of Object.entries(b.hooks)) {
        const [plugin, name] = k.split('|');
        const a = hookAgg.get(plugin) ?? { n: 0, ms: 0, err: 0, names: new Set<string>() };
        a.n += h.n; a.ms += h.ms; a.err += h.err; a.names.add(name.split(':')[0]);
        hookAgg.set(plugin, a);
      }
    }
  }
  for (const [plugin, a] of [...hookAgg.entries()].sort((x, y) => y[1].ms - x[1].ms)) {
    if (a.n < 200 && a.err < 50) continue;
    const errShare = a.err / a.n;
    const min = Math.round(a.ms / 60000);
    out.push({
      id: `hooks-${plugin || 'none'}`,
      pages: ['startup'],
      severity: errShare > 0.5 && a.n > 500 ? 'warn' : 'info',
      title: T.hooks.title(plugin || null, a.n, min, errShare > 0.5 ? errShare : null),
      detail: T.hooks.detail([...a.names].join(', '), min, a.err ? errShare : null),
      evidence: [T.hooks.runs(a.n), T.hooks.time(Math.round(a.ms / 1000)), T.hooks.errors(a.err)],
      fix: plugin ? T.hooks.fix(plugin, pluginKey(plugin)) : T.hooks.fixNoPlugin,
    });
  }

  out.sort(bySaving);
  return out;
}
