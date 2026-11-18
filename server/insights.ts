// Insights: rules with evidence and a concrete fix. Wording lives in insights-text.ts (en/uk).
import path from 'node:path';
import { DEFAULT_SETTINGS, type Insight, type InsightPage, type Range } from '../shared/api';
import { attribution, Ctx, mcpDisplayNames, memoize, overview } from './analytics';
import { readSettings } from './config';
import type { Store } from './store';
import { deriveWaits, WAIT_CAP_MS, type HookLog } from './hook-log';
import type { FileSummary } from './types';
import { estTokens, localDate, mcpKey, mcpSplit } from './util';
import { skillGroupLabel, STARTUP, type Lang } from './i18n';
import { insightText, type InsightText } from './insights-text';
import { defaultEnv, hash8, type RecommendEnv } from './recommend';
import { skillRecommendations } from './recommend-skills';

const sevRank = { high: 0, warn: 1, info: 2 } as const;

function filesStartedIn(store: Store, range: Range): FileSummary[] {
  const out: FileSummary[] = [];
  for (const s of store.files.values()) {
    if (!s.firstTs) continue;
    const d = localDate(s.firstTs);
    if (d >= range.from && d <= range.to) out.push(s);
  }
  return out;
}

function filesActiveIn(store: Store, range: Range): FileSummary[] {
  const out: FileSummary[] = [];
  for (const s of store.files.values()) {
    if (Object.keys(s.days).some((d) => d >= range.from && d <= range.to)) out.push(s);
  }
  return out;
}

function toolFix(tool: string, T: InsightText): string {
  if (T.toolFix[tool]) return T.toolFix[tool];
  const m = mcpSplit(tool);
  if (m && /chrome|browser/i.test(m.server)) return T.toolFixBrowser;
  if (m) return T.toolFixMcp(m.server);
  return T.toolFixGeneric;
}

export interface InsightOptions {
  /** Only the cards for this analytics tab (Insight.pages); omitted = all. */
  page?: InsightPage;
  /** "Consider unused after N days" (Settings.recommendations.unusedDays). */
  unusedDays?: number;
  /** Overrides of the outside facts (tests); disables memoization. */
  env?: Partial<RecommendEnv>;
}

const bySaving = (a: Insight, b: Insight) => (b.estSavingTokens ?? 0) - (a.estSavingTokens ?? 0) || sevRank[a.severity] - sevRank[b.severity];

export function insights(store: Store, range: Range, hookLog?: HookLog | null, lang: Lang = 'en', opts: InsightOptions = {}): Insight[] {
  const env: RecommendEnv = { ...defaultEnv({ unusedDays: opts.unusedDays ?? DEFAULT_SETTINGS.recommendations.unusedDays }), ...opts.env };
  // Recommendations also depend on the enabled plugins, the threshold and the day ("unused for N days").
  const key = `ins:${lang}:${range.from}:${range.to}:${env.unusedDays}:${localDate(env.now)}:${hash8(JSON.stringify(env.enabledPlugins))}`;
  const base = opts.env ? compute(store, range, lang, env) : memoize(store, key, () => compute(store, range, lang, env));
  const extra = hookLog ? waitInsights(store, hookLog, range, lang) : [];
  const all = extra.length ? [...base, ...extra].sort(bySaving) : base;
  return opts.page ? all.filter((i) => i.pages?.includes(opts.page!)) : all;
}

/** Local-day range → [from, to) epoch ms. */
function rangeMs(range: Range): { from: number; to: number } {
  const at = (d: string, plus: number) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd + plus).getTime(); };
  return { from: at(range.from, 0), to: at(range.to, 1) };
}

const waitMemo = new Map<string, { key: string; v: Insight[] }>();

/** "Agents waited for you" — derived from stored hook events; empty when there is no hook data. */
export function waitInsights(store: Store, hookLog: HookLog, range: Range, lang: Lang = 'en'): Insight[] {
  const { from, to } = rangeMs(range);
  if (!hookLog.hasEvents(from, to)) return [];
  const memoKey = `${hookLog.version}:${store.version}`;
  const cacheKey = `${lang}:${range.from}:${range.to}`;
  const hit = waitMemo.get(cacheKey);
  if (hit && hit.key === memoKey) return hit.v;
  const T = insightText(lang);
  // Read one cap past both edges so waits starting near the edges are closed correctly; keep those starting in range.
  const waits = deriveWaits(hookLog.waitEvents(from - WAIT_CAP_MS, to + WAIT_CAP_MS)).filter((w) => w.start >= from && w.start < to && w.end > w.start);
  const v: Insight[] = [];
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
    const allow = tools.map(([t]) => t).filter((t) => t !== UNKNOWN).slice(0, 4);
    const capH = WAIT_CAP_MS / 3_600_000;
    v.push({
      id: 'hook-waits',
      pages: ['sessions', 'overview'],
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
      fix: perm.length
        ? T.waits.fixPerm(allow.map((t) => `"${t === 'Bash' ? 'Bash(pnpm test:*)' : t}"`).join(', '))
        : T.waits.fixInput,
    });
  }
  waitMemo.set(cacheKey, { key: memoKey, v });
  if (waitMemo.size > 50) waitMemo.delete(waitMemo.keys().next().value!);
  return v;
}

