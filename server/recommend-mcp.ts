// Recommendations for the "MCP" tab:
//  A. connected MCP servers unused for N+ days (whole history) — their instructions and tool list in every session;
//  B. servers that keep failing to connect, need sign-in, or whose calls mostly error (selected range);
//  C. servers whose results are often over 20K tokens (selected range) — a review, not a change;
//  D. user-scope servers used in only some projects — configure them per project instead.
// Every prompt names the command for where the server is configured: user or local scope in ~/.claude.json
// (claude mcp remove / add-json), a project's .mcp.json (disabledMcpjsonServers in the project's local settings),
// a plugin (the plugin decides), a claude.ai connector (disconnected on claude.ai, or disableClaudeAiConnectors).
// One card per issue: a server in A is left out of B and D; plugins already in the "unused plugins" card are left out.
import path from 'node:path';
import type { Insight, InsightTarget, Range } from '../shared/api.ts';
import {
  buildPrompts, disableClaudeAiConnectorsItem, disableMcpJsonServerItem, disablePluginItem, moveMcpToProjectsItem, PROMPT_NOTES,
  removeMcpServerItem, reviewItem, type PromptItem,
} from '../shared/prompts';
import { Ctx } from './analytics';
import type { Lang } from './i18n';
import { insightText } from './insights-text';
import {
  addSavings, costOf, costWindow, DAY_MS, daysBetween, homeDisplay, mcpLastUse, pluginLastUse, PROJECTION_DAYS, publicSaving, severityOf,
  stableId, unusedFor, usageIndex, type RecommendEnv,
} from './recommend';
import type { Store } from './store';
import type { FileSummary } from './types';
import { localDate, mcpKey, mcpSplit } from './util';

/** B: at least this many sessions with a failure, and this share of the sessions that had the server. */
const FAIL_MIN_SESSIONS = 3;
const FAIL_MIN_SHARE = 0.25;
/** B: tool errors — at least this many calls, and this share of them. */
const ERR_MIN_CALLS = 10;
const ERR_MIN_SHARE = 0.3;
/** C: at most this many server cards; "enough" per call for the estimate. */
const HEAVY_MAX = 3;
const HEAVY_ENOUGH = 5000;
/** D: per-session cost worth a card, share of it that must be avoidable, at most this many cards and projects. */
const PROJECTS_MIN_TOKENS = 150;
const PROJECTS_MIN_AVOIDABLE = 0.3;
const PROJECTS_MAX_CARDS = 3;
const MAX_PROJECTS = 6;

export type McpSource =
  | { kind: 'plugin'; plugin: string }
  | { kind: 'claudeai' }
  | { kind: 'user'; name: string }
  | { kind: 'local'; name: string; dirs: string[] }
  | { kind: 'project'; name: string; dirs: string[] }
  | { kind: 'unknown' };

interface Parts { instr: number; defs: number; names: number }

const partsMemo = new WeakMap<FileSummary, Map<string, Parts>>();
/** Startup chars of every MCP server of a file, by key: instructions, tool definitions, deferred tool names. */
function mcpParts(s: FileSummary): Map<string, Parts> {
  let m = partsMemo.get(s);
  if (m) return m;
  m = new Map();
  const at = (k: string) => { let p = m!.get(k); if (!p) m!.set(k, (p = { instr: 0, defs: 0, names: 0 })); return p; };
  for (const [n, c] of Object.entries(s.mcpBlocks)) at(mcpKey(n)).instr += c;
  for (const [k, c] of Object.entries(s.mcpToolDefs ?? {})) at(k).defs += c;
  for (const [k, c] of Object.entries(s.mcpToolNames ?? {})) at(k).names += c;
  partsMemo.set(s, m);
  return m;
}
const charsOf = (s: FileSummary, key: string) => { const p = mcpParts(s).get(key); return p ? p.instr + p.defs + p.names : 0; };

