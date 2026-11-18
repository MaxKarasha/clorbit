// Recommendation framework: what every rule needs besides its own logic.
// - RecommendEnv: the facts a rule reads from outside the store (settings, paths, "now"), injectable for tests;
// - UsageIndex: when each plugin / skill / MCP server / tool was last used, over the whole stored history
//   (archived summaries included);
// - CostWindow + costOf: what a piece of startup context costs per session, per subagent and over 30 days,
//   from measured sizes and the observed number of sessions and subagents;
// - stable ids and a severity scale.
// Rules live in recommend-<area>.ts and are called from insights.ts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { InsightSaving, Insight } from '../shared/api.ts';
import { CLAUDE_DIR, CLAUDE_JSON_FILES, readSettings, SETTINGS_FILE } from './config';
import { readMcpConfig, type McpConfig } from './mcp-config';
import type { Store } from './store';
import type { FileSummary } from './types';
import { estTokens, localDate, mcpKey, mcpSplit } from './util';

export const DAY_MS = 86_400_000;
/** Projections are "over 30 days", from the last 30 days of history. */
export const PROJECTION_DAYS = 30;

export interface RecommendEnv {
  now: number;
  /** "Consider unused after N days". */
  unusedDays: number;
  /** enabledPlugins of the user settings ('name@marketplace' → on). */
  enabledPlugins: Record<string, boolean>;
  /** Display paths for prompts ('~/.claude/settings.json', '~/.claude/skills'). */
  settingsFile: string;
  skillsDir: string;
  /** Does ~/.claude/skills/<name> exist? (Built-in and project skills also show up in the listing.) */
  ownSkillExists: (name: string) => boolean;
  /** Where MCP servers are configured (names only). */
  mcp: McpConfig;
  /** Display path of Claude Code's ~/.claude.json (user- and local-scope MCP servers live there). */
  claudeJsonFile: string;
  /** Display path of your global CLAUDE.md ('~/.claude/CLAUDE.md'). */
  userClaudeMd: string;
  /** The definition file of a user or project subagent (display path), or null: a project's .claude/agents/<name>.md
   *  (projects in `dirs`, which take precedence) or ~/.claude/agents/<name>.md, also matched by the frontmatter name. */
  agentFile: (name: string, dirs: string[]) => string | null;
  /** CLAUDE_AUTOCOMPACT_PCT_OVERRIDE from the user settings' env, when set (shown with the compaction cards). */
  autoCompactPct?: string;
}

/** `name:` of a subagent file's frontmatter (only the first lines are read). */
function frontmatterName(file: string): string | null {
  try {
    const head = fs.readFileSync(file, 'utf8').slice(0, 2000);
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(head);
    const n = m && /^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(m[1]);
    return n ? n[1].trim() : null;
  } catch {
    return null;
  }
}

/** Finds a subagent definition by file name or frontmatter name in the given agents folders (read-only). */
export function findAgentFile(name: string, folders: string[]): string | null {
  if (!/^[\w.-]+$/.test(name)) return null;
  for (const dir of folders) {
    const direct = path.join(dir, `${name}.md`);
    if (fs.existsSync(direct)) return direct;
    let list: string[] = [];
    try { list = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort(); } catch { continue; }
    for (const f of list) if (frontmatterName(path.join(dir, f)) === name) return path.join(dir, f);
  }
  return null;
}

/** '/Users/me/.claude' → '~/.claude' (prompts are easier to read and do not leak the user name). */
export function homeDisplay(p: string): string {
  const home = os.homedir();
  return p === home ? '~' : p.startsWith(home + path.sep) ? `~/${p.slice(home.length + 1).split(path.sep).join('/')}` : p;
}

export function defaultEnv(o: { now?: number; unusedDays: number }): RecommendEnv {
  const skills = path.join(CLAUDE_DIR, 'skills');
  const settings = readSettings();
  return {
    now: o.now ?? Date.now(),
    unusedDays: o.unusedDays,
    enabledPlugins: settings.enabledPlugins,
    autoCompactPct: settings.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE,
    settingsFile: homeDisplay(SETTINGS_FILE),
    skillsDir: homeDisplay(skills),
    ownSkillExists: (name) => /^[\w.-]+$/.test(name) && fs.existsSync(path.join(skills, name)),
    mcp: readMcpConfig(),
    claudeJsonFile: homeDisplay(CLAUDE_JSON_FILES[0]),
    userClaudeMd: homeDisplay(path.join(CLAUDE_DIR, 'CLAUDE.md')),
    agentFile: (name, dirs) => {
      const f = findAgentFile(name, [...dirs.map((d) => path.join(d, '.claude', 'agents')), path.join(CLAUDE_DIR, 'agents')]);
      return f ? homeDisplay(f) : null;
    },
  };
}

// ---------- ids, severity ----------

