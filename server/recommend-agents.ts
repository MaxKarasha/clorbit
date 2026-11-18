// Recommendations for the "Subagents" tab (all over the selected range):
//  A. read-only / search-type agent types that run on a top-tier model (Opus, Fable): run them on Sonnet — in the
//     agent's file for user and project agents, through a CLAUDE.md line for built-in ones (the Agent call can pass a
//     model per call), a review for plugin agents (their files belong to the plugin). The saving is a share of their
//     cost from relative API prices (an estimate; subscription limits weigh models too, but by an unpublished formula);
//  B. many short subagents whose tokens are mostly their own startup context: batch small tasks (the Startup context
//     tab handles the context itself);
//  C. deep nesting or a burst of subagents in one session: a review;
//  D. agent types that often fail or get stopped (from the Agent call's result or the background task notification).
import type { Insight, InsightSaving, InsightTarget, Range } from '../shared/api.ts';
import { agentModelItem, buildPrompts, instructionNoteItem, PROMPT_NOTES, reviewItem, type PromptItem } from '../shared/prompts';
import { Ctx } from './analytics';
import type { Lang } from './i18n';
import { insightText } from './insights-text';
import { homeDisplay, stableId, type RecommendEnv } from './recommend';
import { isReadOnlyMcpTool } from './recommend-tools';
import type { Store } from './store';
import type { FileSummary } from './types';
import { estTokens, localDate, mcpSplit, sumT4 } from './util';

/** Input price per million tokens (output, cache reads and writes scale the same way within a model), from the
 *  Anthropic API price list. Only ratios are used. null: unknown model. */
export function modelPrice(model: string): number | null {
  const m = model.toLowerCase();
  if (/fable-5-2|mythos-5-2/.test(m)) return 8;
  if (/fable|mythos/.test(m)) return 10;
  if (/opus-5-5/.test(m)) return 4;
  if (/opus-(5|4-[5-9])/.test(m)) return 5;
  if (/opus/.test(m)) return 15; // Opus 4 / 4.1, Claude 3 Opus
  if (/sonnet-5/.test(m)) return 2;
  if (/sonnet/.test(m)) return 3;
  if (/haiku-5/.test(m)) return 0.1;
  if (/haiku-4/.test(m)) return 1;
  if (/haiku/.test(m)) return 0.8;
  return null;
}
/** What `model: sonnet` runs on the Anthropic API (Claude Sonnet 5.5). */
export const SONNET_PRICE = 2;
const isTopTier = (model: string) => /opus|fable|mythos/i.test(model) && (modelPrice(model) ?? 0) > SONNET_PRICE;

/** A: at least this many runs and this much of the saving (tokens' worth), and this share of tokens on a top-tier model. */
const MODEL_MIN_RUNS = 3;
const MODEL_MIN_SAVING = 300_000;
const MODEL_MIN_TOP_SHARE = 0.5;
/** Tools that tell nothing about reading or writing. */
const NEUTRAL_TOOLS = new Set(['SubagentHandback', 'TodoWrite', 'ToolSearch', 'Skill', 'SendMessage', 'TaskStop', 'TaskOutput', 'Monitor', 'StructuredOutput']);
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'NotebookRead']);
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const NAME_HINT = /explore|search|research|look-?up|fetch|find|docs?\b|scout|reader|review|web|guide|analy|investigat|audit/i;
/** Built-in types whose model is not theirs to change: a fork shares the parent's context, workflow agents follow the workflow. */
const SKIP_TYPES = new Set(['fork', 'workflow-subagent']);
/** B: a short subagent has at most this many turns, its startup context is at least this share of its tokens;
 *  a card needs this many of them, this share of all subagents; batching is assumed to spare half of them. */