/** Folders from `dir` up to the filesystem root (a session may run in a subfolder of the project). */
function upwards(dir: string): string[] {
  const out: string[] = [];
  for (let d = dir, i = 0; i < 12; i++) {
    out.push(d);
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return out;
}

/** Where a server is configured, from its key, display name and the config names (see mcp-config.ts). */
export function mcpSource(key: string, display: string | undefined, env: RecommendEnv, cwds: string[]): McpSource {
  if (display?.startsWith('plugin:')) return { kind: 'plugin', plugin: display.split(':')[1] };
  if (key.startsWith('plugin_')) {
    const names = Object.keys(env.enabledPlugins).map((k) => k.split('@')[0]).sort((a, b) => b.length - a.length);
    const p = names.find((n) => key.startsWith(`plugin_${mcpKey(n)}_`));
    return { kind: 'plugin', plugin: p ?? key.slice('plugin_'.length).split('_')[0] };
  }
  if (display?.startsWith('claude.ai ') || key.startsWith('claude_ai_')) return { kind: 'claudeai' };
  const match = (list: string[]) => list.find((n) => mcpKey(n) === key);
  const user = match(env.mcp.user);
  if (user) return { kind: 'user', name: user };
  const local: string[] = [];
  let localName: string | undefined;
  for (const [dir, list] of Object.entries(env.mcp.local)) {
    const n = match(list);
    if (n) { local.push(dir); localName = n; }
  }
  if (localName) return { kind: 'local', name: localName, dirs: local.sort() };
  const project = new Set<string>();
  let projectName: string | undefined;
  for (const cwd of cwds) {
    for (const d of upwards(cwd)) {
      const n = match(env.mcp.projectFile(d));
      if (n) { project.add(d); projectName = n; break; }
    }
  }
  if (projectName) return { kind: 'project', name: projectName, dirs: [...project].sort() };
  return { kind: 'unknown' };
}

/** "claude_ai_Google_Drive" → "claude.ai Google Drive" when no display name was recorded. */
const labelOf = (key: string, display?: string) => display ?? (key.startsWith('claude_ai_') ? `claude.ai ${key.slice(10).replace(/_/g, ' ')}` : key);

export function mcpRecommendations(store: Store, range: Range, lang: Lang, env: RecommendEnv, covered: { plugins: Set<string> }): Insight[] {
  const TT = insightText(lang);
  const T = TT.rec;
  const idx = usageIndex(store);
  const w = costWindow(store, env.now);
  const ctx = new Ctx(store);
  const out: Insight[] = [];
  const days = env.unusedDays;
  const lastText = (last: number | null, seen: number | null | undefined) =>
    last ? T.lastUsed(daysBetween(last, env.now)) : T.never(seen ? localDate(seen) : null);
  const keyOfPlugin = (p: string) => Object.keys(env.enabledPlugins).find((k) => k.split('@')[0] === p && env.enabledPlugins[k]) ?? null;

  // Display names (key → 'plugin:x:y' / 'claude.ai Gmail' / 'pencil'), from instructions, attribution and failures.
  const disp = new Map<string, string>();
  for (const s of store.files.values()) {
    for (const k of Object.keys(s.mcpBlocks)) disp.set(mcpKey(k), k);
    for (const k of Object.keys(s.mcpIssues ?? {})) disp.set(mcpKey(k), k);
    for (const b of Object.values(s.days)) for (const k of Object.keys(b.mcpServers)) disp.set(mcpKey(k), k);
  }

  // Servers seen in the last 30 days, and the folders of the sessions that had them.
  const from = env.now - PROJECTION_DAYS * DAY_MS;
  const recent = [...store.files.values()].filter((s) => s.firstTs >= from && s.firstTs <= env.now);
  const cwdsOf = new Map<string, Set<string>>();
  for (const s of recent) {
    const cwd = s.cwd ?? store.mainOf(s.sessionId)?.cwd ?? null;
    for (const k of s.mcpSeen) {
      const set = cwdsOf.get(k) ?? new Set<string>();
      if (cwd) set.add(cwd);
      cwdsOf.set(k, set);
    }
  }
  const sources = new Map<string, McpSource>();
  const sourceOf = (key: string) => {
    let v = sources.get(key);
    if (!v) sources.set(key, (v = mcpSource(key, disp.get(key), env, [...(cwdsOf.get(key) ?? [])].sort())));
    return v;
  };
  const sourceLabel = (src: McpSource) => {
    switch (src.kind) {
      case 'user': return T.mcpSource.user(env.claudeJsonFile);
      case 'local': return T.mcpSource.local(src.dirs.map(homeDisplay));
      case 'project': return T.mcpSource.project(src.dirs.map(homeDisplay));
      case 'plugin': return T.mcpSource.plugin(src.plugin);
      case 'claudeai': return T.mcpSource.claudeai;
      default: return T.mcpSource.unknown;
    }
  };

  // Failures per server in the selected range (B), computed first so A can mention them.
  const fails = new Map<string, { failed: number; auth: number; seen: Set<string>; err: string | null; errLast: number }>();
  const inRange = (ts: number) => { const d = localDate(ts); return d >= range.from && d <= range.to; };
  for (const s of store.files.values()) {
    if (!s.firstTs || !inRange(s.firstTs)) continue;
    for (const k of s.mcpSeen) {
      const f = fails.get(k) ?? { failed: 0, auth: 0, seen: new Set<string>(), err: null, errLast: 0 };
      f.seen.add(s.sessionId);
      fails.set(k, f);
    }
    for (const [name, it] of Object.entries(s.mcpIssues ?? {})) {
      const k = mcpKey(name);
      const f = fails.get(k) ?? { failed: 0, auth: 0, seen: new Set<string>(), err: null, errLast: 0 };
      f.seen.add(s.sessionId);
      if (it.failed) f.failed++;
      if (it.auth) f.auth++;
      if (it.error && it.last >= f.errLast) { f.err = it.error; f.errLast = it.last; }
      fails.set(k, f);
    }
  }
  const toolErr = new Map<string, { calls: number; err: number }>();
  for (const { b } of ctx.days(range)) {
    for (const [name, t] of Object.entries(b.tools)) {
      const m = mcpSplit(name);
      if (!m) continue;
      const a = toolErr.get(m.server) ?? { calls: 0, err: 0 };
      a.calls += t.calls; a.err += t.err ?? 0;
      toolErr.set(m.server, a);
    }
  }

  // ---------- A. Unused for N+ days ----------
  const inA = new Set<string>();
  {
    const rows: { key: string; label: string; src: McpSource; last: number | null; lt: string; saving: ReturnType<typeof costOf>; parts: Parts }[] = [];
    for (const key of [...cwdsOf.keys()].sort()) {
      const last = mcpLastUse(idx, key);
      const seen = idx.mcpSeen.get(key) ?? null;
      if (!unusedFor(last, seen, env)) continue;
      const src = sourceOf(key);
      if (src.kind === 'plugin' && covered.plugins.has(src.plugin)) continue; // in the "unused plugins" card already
      const saving = costOf(w, (s) => charsOf(s, key));
      const part = (f: (p: Parts) => number) => costOf(w, (s) => { const p = mcpParts(s).get(key); return p ? f(p) : 0; }).perSession ?? 0;
      rows.push({ key, label: labelOf(key, disp.get(key)), src, last, lt: lastText(last, seen), saving, parts: { instr: part((p) => p.instr), defs: part((p) => p.defs), names: part((p) => p.names) } });
    }
    if (rows.length) {
      rows.sort((a, b) => (b.saving.period ?? 0) - (a.saving.period ?? 0) || a.label.localeCompare(b.label));
      const items: PromptItem[] = [];
      let removes = false;
      let plugins = false;
      const connectors = rows.filter((r) => r.src.kind === 'claudeai');
      // Every claude.ai connector Claude Code loads is unused → one switch for all of them; otherwise one by one.
      const allConnectorsIdle = connectors.length > 0 && [...cwdsOf.keys()].filter((k) => sourceOf(k).kind === 'claudeai').every((k) => connectors.some((r) => r.key === k));
      for (const r of rows) {
        const per = r.saving.perSession ?? 0;
        const why = T.unusedMcp.why(r.lt, per);
        const src = r.src;
        if (src.kind === 'user') { removes = true; items.push(removeMcpServerItem(lang, { name: src.name, scope: 'user', claudeJson: env.claudeJsonFile, why })); }
        else if (src.kind === 'local') { removes = true; for (const d of src.dirs) items.push(removeMcpServerItem(lang, { name: src.name, scope: 'local', dir: homeDisplay(d), claudeJson: env.claudeJsonFile, why })); }
        else if (src.kind === 'project') for (const d of src.dirs) items.push(disableMcpJsonServerItem(lang, { name: src.name, dir: homeDisplay(d), why }));
        else if (src.kind === 'plugin') {
          // The whole plugin unused too (and enabled): disable it; otherwise the server cannot go alone — ask.
          const pk = keyOfPlugin(src.plugin);
          const pLast = pluginLastUse(idx, src.plugin);
          if (pk && unusedFor(pLast, idx.pluginSeen.get(src.plugin) ?? idx.mcpSeen.get(r.key), env)) {
            plugins = true;
            items.push(disablePluginItem(lang, { key: pk, why: T.unusedMcp.pluginUnusedWhy(r.label, lastText(pLast, idx.pluginSeen.get(src.plugin) ?? idx.mcpSeen.get(r.key))), settingsFile: env.settingsFile }));
          } else items.push(reviewItem({ name: r.label, action: T.unusedMcp.pluginAction(r.label, src.plugin), why: T.unusedMcp.pluginWhy(r.lt, pk ?? `${src.plugin}@…`) }));
        }
        else if (src.kind === 'claudeai') { if (!allConnectorsIdle) items.push(reviewItem({ name: r.label, action: T.unusedMcp.connectorAction(r.label.replace(/^claude\.ai /, '')), why: T.unusedMcp.connectorWhy(r.lt) })); }
        else items.push(reviewItem({ name: r.label, action: T.unusedMcp.unknownAction(r.label), why: T.unusedMcp.unknownWhy(r.lt) }));
      }
      if (allConnectorsIdle) items.push(disableClaudeAiConnectorsItem(lang, { settingsFile: env.settingsFile, why: T.unusedMcp.connectorsAllWhy(connectors.length, days) }));
      for (const r of rows) inA.add(r.key);
      const saving = publicSaving(addSavings(rows.map((r) => r.saving)));
      const one = rows.length === 1 ? rows[0] : null;
      const notes = removes ? [PROMPT_NOTES[lang].mcpRemove(env.claudeJsonFile), PROMPT_NOTES[lang].jq] : [];
      out.push({
        id: stableId('unused-mcp', rows.map((r) => r.key)),
        severity: saving.period ? severityOf(saving) : 'info',
        title: one ? T.unusedMcp.titleOne(one.label, one.lt) : T.unusedMcp.titleMany(rows.length, days),
        detail: T.unusedMcp.detail(days),
        evidence: rows.map((r) => T.unusedMcp.evidence(r.label, sourceLabel(r.src), r.lt, r.saving.perSession ?? 0, T.mcpParts(r.parts) || T.unusedMcp.noSize)),
        estSavingTokens: saving.period || undefined,
        pages: ['mcp', 'startup'],
        scope: 'history',
        saving: saving.perSession || saving.perSubagent ? saving : undefined,
        targets: rows.map((r): InsightTarget => {
          const f = fails.get(r.key);
          const failedN = f ? f.failed + f.auth : 0;
          return {
            key: r.key, label: r.label, kind: 'mcp', lastUsed: r.last, tokensPerSession: r.saving.perSession,
            note: [sourceLabel(r.src), failedN ? T.unusedMcp.alsoFailed(failedN) : ''].filter(Boolean).join(' · '),
          };
        }),
        prompts: buildPrompts({ lang, summary: T.unusedMcp.summary(rows.length, days), items, verify: ['claude mcp list', ...(plugins ? ['claude plugin list'] : [])], notes }),
      });
    }
  }

  // ---------- B. Failing to connect / erroring ----------
  {
    const rows: { key: string; label: string; facts: string; auth: boolean; share: number }[] = [];
    for (const key of new Set([...fails.keys(), ...toolErr.keys()])) {
      if (inA.has(key)) continue;
      const f = fails.get(key);
      const e = toolErr.get(key);
      const bad = f ? f.failed + f.auth : 0;
      const total = f?.seen.size ?? 0;
      const failing = !!f && bad >= FAIL_MIN_SESSIONS && bad >= total * FAIL_MIN_SHARE;
      const erroring = !!e && e.calls >= ERR_MIN_CALLS && e.err >= e.calls * ERR_MIN_SHARE;
      if (!failing && !erroring) continue;
      const facts = [
        failing && f!.failed ? T.mcpFailing.failed(f!.failed, total, f!.err) : '',
        failing && f!.auth ? T.mcpFailing.auth(f!.auth) : '',
        erroring ? T.mcpFailing.errors(e!.err, e!.calls) : '',
      ].filter(Boolean).join('; ');
      const share = Math.max(failing ? bad / Math.max(1, total) : 0, erroring ? e!.err / e!.calls : 0);
      rows.push({ key, label: labelOf(key, disp.get(key)), facts, auth: failing && f!.auth >= f!.failed, share });
    }
    if (rows.length) {
      rows.sort((a, b) => b.share - a.share || a.label.localeCompare(b.label));
      const name = (r: (typeof rows)[number]) => { const s = sourceOf(r.key); return 'name' in s ? s.name : r.label; };
      const items = rows.map((r) => (r.auth
        ? reviewItem({ name: r.label, action: T.mcpFailing.authAction(r.label), why: T.mcpFailing.authWhy(r.facts, sourceOf(r.key).kind === 'claudeai', name(r)) })
        : reviewItem({ name: r.label, action: T.mcpFailing.fixAction(r.label), why: T.mcpFailing.fixWhy(r.facts, name(r)) })));
      out.push({
        id: stableId('mcp-failing', rows.map((r) => r.key)),
        severity: rows.some((r) => r.share >= 0.5) ? 'warn' : 'info',
        title: rows.length === 1 ? T.mcpFailing.titleOne(rows[0].label) : T.mcpFailing.titleMany(rows.length),
        detail: T.mcpFailing.detail,
        evidence: rows.map((r) => T.mcpFailing.evidence(r.label, r.facts)),
        pages: ['mcp'],
        scope: 'range',
        targets: rows.map((r) => ({ key: r.key, label: r.label, kind: 'mcp' as const, note: r.facts })),
        prompts: buildPrompts({ lang, summary: T.mcpFailing.summary(rows.length), items, verify: ['claude mcp list'] }),
      });
    }
  }

  // ---------- C. Heavy results ----------
  {
    const heavy = new Map<string, { n: number; sum: number; max: number; tools: Map<string, number>; ex: string[] }>();
    for (const s of store.files.values()) {
      for (const r of s.bigResults) {
        const m = mcpSplit(r.tool);
        if (!m || !inRange(r.ts)) continue;
        const a = heavy.get(m.server) ?? { n: 0, sum: 0, max: 0, tools: new Map<string, number>(), ex: [] as string[] };
        a.n++; a.sum += r.tokens; a.max = Math.max(a.max, r.tokens);
        a.tools.set(m.tool, (a.tools.get(m.tool) ?? 0) + 1);
        if (a.ex.length < 4) a.ex.push(TT.bigResults.example(r.label, r.tokens, ctx.project(s)));
        heavy.set(m.server, a);
      }
    }
    const rangeDays = Math.max(1, Math.round((new Date(`${range.to}T00:00:00`).getTime() - new Date(`${range.from}T00:00:00`).getTime()) / DAY_MS) + 1);
    for (const [key, a] of [...heavy.entries()].sort((x, y) => y[1].sum - x[1].sum).slice(0, HEAVY_MAX)) {
      const label = labelOf(key, disp.get(key));
      const tools = [...a.tools.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
      const tip = /chrome|browser|playwright|puppeteer/i.test(key) ? T.mcpHeavy.tipBrowser
        : /github/i.test(key) ? T.mcpHeavy.tipGithub
          : /figma/i.test(key) ? T.mcpHeavy.tipFigma : T.mcpHeavy.tipGeneric(label);
      const period = Math.max(0, Math.round(a.sum - a.n * HEAVY_ENOUGH));
      out.push({
        id: `big-results-mcp:${key}`,
        severity: a.sum > 2e6 ? 'high' : a.sum > 3e5 ? 'warn' : 'info',
        title: T.mcpHeavy.title(label, a.n, a.max),
        detail: `${T.mcpHeavy.detail(a.sum)} ${tip}`,
        evidence: a.ex,
        estSavingTokens: period || undefined,
        pages: ['mcp', 'tools'],
        scope: 'range',
        saving: period ? { period, days: rangeDays, basis: 'range' } : undefined,
        targets: tools.map(([t, n]) => ({ key: `mcp__${key}__${t}`, label: t, kind: 'mcp' as const, note: `${n}× > 20K` })),
        prompts: buildPrompts({
          lang,
          summary: T.mcpHeavy.summary(label, a.n),
          items: [reviewItem({ name: label, action: T.mcpHeavy.action(label, tools.slice(0, 3).map(([t]) => t).join(', ')), why: T.mcpHeavy.why(a.n, a.max, tip) })],
        }),
      });
    }
  }

  // ---------- D. User-scope servers used in only some projects ----------
  {
    const cards: Insight[] = [];
    for (const key of [...cwdsOf.keys()].sort()) {
      if (inA.has(key)) continue;
      const src = sourceOf(key);
      if (src.kind !== 'user') continue;
      // Projects where it was ever used (whole history) and a folder of each; projects that loaded it lately.
      const used = new Map<string, { cwd: string | null; last: number }>();
      for (const s of store.files.values()) {
        let last = 0;
        for (const b of Object.values(s.days)) {
          for (const [k, a] of Object.entries(b.mcpServers)) if (mcpKey(k) === key && a.last > last) last = a.last;
          for (const [k, t] of Object.entries(b.tools)) if (t.calls > 0 && mcpSplit(k)?.server === key) last = Math.max(last, t.last || s.lastTs);
        }
        if (!last) continue;
        const p = ctx.project(s);
        const cwd = store.mainOf(s.sessionId)?.cwd ?? s.cwd;
        const u = used.get(p) ?? { cwd: null, last: 0 };
        if (!u.cwd && cwd) u.cwd = cwd;
        u.last = Math.max(u.last, last);
        used.set(p, u);
      }
      const loaded = new Map<string, number>();
      for (const s of w.mains) if (s.mcpSeen.includes(key) || charsOf(s, key) > 0) loaded.set(ctx.project(s), (loaded.get(ctx.project(s)) ?? 0) + 1);
      const idle = [...loaded.keys()].filter((p) => !used.has(p));
      const usedLoaded = [...loaded.keys()].filter((p) => used.has(p));
      if (!usedLoaded.length || !idle.length) continue;
      const total = costOf(w, (s) => charsOf(s, key));
      if ((total.perSession ?? 0) < PROJECTS_MIN_TOKENS) continue;
      const avoid = costOf(w, (s) => (used.has(ctx.project(s)) ? 0 : charsOf(s, key)));
      if (!total.total || avoid.total < total.total * PROJECTS_MIN_AVOIDABLE) continue;
      const label = labelOf(key, disp.get(key));
      const usedProjects = [...used.keys()].sort();
      const usedText = usedProjects.map((p) => `${p} (${lastText(used.get(p)!.last, null)})`).join(', ');
      const dirs = usedProjects.map((p) => used.get(p)!.cwd).filter((d): d is string => !!d).slice(0, MAX_PROJECTS).map(homeDisplay);
      const saving = publicSaving({ ...avoid, perSession: total.perSession, perSubagent: total.perSubagent, pctStartup: total.pctStartup });
      const idleSessions = w.mains.filter((s) => !used.has(ctx.project(s)) && loaded.has(ctx.project(s))).length;
      cards.push({
        id: stableId(`mcp-projects:${key}`, usedProjects),
        severity: severityOf(saving),
        title: T.mcpProjects.title(label, usedLoaded.length, loaded.size),
        detail: T.mcpProjects.detail(label, usedProjects),
        evidence: [T.mcpProjects.perSession(total.perSession ?? 0), T.mcpProjects.usedIn(usedText), T.mcpProjects.idle(idle.length, idleSessions)],
        estSavingTokens: saving.period,
        pages: ['mcp', 'startup'],
        scope: 'history',
        saving,
        targets: [{ key, label, kind: 'mcp', lastUsed: mcpLastUse(idx, key), tokensPerSession: total.perSession, note: sourceLabel(src) }],
        prompts: dirs.length
          ? buildPrompts({
            lang,
            summary: T.mcpProjects.summary(label),
            items: [moveMcpToProjectsItem(lang, { name: src.name, dirs, claudeJson: env.claudeJsonFile, why: T.mcpProjects.why(total.perSession ?? 0, usedProjects.join(', ')) })],
            verify: ['claude mcp list'],
            notes: [PROMPT_NOTES[lang].mcpRemove(env.claudeJsonFile), PROMPT_NOTES[lang].jq],
          })
          : undefined,
      });
    }
    out.push(...cards.sort((a, b) => (b.estSavingTokens ?? 0) - (a.estSavingTokens ?? 0)).slice(0, PROJECTS_MAX_CARDS));
  }

  return out;
}