/** FNV-1a, 8 hex chars: short stable ids for a set of targets. */
export function hash8(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Stable per rule and target set: a hidden card comes back only when its targets change. */
export function stableId(rule: string, keys: string[]): string {
  return `${rule}:${hash8([...new Set(keys)].sort().join('\n'))}`;
}

/** Severity from the savings: share of the startup context first, then the absolute amount. */
export function severityOf(s: InsightSaving): Insight['severity'] {
  const pct = s.pctStartup ?? 0;
  const period = s.period ?? 0;
  if (pct >= 0.1 || period >= 20e6) return 'high';
  if (pct >= 0.02 || period >= 2e6) return 'warn';
  return 'info';
}

/** Whole days between two moments (floor). */
export const daysBetween = (from: number, to: number) => Math.max(0, Math.floor((to - from) / DAY_MS));

// ---------- usage over the whole history ----------

export interface UsageIndex {
  plugin: Map<string, number>;     // attributionPlugin → last turn
  skill: Map<string, number>;      // skill key ('plugin:skill' | own name) → last attributed turn or Skill call
  mcp: Map<string, number>;        // MCP server (attribution display name) → last use
  tool: Map<string, number>;       // tool name → last call
  pluginSeen: Map<string, number>; // plugin → first session whose startup context had its skills or hook block
  skillSeen: Map<string, number>;  // skill key → first session whose skill listing had it
  mcpSeen: Map<string, number>;    // MCP server key (as in mcp__<key>__) → first file that saw it
}

const bump = (m: Map<string, number>, k: string, ts: number) => { if (ts > (m.get(k) ?? 0)) m.set(k, ts); };
const first = (m: Map<string, number>, k: string, ts: number) => { const v = m.get(k); if (v === undefined || ts < v) m.set(k, ts); };

/** A moment within `date` for day-level counters (skill loads): the file's last activity, capped to that day. */
function dayTs(date: string, s: FileSummary): number {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  return Math.max(start, Math.min(s.lastTs || start, new Date(y, m - 1, d + 1).getTime() - 1));
}

let indexMemo: { store: Store; version: number; v: UsageIndex } | null = null;

/** Last use of everything, over every stored summary (archived ones included). Memoized per store version. */
export function usageIndex(store: Store): UsageIndex {
  if (indexMemo && indexMemo.store === store && indexMemo.version === store.version) return indexMemo.v;
  const v: UsageIndex = { plugin: new Map(), skill: new Map(), mcp: new Map(), tool: new Map(), pluginSeen: new Map(), skillSeen: new Map(), mcpSeen: new Map() };
  for (const s of store.files.values()) {
    for (const [date, b] of Object.entries(s.days)) {
      for (const [k, a] of Object.entries(b.plugins)) bump(v.plugin, k, a.last);
      for (const [k, a] of Object.entries(b.skills)) bump(v.skill, k, a.last);
      for (const [k, n] of Object.entries(b.skillLoads)) if (n > 0) bump(v.skill, k, dayTs(date, s));
      for (const [k, a] of Object.entries(b.mcpServers)) bump(v.mcp, k, a.last);
      for (const [k, a] of Object.entries(b.tools)) if (a.calls > 0) bump(v.tool, k, a.last || dayTs(date, s));
    }
    if (!s.firstTs) continue;
    for (const [p, c] of Object.entries(s.skillsByPlugin)) if (c > 0) first(v.pluginSeen, p, s.firstTs);
    for (const k of Object.keys(s.startup)) if (k.startsWith('hook:plugin:')) first(v.pluginSeen, k.slice('hook:plugin:'.length), s.firstTs);
    for (const [k, c] of Object.entries(s.skillsByName ?? {})) if (c > 0) first(v.skillSeen, k, s.firstTs);
    for (const k of s.mcpSeen) first(v.mcpSeen, k, s.firstTs);
  }
  indexMemo = { store, version: store.version, v };
  return v;
}

/** Is this MCP server (attribution display name or tool-name key) one of the plugin's? */
export function isPluginMcp(server: string, plugin: string): boolean {
  return server.startsWith(`plugin:${plugin}:`) || server.startsWith(`plugin_${plugin}_`) || server.replace(/[^a-zA-Z0-9_-]/g, '_').startsWith(`plugin_${plugin}_`);
}

/** Last use of a plugin: attributed turns, its skills, its MCP servers and their tools. null = never. */
export function pluginLastUse(idx: UsageIndex, plugin: string): number | null {
  let last = idx.plugin.get(plugin) ?? 0;
  for (const [k, ts] of idx.skill) if (k.startsWith(plugin + ':') && ts > last) last = ts;
  for (const [k, ts] of idx.mcp) if (isPluginMcp(k, plugin) && ts > last) last = ts;
  const prefix = `mcp__plugin_${plugin}_`;
  for (const [k, ts] of idx.tool) if (k.startsWith(prefix) && ts > last) last = ts;
  return last || null;
}

/** Last use of an MCP server by its key (attributed turns under its display name, or calls of its tools). null = never. */
export function mcpLastUse(idx: UsageIndex, key: string): number | null {
  let last = 0;
  for (const [k, ts] of idx.mcp) if (mcpKey(k) === key && ts > last) last = ts;
  for (const [k, ts] of idx.tool) if (ts > last && mcpSplit(k)?.server === key) last = ts;
  return last || null;
}

export const skillLastUse = (idx: UsageIndex, key: string): number | null => idx.skill.get(key) ?? null;

/** Unused for at least `days`: by its last use, or — never used — by when it first appeared. Too new → false. */
export function unusedFor(last: number | null, seen: number | null | undefined, env: RecommendEnv): boolean {
  const ref = last ?? seen ?? null;
  return ref !== null && env.now - ref >= env.unusedDays * DAY_MS;
}

// ---------- startup-context cost ----------

/** Files that started in a window and saw their own start (they carry a startup-context breakdown). */
export interface CostWindow {
  mains: FileSummary[];
  subs: FileSummary[];
  /** Days the window actually covers (≥ 1): a younger history is scaled up to PROJECTION_DAYS. */
  spanDays: number;
  /** Average startup context of a main session, tokens. */
  avgStartup: number;
}

const startupTokens = (s: FileSummary) => estTokens(Object.values(s.startup).reduce((n, c) => n + c, 0));

/** The trailing window of history used for projections (default: the last 30 days up to `now`). */
export function costWindow(store: Store, now: number, days = PROJECTION_DAYS): CostWindow {
  const from = now - days * DAY_MS;
  const mains: FileSummary[] = [];
  const subs: FileSummary[] = [];
  let earliest = now;
  for (const s of store.files.values()) {
    if (!s.firstTs || s.firstTs < from || s.firstTs > now || !Object.keys(s.startup).length) continue;
    (s.agentId === null ? mains : subs).push(s);
    if (s.firstTs < earliest) earliest = s.firstTs;
  }
  const spanDays = Math.min(days, Math.max(1, (now - earliest) / DAY_MS));
  const avgStartup = mains.length ? mains.reduce((n, s) => n + startupTokens(s), 0) / mains.length : 0;
  return { mains, subs, spanDays, avgStartup };
}

/** Files of a date range that saw their own start (for range-based rules). */
export function rangeWindow(store: Store, range: { from: string; to: string }): CostWindow {
  const mains: FileSummary[] = [];
  const subs: FileSummary[] = [];
  for (const s of store.files.values()) {
    if (!s.firstTs || !Object.keys(s.startup).length) continue;
    const d = localDate(s.firstTs);
    if (d < range.from || d > range.to) continue;
    (s.agentId === null ? mains : subs).push(s);
  }
  const [y1, m1, d1] = range.from.split('-').map(Number);
  const [y2, m2, d2] = range.to.split('-').map(Number);
  const spanDays = Math.max(1, Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / DAY_MS) + 1);
  const avgStartup = mains.length ? mains.reduce((n, s) => n + startupTokens(s), 0) / mains.length : 0;
  return { mains, subs, spanDays, avgStartup };
}