function compute(store: Store, range: Range, lang: Lang, env: RecommendEnv): Insight[] {
  const T = insightText(lang);
  // Skills & plugins: unused plugins and skills, hook context, duplicates (they replace the older per-plugin rules).
  const out: Insight[] = skillRecommendations(store, range, lang, env);
  const attr = attribution(store, range, lang);
  const ov = overview(store, range);
  const grand = ov.totals.total || 1;
  const settings = readSettings();
  const ctx = new Ctx(store);
  const started = filesStartedIn(store, range);
  const days = Math.max(1, ov.daily.length);
  const pluginKey = (name: string) => Object.keys(settings.enabledPlugins).find((k) => k.split('@')[0] === name) ?? `${name}@…`;

  // (a2) A heavy skill listing — it goes into every session and every subagent.
  const skillRow = attr.startupContext.find((r) => r.key === STARTUP.skills);
  if (skillRow && skillRow.total > 0) {
    const byPlugin = new Map<string, number>();
    for (const s of started) for (const [p, c] of Object.entries(s.skillsByPlugin)) byPlugin.set(p, (byPlugin.get(p) ?? 0) + c);
    const top = [...byPlugin.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const per = Number(skillRow.extra?.perSession ?? 0);
    const perSub = Number(skillRow.extra?.perSubagent ?? 0);
    out.push({
      id: 'startup-skill-listing',
      pages: ['startup'],
      severity: skillRow.total > 5e6 ? 'high' : 'warn',
      title: T.skillListing.title(per, perSub),
      detail: T.skillListing.detail(perSub > 0, skillRow.total),
      evidence: top.map(([p, c]) => T.skillListing.evidence(skillGroupLabel(p, lang), estTokens(c))),
      fix: T.skillListing.fix,
      estSavingTokens: Math.round(skillRow.total * 0.3),
    });
  }

  // (a3) Overall startup context size per session and per subagent.
  const perMain = attr.startupContext.reduce((n, r) => n + Number(r.extra?.perSession ?? 0), 0);
  const perSub = attr.startupContext.reduce((n, r) => n + Number(r.extra?.perSubagent ?? 0), 0);
  const startupTotal = attr.startupContext.reduce((n, r) => n + r.total, 0);
  if (perMain > 0) {
    const top = [...attr.startupContext].sort((a, b) => Number(b.extra?.perSession ?? 0) - Number(a.extra?.perSession ?? 0)).slice(0, 5);
    out.push({
      id: 'startup-total',
      pages: ['startup', 'overview'],
      severity: 'info',
      title: T.startupTotal.title(perMain, perSub),
      detail: T.startupTotal.detail(startupTotal),
      evidence: top.map((r) => T.startupTotal.evidence(r.label, Number(r.extra?.perSession ?? 0), Number(r.extra?.perSubagent ?? 0))),
      fix: T.startupTotal.fix,
    });
  }

  const filesInRange = filesActiveIn(store, range);

  // (b2) MCP servers that are connected but never called.
  const disp = mcpDisplayNames(store);
  const seen = new Map<string, number>(); // key → number of sessions/subagents
  const blockChars = new Map<string, number>();
  for (const s of filesInRange) {
    for (const k of s.mcpSeen) seen.set(k, (seen.get(k) ?? 0) + 1);
    for (const [n, c] of Object.entries(s.mcpBlocks)) blockChars.set(mcpKey(n), (blockChars.get(mcpKey(n)) ?? 0) + c);
  }
  const usedMcp = new Set<string>();
  for (const r of attr.tools) { const m = mcpSplit(r.key); if (m && r.calls > 0) usedMcp.add(m.server); }
  for (const r of attr.mcpServers) if (r.total > 0 || r.calls > 0) usedMcp.add(mcpKey(r.key));
  const unusedMcp = [...seen.entries()].filter(([k]) => !usedMcp.has(k)).sort((a, b) => (blockChars.get(b[0]) ?? 0) - (blockChars.get(a[0]) ?? 0) || b[1] - a[1]);
  if (unusedMcp.length) {
    const saving = unusedMcp.reduce((n, [k]) => n + estTokens(blockChars.get(k) ?? 0), 0);
    out.push({
      id: 'unused-mcp',
      pages: ['mcp'],
      severity: saving > 1e6 ? 'warn' : 'info',
      title: T.unusedMcp.title(unusedMcp.length, days),
      detail: T.unusedMcp.detail,
      evidence: unusedMcp.slice(0, 12).map(([k, n]) => T.unusedMcp.evidence(disp.get(k) ?? k, n, blockChars.get(k) ? estTokens(blockChars.get(k)!) : 0)),
      fix: T.unusedMcp.fix,
      estSavingTokens: saving,
    });
  }

  // (c) Oversized tool results (> 20K tokens).
  const big = new Map<string, { n: number; sum: number; max: number; ex: string[] }>();
  for (const s of filesInRange) {
    for (const r of s.bigResults) {
      const d = localDate(r.ts);
      if (d < range.from || d > range.to) continue;
      const a = big.get(r.tool) ?? { n: 0, sum: 0, max: 0, ex: [] };
      a.n++; a.sum += r.tokens; a.max = Math.max(a.max, r.tokens);
      if (a.ex.length < 4) a.ex.push(T.bigResults.example(r.label, r.tokens, ctx.project(s)));
      big.set(r.tool, a);
    }
  }
  for (const [tool, a] of [...big.entries()].sort((x, y) => y[1].sum - x[1].sum).slice(0, 5)) {
    out.push({
      id: `big-results-${tool}`,
      pages: ['tools'],
      severity: a.sum > 2e6 ? 'high' : a.sum > 3e5 ? 'warn' : 'info',
      title: T.bigResults.title(tool, a.n, a.max),
      detail: T.bigResults.detail(a.sum),
      evidence: a.ex,
      fix: toolFix(tool, T),
      estSavingTokens: Math.max(0, Math.round(a.sum - a.n * 5000)),
    });
  }

  // (d) The same file read ≥ 3 times within one session.
  const readAvg = Number(attr.tools.find((r) => r.key === 'Read')?.extra?.avgResult ?? 1500);
  const repeated: { sid: string; file: string; n: number }[] = [];
  const bySession = new Map<string, Map<string, number>>();
  for (const s of filesInRange) {
    const m = bySession.get(s.sessionId) ?? new Map<string, number>();
    for (const [f, n] of Object.entries(s.reads)) m.set(f, (m.get(f) ?? 0) + n);
    bySession.set(s.sessionId, m);
  }
  for (const [sid, m] of bySession) for (const [file, n] of m) if (n >= 3) repeated.push({ sid, file, n });
  if (repeated.length) {
    repeated.sort((a, b) => b.n - a.n);
    const extra = repeated.reduce((n, r) => n + (r.n - 1), 0);
    const sessionsN = new Set(repeated.map((r) => r.sid)).size;
    out.push({
      id: 'repeated-reads',
      pages: ['tools'],
      severity: extra * readAvg > 1e6 ? 'warn' : 'info',
      title: T.repeatedReads.title(repeated.length),
      detail: T.repeatedReads.detail(sessionsN, extra, readAvg),
      evidence: repeated.slice(0, 8).map((r) => {
        const main = store.mainOf(r.sid);
        return `${path.basename(r.file)} ×${r.n} — ${main?.title ?? ctx.projectOfSession.get(r.sid) ?? r.sid.slice(0, 8)}`;
      }),
      fix: T.repeatedReads.fix,
      estSavingTokens: Math.round(extra * readAvg),
    });
  }

  // (e) Sessions with auto-compactions.
  const compacted: { s: FileSummary; n: number }[] = [];
  for (const s of filesInRange) {
    if (s.agentId !== null) continue;
    let n = 0;
    for (const [d, b] of Object.entries(s.days)) if (d >= range.from && d <= range.to) n += b.autoCompactions;
    if (n > 0) compacted.push({ s, n });
  }
  if (compacted.length) {
    compacted.sort((a, b) => b.n - a.n);
    const total = compacted.reduce((n, c) => n + c.n, 0);
    out.push({
      id: 'auto-compactions',
      pages: ['sessions'],
      severity: total >= 10 ? 'warn' : 'info',
      title: T.autoCompactions.title(total, compacted.length),
      detail: T.autoCompactions.detail,
      evidence: compacted.slice(0, 8).map((c) => `${c.s.title ?? ctx.project(c.s)} — ${c.n}× (${ctx.project(c.s)})`),
      fix: T.autoCompactions.fix(settings.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE),
    });
  }

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

  // (g) Days with a low cache hit rate.
  const rates = ov.daily.map((d) => {
    const denom = d.tokens.input + d.tokens.cacheRead + d.tokens.cacheWrite;
    return { d, denom, rate: denom ? d.tokens.cacheRead / denom : 1 };
  }).filter((x) => x.denom > 1e6);
  if (rates.length) {
    const sumDen = rates.reduce((n, x) => n + x.denom, 0);
    const avg = rates.reduce((n, x) => n + x.d.tokens.cacheRead, 0) / sumDen;
    const low = rates.filter((x) => x.rate < Math.min(0.85, avg - 0.05)).sort((a, b) => a.rate - b.rate);
    if (low.length) {
      const saving = low.reduce((n, x) => n + Math.max(0, (avg - x.rate) * x.denom), 0);
      out.push({
        id: 'low-cache-days',
      pages: ['overview'],
        severity: low.some((x) => x.rate < 0.7) ? 'warn' : 'info',
        title: T.lowCache.title(low.length, avg),
        detail: T.lowCache.detail,
        evidence: low.slice(0, 8).map((x) => T.lowCache.evidence(x.d.date, x.rate, x.d.tokens.cacheWrite, x.d.tokens.input)),
        fix: T.lowCache.fix,
        estSavingTokens: Math.round(saving),
      });
    }
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
