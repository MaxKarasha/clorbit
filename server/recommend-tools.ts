// Recommendations for the "Tools" tab:
//  A. permission prompts you keep approving (hook events): precise allow rules for safe-looking commands and tools,
//     in the user settings or a project's local settings — never broad rules or anything destructive (see
//     `isSafeAllowRule`); the saving is waiting time, not tokens;
//  B. the same file read again and again within one context (a session or a subagent; re-read tokens, measured);
//  C. huge results of Bash and other built-in tools: an "Output hygiene" section in your CLAUDE.md
//     (MCP servers with huge results are cards of recommend-mcp.ts);
//  D. built-in tools that often fail (errors by kind; declined or interrupted calls do not count).
import os from 'node:os';
import path from 'node:path';
import type { Insight, InsightSaving, InsightTarget, Range } from '../shared/api.ts';
import { allowRuleItem, buildPrompts, instructionNoteItem, PROMPT_NOTES, reviewItem, type PromptItem } from '../shared/prompts';
import { Ctx } from './analytics';
import { approvals, type PermEvent } from './hook-log';
import type { Lang } from './i18n';
import { insightText } from './insights-text';
import { homeDisplay, stableId, type RecommendEnv } from './recommend';
import type { Store } from './store';
import type { FileSummary } from './types';
import { localDate, mcpSplit } from './util';
import { sessionTitle } from './titles';

// ---------- A. permission prompts → allow rules ----------

/** A: a rule needs at least this many approved prompts; at most this many rules per card. */
const ALLOW_MIN_PROMPTS = 2;
const ALLOW_MAX_RULES = 12;

/** Read-only commands: one word is the rule (`Bash(ls *)`). No `find` (-delete, -exec), `echo`/`sed`/`awk`/`tee` (write files). */
const READ_ONLY_CMDS = new Set([
  'ls', 'pwd', 'cat', 'head', 'tail', 'wc', 'rg', 'grep', 'tree', 'du', 'df', 'stat', 'file', 'which', 'diff', 'jq', 'cd',
  'basename', 'dirname', 'realpath', 'date', 'whoami', 'uname',
]);
/** Test, lint, type-check and build runners: project-specific, so they go into the project's local settings. */
const RUNNER_CMDS = new Set(['tsc', 'vitest', 'jest', 'eslint', 'pytest', 'mypy']);
const GIT_READ = new Set(['status', 'diff', 'log', 'show', 'rev-parse', 'ls-files', 'blame', 'describe', 'shortlog', 'grep']);
const PKG = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const NPX_SAFE = new Set(['tsc', 'vitest', 'jest', 'eslint']);
/** Package scripts and make targets that only check or build. `deploy`, `release`, `publish`… never match. */
const SAFE_SCRIPT = /^(test|tests|lint|typecheck|type-check|tsc|check|build|verify|ci|format:check|fmt:check)(:[\w-]+)?$/;
const TWO_WORD: Record<string, Set<string>> = {
  go: new Set(['test', 'build', 'vet']),
  cargo: new Set(['test', 'build', 'check', 'clippy']),
  swift: new Set(['build', 'test']),
  dotnet: new Set(['build', 'test']),
  deno: new Set(['test', 'check', 'lint']),
  mvn: new Set(['test']),
  ruff: new Set(['check']),
};

/**
 * Never suggested, whatever the history says. Checked against every Bash rule (and the commands it came from):
 * destructive or irreversible commands, privilege, network downloads, code from elsewhere, git history changes,
 * package changes, shell metacharacters and wildcards that make a rule broad.
 */