/**
 * What `chars(file)` of startup context costs: the average per main session and per subagent (over files that had
 * it at all — zero when none did), and in total. basis 'projection': the window's total scaled to PROJECTION_DAYS;
 * basis 'range': the window's actual total over its own span. Tokens are estimated from text length.
 */
export function costOf(w: CostWindow, chars: (s: FileSummary) => number, basis: 'projection' | 'range' = 'projection'): InsightSaving & { total: number } {
  let mainSum = 0, subSum = 0, subWith = 0;
  for (const s of w.mains) mainSum += estTokens(chars(s));
  for (const s of w.subs) { const t = estTokens(chars(s)); subSum += t; if (t > 0) subWith++; }
  const total = mainSum + subSum;
  const perSession = w.mains.length ? Math.round(mainSum / w.mains.length) : 0;
  // Subagent types that never get this context (no skill listing, say) would only dilute the average.
  const perSubagent = subWith ? Math.round(subSum / subWith) : 0;
  const days = basis === 'projection' ? PROJECTION_DAYS : Math.round(w.spanDays);
  const period = basis === 'projection' ? Math.round((total * PROJECTION_DAYS) / w.spanDays) : total;
  const out: InsightSaving & { total: number } = { perSession, period, days, basis, total };
  if (perSubagent) out.perSubagent = perSubagent;
  if (w.avgStartup > 0 && perSession > 0) out.pctStartup = Math.min(1, perSession / w.avgStartup);
  return out;
}

/** Sum of several savings (per-session values add up; the period and basis are the same for all). */
export function addSavings(list: InsightSaving[]): InsightSaving {
  const sum = (f: (s: InsightSaving) => number | undefined) => list.reduce((n, s) => n + (f(s) ?? 0), 0);
  const out: InsightSaving = { perSession: sum((s) => s.perSession), period: sum((s) => s.period), days: list[0]?.days, basis: list[0]?.basis };
  const sub = sum((s) => s.perSubagent);
  if (sub) out.perSubagent = sub;
  const pct = sum((s) => s.pctStartup);
  if (pct) out.pctStartup = Math.min(1, pct);
  return out;
}

/** Drops the internal `total` before a saving goes into an Insight. */
export function publicSaving(s: InsightSaving & { total?: number }): InsightSaving {
  const { total: _t, ...rest } = s;
  return rest;
}