const SHORT_TURNS = 6;
const SHORT_SHARE = 0.5;
const STARTUP_MIN = 20;
const STARTUP_MIN_FRACTION = 0.25;
export const BATCH_RATIO = 0.5;
/** C: nesting depth and a burst (subagents started within the window), workflow agents left out. */
const DEEP_DEPTH = 3;
const BURST_N = 30;
const BURST_WINDOW_MS = 10 * 60_000;
const NEST_MAX = 5;
/** D: runs with a known outcome, failed or stopped ones, and their share. */
const FAIL_MIN_KNOWN = 5;
const FAIL_MIN_BAD = 3;
const FAIL_MIN_SHARE = 0.3;

const rangeDays = (range: Range) => Math.max(1, Math.round((new Date(`${range.to}T00:00:00`).getTime() - new Date(`${range.from}T00:00:00`).getTime()) / 86_400_000) + 1);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const shortModel = (m: string) => m.replace(/^claude-/, '').replace(/-(\d+)-(\d+)$/, ' $1.$2').replace(/-(\d+)$/, ' $1').replace(/^\w/, (c) => c.toUpperCase());

export function agentRecommendations(store: Store, range: Range, lang: Lang, env: RecommendEnv): Insight[] {
  const TT = insightText(lang);
  const T = TT.rec.agents;
  const ctx = new Ctx(store);
  const days = rangeDays(range);
  const subs: FileSummary[] = [];
  for (const s of store.files.values()) if (s.agentId !== null && Object.keys(s.days).some((d) => d >= range.from && d <= range.to)) subs.push(s);
  if (!subs.length) return [];
  const typeOf = (s: FileSummary) => s.meta?.agentType ?? 'general-purpose';
  const out: Insight[] = [];

  // ---------- A. Read-only agents on a top-tier model ----------
  {
    interface Agg { runs: number; models: Map<string, number>; tools: Map<string, number>; dirs: Map<string, number>; builtIn: boolean; launch: Map<string, number> }
    const by = new Map<string, Agg>();
    for (const s of subs) {
      const type = typeOf(s);
      if (SKIP_TYPES.has(type)) continue;
      const a = by.get(type) ?? { runs: 0, models: new Map(), tools: new Map(), dirs: new Map(), builtIn: false, launch: new Map() };
      a.runs++;
      if (s.meta?.builtIn) a.builtIn = true;
      if (s.meta?.launchModel) a.launch.set(s.meta.launchModel, (a.launch.get(s.meta.launchModel) ?? 0) + 1);
      if (s.cwd) a.dirs.set(s.cwd, (a.dirs.get(s.cwd) ?? 0) + 1);
      for (const [d, b] of Object.entries(s.days)) {
        if (d < range.from || d > range.to) continue;
        for (const [m, u] of Object.entries(b.models)) a.models.set(m, (a.models.get(m) ?? 0) + sumT4(u.t));
        for (const [t, x] of Object.entries(b.tools)) a.tools.set(t, (a.tools.get(t) ?? 0) + x.calls);
      }
      by.set(type, a);
    }
    const rows: { type: string; a: Agg; total: number; saving: number; share: number; top: string; readShare: number; mix: string; file: string | null }[] = [];
    for (const [type, a] of by) {
      if (a.runs < MODEL_MIN_RUNS) continue;
      let edits = 0, reads = 0, bash = 0, consider = 0;
      for (const [t, n] of a.tools) {
        if (NEUTRAL_TOOLS.has(t)) continue;
        consider += n;
        if (EDIT_TOOLS.has(t)) edits += n;
        else if (READ_TOOLS.has(t) || (mcpSplit(t) && isReadOnlyMcpTool(mcpSplit(t)!.tool))) reads += n;
        else if (t === 'Bash') bash += n;
      }
      const readShare = consider ? reads / consider : 0;
      const bashShare = consider ? bash / consider : 0;
      const readOnly = edits === 0 && consider > 0 && (readShare >= 0.6 || (NAME_HINT.test(type) && readShare + bashShare >= 0.9 && bashShare <= 0.6));
      if (!readOnly) continue;
      let total = 0, top = 0, cost = 0, save = 0, saveCost = 0;
      let topModel = '';
      let topModelTok = 0;
      for (const [m, tok] of a.models) {
        total += tok;
        const p = modelPrice(m);
        if (p !== null) cost += tok * p;
        if (!isTopTier(m) || p === null) continue;
        top += tok;
        save += tok * (1 - SONNET_PRICE / p);
        saveCost += tok * (p - SONNET_PRICE);
        if (tok > topModelTok) { topModelTok = tok; topModel = m; }
      }
      if (!total || top < total * MODEL_MIN_TOP_SHARE || save < MODEL_MIN_SAVING) continue;
      const mix = [...a.tools.entries()].filter(([t]) => !NEUTRAL_TOOLS.has(t)).sort((x, y) => y[1] - x[1]).slice(0, 3)
        .map(([t, n]) => `${mcpSplit(t)?.tool ?? t} ${pct(n / consider)}`).join(', ');
      const custom = !a.builtIn && !type.includes(':');
      rows.push({ type, a, total, saving: Math.round(save), share: cost ? saveCost / cost : 0, top: shortModel(topModel), readShare, mix, file: custom ? env.agentFile(type, [...a.dirs.keys()]) : null });
    }
    if (rows.length) {
      rows.sort((x, y) => y.saving - x.saving || x.type.localeCompare(y.type));
      const period = rows.reduce((n, r) => n + r.saving, 0);
      const allTok = rows.reduce((n, r) => n + r.total, 0);
      // The share of their cost: each type's share, weighted by its tokens.
      const saving: InsightSaving = { period, days, basis: 'range', costShare: rows.reduce((n, r) => n + r.share * r.total, 0) / allTok };
      const facts = (r: (typeof rows)[number]) => T.model.facts(r.top, r.a.runs, Math.round(r.total / r.a.runs), r.mix);
      const launched = (r: (typeof rows)[number]) => [...r.a.launch.entries()].sort((x, y) => y[1] - x[1]).map(([m, n]) => `${m} ×${n}`).join(', ');
      const items: PromptItem[] = rows.map((r) => {
        const why = T.model.why(facts(r), r.share, r.saving);
        if (r.file) return agentModelItem(lang, { name: r.type, file: r.file, model: 'sonnet', why });
        if (r.a.builtIn) {
          return instructionNoteItem(lang, {
            name: r.type, file: env.userClaudeMd, section: T.model.section, text: T.model.noteText(r.type),
            why: `${why}. ${T.model.builtInWhy(r.type, launched(r))}`,
          });
        }
        if (r.type.includes(':')) return reviewItem({ name: r.type, action: T.model.pluginAction(r.type), why: `${why}. ${T.model.pluginWhy(r.type)}` });
        return reviewItem({ name: r.type, action: T.model.findAction(r.type), why: `${why}. ${T.model.findWhy(r.type, [...r.a.dirs.keys()].map(homeDisplay))}` });
      });
      out.push({
        id: stableId('agent-model', rows.map((r) => r.type)),
        severity: period >= 20e6 ? 'high' : period >= 2e6 ? 'warn' : 'info',
        title: rows.length === 1 ? T.model.titleOne(rows[0].type, rows[0].top) : T.model.titleMany(rows.length),
        detail: T.model.detail(Math.round((1 - SONNET_PRICE / 4) * 100)),
        evidence: rows.map((r) => `${r.type}: ${facts(r)}`),
        estSavingTokens: period,
        pages: ['subagents'],
        scope: 'range',
        saving,
        targets: rows.map((r): InsightTarget => ({ key: r.type, label: r.type, kind: 'agent', note: `${facts(r)} · ${T.model.where(r.file, r.a.builtIn, r.type.includes(':'))}` })),
        prompts: buildPrompts({
          lang,
          summary: T.model.summary(rows.length),
          items,
          notes: [...PROMPT_NOTES[lang].agentModel, ...(items.some((i) => i.files?.includes(env.userClaudeMd)) ? PROMPT_NOTES[lang].note(env.userClaudeMd) : [])],
        }),
      });
    }
  }

  // ---------- B. Short subagents dominated by their startup context ----------
  {
    const withStart = subs.filter((s) => Object.keys(s.startup).length && sumT4(s.total) > 0);
    const short: { s: FileSummary; start: number; share: number }[] = [];
    for (const s of withStart) {
      if (s.turns > SHORT_TURNS) continue;
      const start = estTokens(Object.values(s.startup).reduce((n, c) => n + c, 0));
      const total = sumT4(s.total);
      const share = Math.min(1, (start * Math.max(1, s.turns)) / total);
      if (share >= SHORT_SHARE) short.push({ s, start, share });
    }
    if (short.length >= STARTUP_MIN && short.length >= withStart.length * STARTUP_MIN_FRACTION) {
      const startSum = short.reduce((n, x) => n + x.start, 0);
      const per = Math.round(startSum / short.length);
      const byType = new Map<string, { n: number; start: number; share: number }>();
      for (const x of short) {
        const t = typeOf(x.s);
        const a = byType.get(t) ?? { n: 0, start: 0, share: 0 };
        a.n++; a.start += x.start; a.share += x.share;
        byType.set(t, a);
      }
      const types = [...byType.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).slice(0, 4);
      const avgShare = short.reduce((n, x) => n + x.share, 0) / short.length;
      const period = Math.round(startSum * BATCH_RATIO);
      out.push({
        id: stableId('agent-startup', types.map(([t]) => t)),
        severity: period >= 2e6 ? 'warn' : 'info',
        title: T.startup.title(short.length, withStart.length),
        detail: T.startup.detail(SHORT_TURNS, avgShare, Math.round(BATCH_RATIO * 100)),
        evidence: types.map(([t, a]) => T.startup.evidence(t, a.n, Math.round(a.start / a.n), a.share / a.n)),
        estSavingTokens: period,
        pages: ['subagents'],
        scope: 'range',
        saving: { perSubagent: per, period, days, basis: 'range' },
        targets: types.map(([t, a]): InsightTarget => ({ key: t, label: t, kind: 'agent', note: T.startup.note(a.n, Math.round(a.start / a.n)) })),
        prompts: buildPrompts({
          lang,
          summary: T.startup.summary(short.length),
          items: [instructionNoteItem(lang, { name: T.startup.name, file: env.userClaudeMd, section: T.model.section, text: T.startup.noteText, why: T.startup.why(short.length, per) })],
          notes: PROMPT_NOTES[lang].note(env.userClaudeMd),
        }),
        seeAlso: 'startup',
      });
    }
  }

  // ---------- C. Deep nesting, bursts of subagents ----------
  {
    const bySession = new Map<string, FileSummary[]>();
    for (const s of subs) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
    const flagged: { sid: string; depth: number; burst: number; total: number; at: number }[] = [];
    for (const [sid, list] of bySession) {
      const depth = Math.max(...list.map((s) => s.meta?.spawnDepth ?? 1));
      const starts = list.filter((s) => !s.meta?.workflow && typeOf(s) !== 'workflow-subagent' && s.firstTs).map((s) => s.firstTs).sort((a, b) => a - b);
      let burst = 0, at = starts[0] ?? list[0].firstTs;
      for (let i = 0, j = 0; i < starts.length; i++) {
        while (starts[i] - starts[j] > BURST_WINDOW_MS) j++;
        if (i - j + 1 > burst) { burst = i - j + 1; at = starts[j]; }
      }
      if (depth >= DEEP_DEPTH || burst >= BURST_N) flagged.push({ sid, depth, burst, total: list.length, at });
    }
    if (flagged.length) {
      flagged.sort((a, b) => b.burst - a.burst || b.depth - a.depth || a.sid.localeCompare(b.sid));
      const top = flagged.slice(0, NEST_MAX);
      const name = (sid: string) => { const m = store.mainOf(sid); return m?.title ? TT.quote(m.title) : sid.slice(0, 8); };
      const facts = (f: (typeof flagged)[number]) => T.nest.facts(f.total, f.burst, f.depth, ctx.projectOfSession.get(f.sid) ?? '', localDate(f.at));
      out.push({
        id: stableId('agent-nesting', top.map((f) => f.sid)),
        severity: flagged.some((f) => f.burst >= BURST_N * 2 || f.depth > DEEP_DEPTH) ? 'warn' : 'info',
        title: T.nest.title(flagged.length),
        detail: T.nest.detail(BURST_N, Math.round(BURST_WINDOW_MS / 60_000), DEEP_DEPTH),
        evidence: top.map((f) => `${name(f.sid)}: ${facts(f)}`),
        pages: ['subagents'],
        scope: 'range',
        targets: top.map((f): InsightTarget => ({ key: f.sid, label: store.mainOf(f.sid)?.title ?? f.sid.slice(0, 8), kind: 'session', note: facts(f) })),
        prompts: buildPrompts({
          lang,
          summary: T.nest.summary(flagged.length),
          items: top.map((f) => reviewItem({ name: name(f.sid), action: T.nest.action(name(f.sid)), why: T.nest.why(facts(f), f.sid) })),
        }),
      });
    }
  }

  // ---------- D. Agent types that often fail or get stopped ----------
  {
    // Outcomes are recorded in the parent's transcript (main or a subagent): by task id (= agentId) or the Agent call id.
    const sessions = new Set(subs.map((s) => s.sessionId));
    const ends = new Map<string, Map<string, 'ok' | 'error' | 'stopped'>>();
    for (const s of store.files.values()) {
      if (!sessions.has(s.sessionId)) continue;
      const m = ends.get(s.sessionId) ?? new Map<string, 'ok' | 'error' | 'stopped'>();
      for (const [id, sp] of Object.entries(s.spawns)) if (sp.res) m.set(`t:${id}`, sp.res);
      for (const [id, r] of Object.entries(s.taskEnds ?? {})) m.set(`a:${id}`, r);
      ends.set(s.sessionId, m);
    }
    const by = new Map<string, { known: number; error: number; stopped: number }>();
    for (const s of subs) {
      const m = ends.get(s.sessionId);
      const res = m?.get(`a:${s.agentId}`) ?? (s.meta?.toolUseId ? m?.get(`t:${s.meta.toolUseId}`) : undefined);
      if (!res) continue;
      const a = by.get(typeOf(s)) ?? { known: 0, error: 0, stopped: 0 };
      a.known++;
      if (res === 'error') a.error++;
      if (res === 'stopped') a.stopped++;
      by.set(typeOf(s), a);
    }
    const bad = [...by.entries()]
      .filter(([, a]) => a.known >= FAIL_MIN_KNOWN && a.error + a.stopped >= FAIL_MIN_BAD && a.error + a.stopped >= a.known * FAIL_MIN_SHARE)
      .sort((x, y) => (y[1].error + y[1].stopped) - (x[1].error + x[1].stopped) || x[0].localeCompare(y[0]));
    if (bad.length) {
      const facts = (a: { known: number; error: number; stopped: number }) => T.fail.facts(a.known, a.error, a.stopped);
      out.push({
        id: stableId('agent-failing', bad.map(([t]) => t)),
        severity: bad.some(([, a]) => a.error + a.stopped >= a.known * 0.5) ? 'warn' : 'info',
        title: bad.length === 1 ? T.fail.titleOne(bad[0][0], (bad[0][1].error + bad[0][1].stopped) / bad[0][1].known) : T.fail.titleMany(bad.length),
        detail: T.fail.detail,
        evidence: bad.map(([t, a]) => `${t}: ${facts(a)}`),
        pages: ['subagents'],
        scope: 'range',
        targets: bad.map(([t, a]): InsightTarget => ({ key: t, label: t, kind: 'agent', note: facts(a) })),
        prompts: buildPrompts({
          lang,
          summary: T.fail.summary(bad.length),
          items: bad.map(([t, a]) => reviewItem({ name: t, action: T.fail.action(t), why: T.fail.why(facts(a), a.error >= a.stopped) })),
        }),
      });
    }
  }

  return out;
}