export const DENY_PATTERNS: RegExp[] = [
  /(^|[\s(/])(rm|rmdir|unlink|sudo|su|doas|chmod|chown|chgrp|dd|mkfs\S*|shred|truncate|kill|pkill|killall|curl|wget|ssh|scp|sftp|rsync|nc|ncat|telnet|ftp|eval|exec|source|sh|bash|zsh|fish|xargs|env|osascript|launchctl|crontab|mv|cp|ln|tee|open|npx\s+-y|bunx\s+--bun)(\s|:|$)/i,
  /\bgit\s+(push|reset|clean|checkout|switch|restore|rebase|rm|mv|commit|merge|pull|stash|branch|tag|filter-branch|update-ref|gc|reflog|worktree|submodule|apply|am|cherry-pick|revert|config)\b/i,
  /\b(publish|unpublish|deploy|release|install|uninstall|i|add|remove|upgrade|update|link|unlink|prune|delete|destroy|drop|dlx|create|init|login|logout|token|secret)\b/i,
  // Commands whose arguments can delete files or run any code: find (-delete, -exec), sed -i, awk, interpreters.
  /(^|\s)(find|sed|awk|perl|ruby|node|deno|osascript)(\s|:|$)/i,
  /(^|\s)python\d?(\s|:|$)(?!-m (pytest|mypy)\b)/i,
  /--force\b|--hard\b|--delete\b|-delete\b|--exec\b|-exec\b|--no-verify\b/i,
  /[;&|`<>$]/,
];

/** Paths an allow rule must never open up. */
const SENSITIVE_PATH = /(^|\/)(\.ssh|\.aws|\.gnupg|\.kube|\.docker|\.netrc|\.npmrc|\.pypirc|\.env[^/]*|\.config\/gcloud|\.claude\.json|\.credentials[^/]*|keychains?|secrets?|credentials?|tokens?)(\/|$)/i;

/** MCP tools whose names read like lookups; anything that writes, sends or runs is excluded. */
const MCP_WRITE = /delete|remove|drop|destroy|write|create|update|insert|upsert|send|post|push|exec|run|deploy|publish|merge|pay|transfer|purchase|upload|move|rename|edit|modify|patch|set|kill|cancel|approve|submit|commit|apply|install|navigate|click|type|fill|press|close|open|computer|javascript|eval|form|input/i;
const MCP_READ = /^(get|list|read|search|find|fetch|query|describe|view|show|lookup|retrieve|count|inspect|browse|preview|whoami|status)(_|-|[A-Z]|$)|_(get|list|search|read)_/i;
export const isReadOnlyMcpTool = (tool: string) => !MCP_WRITE.test(tool) && MCP_READ.test(tool);

/** Is this allow rule specific and harmless enough to suggest? */
export function isSafeAllowRule(rule: string): boolean {
  if (rule === 'WebSearch') return true;
  const bash = /^Bash\((.+)\)$/.exec(rule);
  if (bash) {
    const inner = bash[1];
    const m = /^([^*:]+?)(?: \*|:\*)?$/.exec(inner);
    if (!m || !/^[\w./:-]+( [\w./:-]+){0,2}$/.test(m[1])) return false;
    return !DENY_PATTERNS.some((re) => re.test(inner));
  }
  const web = /^WebFetch\(domain:([\w.-]+)\)$/.exec(rule);
  if (web) return web[1].includes('.') && !web[1].startsWith('.') || web[1] === 'localhost';
  const read = /^Read\((~\/|\/\/)(.+)\/\*\*\)$/.exec(rule);
  if (read) {
    const p = read[2];
    const depth = p.split('/').filter(Boolean).length;
    if (p.includes('*') || p.includes('..') || SENSITIVE_PATH.test(p)) return false;
    if (read[1] === '~/') return depth >= 2 && !/^\.(claude|config)$/.test(p);
    return /^(tmp|private\/tmp)\/[^/]+/.test(p);
  }
  const mcp = mcpSplit(rule);
  if (mcp && /^mcp__[\w.-]+__[\w.-]+$/.test(rule)) return isReadOnlyMcpTool(mcp.tool);
  return false;
}

/** Shell segments of a command (Claude Code checks each against the rules); null when it uses substitution or redirection. */
export function splitBash(cmd: string): string[] | null {
  if (/\$\(|`|[<>]/.test(cmd)) return null;
  const parts = cmd.split(/\s*(?:&&|\|\||;|\|&|\||\n|&)\s*/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : null;
}

export type RuleKind = 'readonly' | 'runner' | 'web' | 'mcp' | 'path';

/** The allow rule for one shell segment, or null when Clorbit would not suggest one. */
export function bashRule(segment: string): { rule: string; kind: RuleKind } | null {
  let seg = segment.trim();
  while (/^[A-Za-z_]\w*=\S*\s+/.test(seg)) seg = seg.replace(/^[A-Za-z_]\w*=\S*\s+/, '');
  const t = seg.split(/\s+/);
  const [a, b, c] = t;
  if (!a || a.includes('/') || a.includes('…')) return null;
  const mk = (words: string[], kind: RuleKind) => {
    const rule = `Bash(${words.join(' ')} *)`;
    return isSafeAllowRule(rule) ? { rule, kind } : null;
  };
  if (READ_ONLY_CMDS.has(a)) return mk([a], 'readonly');
  if (RUNNER_CMDS.has(a)) return mk([a], 'runner');
  if (a === 'git') return b && GIT_READ.has(b) ? mk([a, b], 'readonly') : null;
  if (PKG.has(a)) {
    if (b === 'run') return c && SAFE_SCRIPT.test(c) ? mk([a, b, c], 'runner') : null;
    return b && SAFE_SCRIPT.test(b) ? mk([a, b], 'runner') : null;
  }
  if (a === 'npx' || a === 'bunx') return b && NPX_SAFE.has(b) ? mk([a, b], 'runner') : null;
  if ((a === 'python' || a === 'python3') && b === '-m') return c === 'pytest' || c === 'mypy' ? mk([a, b, c], 'runner') : null;
  if (a === 'uv' && b === 'run') return c === 'pytest' || c === 'mypy' ? mk([a, b, c], 'runner') : null;
  if (a === 'make') return b && SAFE_SCRIPT.test(b) ? mk([a, b], 'runner') : null;
  if (TWO_WORD[a]) return b && TWO_WORD[a].has(b) ? mk([a, b], 'runner') : null;
  return null;
}

/** `Read(~/code/lib/**)` for a file or folder outside the workspace: its folder, at most three levels below home. */
export function readRule(p: string, home = os.homedir()): string | null {
  if (!p || p.includes('…') || !path.isAbsolute(p)) return null;
  const dir = /\.[\w-]{1,8}$/.test(path.basename(p)) ? path.dirname(p) : p;
  let rule: string;
  if (dir.startsWith(home + path.sep)) {
    const parts = dir.slice(home.length + 1).split(path.sep).slice(0, 3);
    rule = `Read(~/${parts.join('/')}/**)`;
  } else {
    const parts = dir.split(path.sep).filter(Boolean).slice(0, 3);
    rule = `Read(//${parts.join('/')}/**)`;
  }
  return isSafeAllowRule(rule) ? rule : null;
}

/** The rules that would have skipped this prompt (all of them are needed), or why not. */
export function rulesFor(a: { tool: string; command: string | null; url: string | null; path: string | null }, home = os.homedir()):
  { rules: { rule: string; kind: RuleKind }[] } | { skip: string } {
  if (a.tool === 'Bash') {
    if (!a.command) return { skip: 'Bash' };
    const segs = splitBash(a.command);
    if (!segs) return { skip: 'Bash' };
    const rules: { rule: string; kind: RuleKind }[] = [];
    for (const s of segs) {
      const r = bashRule(s);
      if (!r) return { skip: `Bash: ${s.split(/\s+/).slice(0, 2).join(' ').slice(0, 30)}` };
      if (!rules.some((x) => x.rule === r.rule)) rules.push(r);
    }
    return { rules };
  }
  if (a.tool === 'WebFetch') {
    let host: string | null = null;
    try { host = a.url ? new URL(a.url).hostname : null; } catch { host = null; }
    const rule = host ? `WebFetch(domain:${host})` : null;
    return rule && isSafeAllowRule(rule) ? { rules: [{ rule, kind: 'web' }] } : { skip: 'WebFetch' };
  }
  if (a.tool === 'WebSearch') return { rules: [{ rule: 'WebSearch', kind: 'web' }] };
  if (a.tool === 'Read' || a.tool === 'Grep' || a.tool === 'Glob' || a.tool === 'LS') {
    const rule = a.path ? readRule(a.path, home) : null;
    return rule ? { rules: [{ rule, kind: 'path' }] } : { skip: a.tool };
  }
  if (mcpSplit(a.tool)) return isSafeAllowRule(a.tool) ? { rules: [{ rule: a.tool, kind: 'mcp' }] } : { skip: a.tool };
  return { skip: a.tool };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** A: the card from hook events of the range (the caller reads them from the hook log). */
export function permissionRecommendation(
  events: PermEvent[], range: Range, lang: Lang, env: RecommendEnv, win?: { from: number; to: number }, home = os.homedir(),
): Insight | null {
  const T = insightText(lang).rec.tools;
  const all = approvals(events);
  const runs = all.runs;
  // Events are read past both edges so prompts near them are closed correctly; keep prompts that started in range.
  const approved = win ? all.approved.filter((a) => a.ts >= win.from && a.ts < win.to) : all.approved;
  if (!approved.length) return null;
  // How long unprompted calls of the same rule take: subtracted, so the wait is the prompt and not the run.
  const runMs = new Map<string, number[]>();
  for (const r of runs) {
    const x = rulesFor({ tool: r.e.tool ?? '', command: r.e.command, url: r.e.url, path: r.e.path }, home);
    if ('rules' in x && x.rules.length === 1) runMs.set(x.rules[0].rule, [...(runMs.get(x.rules[0].rule) ?? []), r.ms]);
  }
  interface Agg { rule: string; kind: RuleKind; n: number; ms: number; sessions: Set<string>; dirs: Map<string, number> }
  const by = new Map<string, Agg>();
  const skipped = new Map<string, number>();
  const covers: { rules: string[]; wait: number }[] = [];
  for (const a of approved) {
    const x = rulesFor(a, home);
    if ('skip' in x) { skipped.set(x.skip, (skipped.get(x.skip) ?? 0) + 1); continue; }
    const run = x.rules.length === 1 ? median(runMs.get(x.rules[0].rule) ?? []) : 0;
    const wait = Math.max(0, a.rawMs - run);
    covers.push({ rules: x.rules.map((r) => r.rule), wait });
    for (const r of x.rules) {
      const g = by.get(r.rule) ?? { rule: r.rule, kind: r.kind, n: 0, ms: 0, sessions: new Set<string>(), dirs: new Map<string, number>() };
      g.n++; g.ms += wait / x.rules.length; g.sessions.add(a.sessionId);
      if (a.cwd) g.dirs.set(a.cwd, (g.dirs.get(a.cwd) ?? 0) + 1);
      by.set(r.rule, g);
    }
  }
  // Where each rule goes: read-only rules seen in several projects (or with no project known) → the user settings;
  // project-specific ones (test / build runners, or seen in one project) → that project's local settings.
  const placements: { g: Agg; file: string; dir: string | null }[] = [];
  const rules = [...by.values()].filter((g) => g.n >= ALLOW_MIN_PROMPTS).sort((a, b) => b.n - a.n || b.ms - a.ms || a.rule.localeCompare(b.rule))
    .filter((g) => {
      const dirs = [...g.dirs.keys()].sort();
      if (g.kind !== 'runner' && dirs.length !== 1) placements.push({ g, file: env.settingsFile, dir: null });
      else for (const d of dirs) placements.push({ g, file: `${homeDisplay(d)}/.claude/settings.local.json`, dir: d });
      return placements.some((p) => p.g === g);
    })
    .slice(0, ALLOW_MAX_RULES);
  if (!rules.length) return null;
  for (let i = placements.length - 1; i >= 0; i--) if (!rules.includes(placements[i].g)) placements.splice(i, 1);
  // A prompt is skipped only when every rule it needs is suggested (a compound command needs one per segment).
  const chosen = new Set(rules.map((g) => g.rule));
  const done = covers.filter((c) => c.rules.every((r) => chosen.has(r)));
  if (!done.length) return null;
  const covered = done.length;
  const waitMs = Math.round(done.reduce((n, c) => n + c.wait, 0));
  const saving: InsightSaving = { waitMs, days: rangeDays(range), basis: 'range' };
  const scopeOf = (g: Agg) => {
    const ps = placements.filter((p) => p.g === g);
    return ps.some((p) => !p.dir) ? T.allow.user : T.allow.local(ps.map((p) => path.basename(p.dir!)).join(', '));
  };
  const skippedTop = [...skipped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const min = waitMs / 60_000;
  return {
    id: stableId('permission-allow', rules.map((g) => g.rule)),
    severity: min >= 60 || covered >= 100 ? 'warn' : 'info',
    title: T.allow.title(covered, rules.length),
    detail: T.allow.detail,
    evidence: [
      ...rules.slice(0, 6).map((g) => T.allow.evidence(g.rule, g.n, g.ms, g.sessions.size)),
      ...(skippedTop.length ? [T.allow.skipped(skippedTop.reduce((n, [, c]) => n + c, 0), skippedTop.map(([k]) => k).join(', '))] : []),
    ],
    pages: ['tools'],
    scope: 'range',
    saving,
    targets: rules.map((g): InsightTarget => ({ key: g.rule, label: g.rule, kind: 'rule', note: `${T.allow.note(g.n, g.ms)} · ${scopeOf(g)}` })),
    prompts: buildPrompts({
      lang,
      summary: T.allow.summary(covered, rules.length),
      items: placements.map((p) => allowRuleItem(lang, { rule: p.g.rule, file: p.file, why: T.allow.why(p.g.n, p.g.ms, p.g.sessions.size) })),
      notes: PROMPT_NOTES[lang].allow,
    }),
  };
}

// ---------- B, C, D ----------

/** B: a file read at least this many times in one session; a note in the project's CLAUDE.md when that happens in this many sessions. */
const REREAD_MIN = 3;
const REREAD_NOTE_SESSIONS = 3;
const REREAD_MAX_ITEMS = 6;
/** C: "enough" per call for the estimate (as for MCP results). */
const BIG_ENOUGH = 5000;
/** D: at least this many calls and errors, and this error rate. */
const FAIL_MIN_CALLS = 20;
const FAIL_MIN_ERRORS = 5;
const FAIL_MIN_RATE = 0.15;
/** Bash: a non-zero exit or a timeout is the command's own result, not a tool failure. */
const NOT_TOOL_FAILURE = new Set(['exit', 'timeout']);

function filesActiveIn(store: Store, range: Range): FileSummary[] {
  const out: FileSummary[] = [];
  for (const s of store.files.values()) if (Object.keys(s.days).some((d) => d >= range.from && d <= range.to)) out.push(s);
  return out;
}

const rangeDays = (range: Range) => Math.max(1, Math.round((new Date(`${range.to}T00:00:00`).getTime() - new Date(`${range.from}T00:00:00`).getTime()) / 86_400_000) + 1);

/** The Output-hygiene tips that fit a tool (the first one is the main tip). */
function tipsFor(tool: string, T: ReturnType<typeof insightText>['rec']['tools']): string[] {
  if (tool === 'Bash') return [T.big.tipTail, T.big.tipQuiet, T.big.tipTests, T.big.tipDiff];
  if (tool === 'Grep') return [T.big.tipGrep];
  if (tool === 'Read') return [T.big.tipRead];
  if (tool === 'WebFetch') return [T.big.tipFetch];
  if (tool === 'Agent' || tool === 'Task') return [T.big.tipAgent];
  if (tool === 'Glob') return [T.big.tipGlob];
  return [T.big.tipGeneric(tool)];
}

export function toolRecommendations(store: Store, range: Range, lang: Lang, env: RecommendEnv): Insight[] {
  const TT = insightText(lang);
  const T = TT.rec.tools;
  const ctx = new Ctx(store);
  const files = filesActiveIn(store, range);
  const days = rangeDays(range);
  const out: Insight[] = [];

  // ---------- B. Repeated reads ----------
  {
    // Per context (a main session or one subagent): the same file read in several subagents is not a re-read.
    let allRes = 0, allN = 0;
    const readAvg = new Map<FileSummary, number>();
    for (const s of files) {
      let res = 0, n = 0;
      for (const b of Object.values(s.days)) { const r = b.tools.Read; if (r) { res += r.res; n += r.resN; } }
      allRes += res; allN += n;
      if (n) readAvg.set(s, res / n);
    }
    const avgAll = allN ? allRes / allN : 1500;
    const byFile = new Map<string, { n: number; extra: number; tokens: number; sessions: Set<string>; cwds: Map<string, Set<string>>; top: { sid: string; n: number } }>();
    for (const s of files) {
      const avg = readAvg.get(s) ?? avgAll;
      for (const [file, n] of Object.entries(s.reads)) {
        if (n < REREAD_MIN) continue;
        const a = byFile.get(file) ?? { n: 0, extra: 0, tokens: 0, sessions: new Set<string>(), cwds: new Map<string, Set<string>>(), top: { sid: s.sessionId, n: 0 } };
        a.n += n; a.extra += n - 1; a.tokens += (n - 1) * avg; a.sessions.add(s.sessionId);
        const cwd = s.cwd ?? store.mainOf(s.sessionId)?.cwd ?? null;
        if (cwd) a.cwds.set(cwd, (a.cwds.get(cwd) ?? new Set<string>()).add(s.sessionId));
        if (n > a.top.n) a.top = { sid: s.sessionId, n };
        byFile.set(file, a);
      }
    }
    if (byFile.size) {
      const list = [...byFile.entries()].map(([file, a]) => ({ file, ...a })).sort((a, b) => b.tokens - a.tokens || a.file.localeCompare(b.file));
      const tokens = Math.round(list.reduce((n, a) => n + a.tokens, 0));
      const extra = list.reduce((n, a) => n + a.extra, 0);
      const sessions = new Set(list.flatMap((a) => [...a.sessions])).size;
      const where = (sid: string) => { const t = sessionTitle(store.mainOf(sid)); return t ? TT.quote(t) : ctx.projectOfSession.get(sid) ?? sid.slice(0, 8); };
      const items: PromptItem[] = [];
      for (const a of list.slice(0, REREAD_MAX_ITEMS)) {
        const show = homeDisplay(a.file);
        const [cwd, inSessions] = [...a.cwds.entries()].map(([d, set]) => [d, set.size] as const).sort((x, y) => y[1] - x[1])[0] ?? [null, 0];
        if (cwd && inSessions >= REREAD_NOTE_SESSIONS && a.file.startsWith(cwd + path.sep)) {
          const rel = a.file.slice(cwd.length + 1);
          items.push(instructionNoteItem(lang, { name: show, file: `${homeDisplay(cwd)}/CLAUDE.md`, section: T.reread.section, text: T.reread.noteText(rel), why: T.reread.whyNote(a.sessions.size, a.extra) }));
        } else {
          items.push(reviewItem({ name: show, action: T.reread.action(show), why: T.reread.whyReview(a.top.n, where(a.top.sid)) }));
        }
      }
      out.push({
        id: stableId('repeated-reads', list.slice(0, REREAD_MAX_ITEMS).map((a) => a.file)),
        severity: tokens >= 2e6 ? 'warn' : 'info',
        title: T.reread.title(list.length, sessions),
        detail: T.reread.detail(extra, Math.round(tokens / Math.max(1, extra))),
        evidence: list.slice(0, 6).map((a) => T.reread.evidence(path.basename(a.file), a.top.n, where(a.top.sid), a.sessions.size)),
        estSavingTokens: tokens,
        pages: ['tools'],
        scope: 'range',
        saving: { period: tokens, days, basis: 'range' },
        targets: list.slice(0, REREAD_MAX_ITEMS).map((a): InsightTarget => ({ key: a.file, label: homeDisplay(a.file), kind: 'file', note: T.reread.note(a.extra, a.sessions.size) })),
        prompts: buildPrompts({
          lang,
          summary: T.reread.summary(list.length, sessions),
          items,
          notes: items.some((i) => !i.reviewOnly) ? [...PROMPT_NOTES[lang].note('CLAUDE.md'), T.reread.noteRule] : [T.reread.noteRule],
        }),
      });
    }
  }

  // ---------- C. Huge results of built-in tools ----------
  {
    const big = new Map<string, { n: number; sum: number; max: number; ex: string[] }>();
    for (const s of files) {
      for (const r of s.bigResults) {
        if (mcpSplit(r.tool)) continue; // per MCP server: recommend-mcp.ts
        const d = localDate(r.ts);
        if (d < range.from || d > range.to) continue;
        const a = big.get(r.tool) ?? { n: 0, sum: 0, max: 0, ex: [] };
        a.n++; a.sum += r.tokens; a.max = Math.max(a.max, r.tokens);
        if (a.ex.length < 3) a.ex.push(TT.bigResults.example(r.label, r.tokens, ctx.project(s)));
        big.set(r.tool, a);
      }
    }
    if (big.size) {
      const tools = [...big.entries()].sort((x, y) => y[1].sum - x[1].sum);
      const period = Math.round(tools.reduce((n, [, a]) => n + Math.max(0, a.sum - a.n * BIG_ENOUGH), 0));
      const total = tools.reduce((n, [, a]) => n + a.n, 0);
      const max = Math.max(...tools.map(([, a]) => a.max));
      const claudeMd = env.userClaudeMd;
      const tips: { tool: string; text: string }[] = [];
      for (const [tool] of tools) for (const tip of tipsFor(tool, T)) if (!tips.some((x) => x.text === tip)) tips.push({ tool, text: tip });
      out.push({
        id: stableId('big-outputs', tools.map(([t]) => t)),
        severity: period > 2e6 ? 'high' : period > 3e5 ? 'warn' : 'info',
        title: tools.length === 1 ? T.big.titleOne(tools[0][0], total, max) : T.big.titleMany(total, tools.length, max),
        detail: T.big.detail(period + total * BIG_ENOUGH),
        evidence: tools.slice(0, 4).flatMap(([, a]) => a.ex.slice(0, 2)),
        estSavingTokens: period || undefined,
        pages: ['tools'],
        scope: 'range',
        saving: { period, days, basis: 'range' },
        targets: tools.map(([tool, a]): InsightTarget => ({ key: tool, label: tool, kind: 'tool', note: T.big.note(a.n, a.max) })),
        prompts: buildPrompts({
          lang,
          summary: T.big.summary(total, tools.map(([t]) => t).join(', ')),
          items: tips.map((x) => {
            const a = big.get(x.tool)!;
            return instructionNoteItem(lang, { name: x.text, file: claudeMd, section: T.big.section, text: x.text, why: T.big.why(x.tool, a.n, a.max) });
          }),
          notes: PROMPT_NOTES[lang].note(claudeMd),
        }),
      });
    }
  }

  // ---------- D. Built-in tools that often fail ----------
  {
    const agg = new Map<string, { calls: number; err: number; kinds: Record<string, number> }>();
    for (const s of files) {
      for (const [d, b] of Object.entries(s.days)) {
        if (d < range.from || d > range.to) continue;
        for (const [tool, t] of Object.entries(b.tools)) {
          if (mcpSplit(tool) || tool === 'Agent' || tool === 'Task') continue; // MCP: recommend-mcp.ts; subagents: recommend-agents.ts
          const a = agg.get(tool) ?? { calls: 0, err: 0, kinds: {} };
          a.calls += t.calls;
          if (tool === 'Bash') {
            // Without kinds (summaries before v8) a Bash error cannot be told from a failing command: not counted.
            for (const [k, n] of Object.entries(t.errKinds ?? {})) if (!NOT_TOOL_FAILURE.has(k)) { a.err += n; a.kinds[k] = (a.kinds[k] ?? 0) + n; }
          } else {
            a.err += t.err ?? 0;
            for (const [k, n] of Object.entries(t.errKinds ?? {})) a.kinds[k] = (a.kinds[k] ?? 0) + n;
          }
          agg.set(tool, a);
        }
      }
    }
    const failing = [...agg.entries()]
      .filter(([, a]) => a.calls >= FAIL_MIN_CALLS && a.err >= FAIL_MIN_ERRORS && a.err >= a.calls * FAIL_MIN_RATE)
      .sort((x, y) => y[1].err - x[1].err || x[0].localeCompare(y[0]));
    if (failing.length) {
      const reasons = (kinds: Record<string, number>) =>
        Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${T.fail.kind[k] ?? T.fail.kind.other} (${n})`).join(', ');
      const facts = (tool: string, a: { calls: number; err: number; kinds: Record<string, number> }) => T.fail.facts(a.err, a.calls, reasons(a.kinds));
      out.push({
        id: stableId('failing-tools', failing.map(([t]) => t)),
        severity: failing.some(([, a]) => a.err >= a.calls * 0.3) ? 'warn' : 'info',
        title: failing.length === 1 ? T.fail.titleOne(failing[0][0], failing[0][1].err / failing[0][1].calls) : T.fail.titleMany(failing.length),
        detail: T.fail.detail,
        evidence: failing.map(([tool, a]) => `${tool}: ${facts(tool, a)}`),
        pages: ['tools'],
        scope: 'range',
        targets: failing.map(([tool, a]): InsightTarget => ({ key: tool, label: tool, kind: 'tool', note: facts(tool, a) })),
        prompts: buildPrompts({
          lang,
          summary: T.fail.summary(failing.length),
          items: failing.map(([tool, a]) => reviewItem({ name: tool, action: T.fail.action(tool), why: T.fail.why(facts(tool, a), Object.keys(a.kinds).sort((x, y) => a.kinds[y] - a.kinds[x])[0] ?? 'other') })),
        }),
      });
    }
  }

  return out;
}
