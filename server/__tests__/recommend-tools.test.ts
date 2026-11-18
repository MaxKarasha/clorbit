// Recommendations for the Tools and Subagents tabs: what the scanner records (error kinds, subagent outcomes, meta),
// the permission-allow safety rules (denylist), every rule, the prompts (exact rules and paths, backups, no rm, uk).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Insight, InsightPage } from '../../shared/api.ts';
import { ClorbitDb } from '../db';
import { approvals, HookLog, type PermEvent } from '../hook-log';
import { insights } from '../insights';
import { DAY_MS, findAgentFile, type RecommendEnv } from '../recommend';
import { BATCH_RATIO, modelPrice, SONNET_PRICE } from '../recommend-agents';
import { bashRule, isReadOnlyMcpTool, isSafeAllowRule, permissionRecommendation, readRule, rulesFor, splitBash } from '../recommend-tools';
import { errorKind, readMeta, scanText, taskNotification } from '../scanner';
import { Store } from '../store';
import type { FileSummary } from '../types';
import { estTokens, localDate } from '../util';

const NOW = new Date(2026, 10, 18, 12).getTime();
const ago = (d: number, h = 10, m = 0) => new Date(NOW - d * DAY_MS).setHours(h, m, 0, 0);
const opts = { knownPlugins: [] };
const HOME = os.homedir();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-rec-tools-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

let seq = 0;
const at = (ts: number) => new Date(ts).toISOString();
const att = (ts: number, attachment: Record<string, unknown>) => JSON.stringify({ type: 'attachment', attachment, timestamp: at(ts) });

interface Call { tool: string; input?: Record<string, unknown>; error?: string; big?: boolean; result?: string; id?: string }
interface Spec {
  sid: string; agent?: string; ts: number; cwd: string; model?: string;
  calls?: Call[]; startup?: number; turns?: number; usage?: number; notes?: string[];
}

/** One transcript: an optional startup block, `turns` assistant turns (the calls go into the first), user lines. */
function file(o: Spec): FileSummary {
  const lines: string[] = [];
  if (o.startup) lines.push(att(o.ts, { type: 'skill_listing', content: 's'.repeat(o.startup) }));
  const blocks: unknown[] = [{ type: 'text', text: 'ok' }];
  const results: unknown[] = [];
  for (const c of o.calls ?? []) {
    const id = c.id ?? `t${seq++}`;
    blocks.push({ type: 'tool_use', id, name: c.tool, input: c.input ?? {} });
    results.push({ type: 'tool_result', tool_use_id: id, is_error: !!c.error, content: c.big ? 'x'.repeat(90_000) : c.error ?? c.result ?? 'fine' });
  }
  const turns = o.turns ?? 1;
  const u = o.usage ?? 1000;
  for (let i = 0; i < turns; i++) {
    lines.push(JSON.stringify({
      type: 'assistant', requestId: `r${seq++}`, timestamp: at(o.ts + i * 1000), sessionId: o.sid, cwd: o.cwd,
      message: { model: o.model ?? 'claude-opus-5-5', id: `m${seq++}`, content: i === 0 ? blocks : [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: u, output_tokens: 0 } },
    }));
    if (i === 0 && results.length) lines.push(JSON.stringify({ type: 'user', timestamp: at(o.ts + 500), sessionId: o.sid, cwd: o.cwd, message: { role: 'user', content: results } }));
  }
  for (const n of o.notes ?? []) lines.push(JSON.stringify({ type: 'user', timestamp: at(o.ts + 5000), sessionId: o.sid, cwd: o.cwd, message: { role: 'user', content: n } }));
  const p = o.agent ? `/p/-work/${o.sid}/subagents/agent-${o.agent}.jsonl` : `/p/-work/${o.sid}.jsonl`;
  return scanText(p, { sessionId: o.sid, agentId: o.agent ?? null, projectDir: '-work' }, lines.join('\n'), opts);
}

const sid = (n: number) => `22222222-0000-0000-0000-${String(n).padStart(12, '0')}`;
const meta = (agentType: string, extra: Record<string, unknown> = {}) => ({
  agentType, description: null, spawnDepth: 1, toolUseId: null, finished: true, workflow: null, worktreePath: null, builtIn: false, launchModel: null, ...extra,
});

const store = new Store(path.join(tmp, 'none'), null, opts);
const put = (s: FileSummary) => (store as any).put(s);

// ---------- the synthetic history ----------
const A = '/work/proj-a';
const B = '/work/proj-b';
const REF = `${A}/src/api.ts`;
for (let d = 1; d <= 8; d++) {
  const cwd = d % 2 ? A : B;
  const calls: Call[] = [];
  // proj-a re-reads its reference file in every session; once, in proj-b, a file is re-read 5 times.
  if (cwd === A) calls.push(...Array.from({ length: 4 }, () => ({ tool: 'Read', input: { file_path: REF } })));
  if (d === 2) calls.push(...Array.from({ length: 5 }, () => ({ tool: 'Read', input: { file_path: `${B}/README.md` } })));
  // Huge Bash and Grep results; a huge MCP result stays with the MCP rules.
  if (d <= 3) calls.push({ tool: 'Bash', input: { command: 'pnpm build' }, big: true }, { tool: 'Grep', input: { pattern: 'x' }, big: true }, { tool: 'mcp__srv__q', big: true });
  // Edit fails often (text not found); Bash fails with an exit code (normal) and is refused by Claude Code twice a day.
  calls.push(...Array.from({ length: 4 }, (_, i) => ({ tool: 'Edit', input: { file_path: `${cwd}/x.ts` }, error: i < 2 ? 'String to replace not found in file.' : undefined })));
  calls.push(...Array.from({ length: 6 }, (_, i) => ({ tool: 'Bash', input: { command: 'pnpm test' }, error: i < 4 ? 'FAIL src/a.test.ts\n1 failed' : undefined })));
  calls.push({ tool: 'Bash', error: '<tool_use_error>This command was blocked: cd outside the project</tool_use_error>' });
  calls.push({ tool: 'Write', input: {}, error: "The user doesn't want to proceed with this tool use." });
  // Spawns: a foreground Explore that errors (d ≤ 3), and a background general-purpose launched → notification.
  const fg = `fg${d}`, bg = `bg${d}`;
  calls.push({ tool: 'Agent', id: fg, input: { subagent_type: 'Explore' }, error: d <= 3 ? 'Agent failed: API error' : undefined, result: 'report' });
  calls.push({ tool: 'Agent', id: bg, input: { subagent_type: 'general-purpose', run_in_background: true }, result: 'Async agent launched successfully. agentId: x' });
  const status = d <= 5 ? 'killed' : 'completed';
  put(file({
    sid: sid(d), ts: ago(d), cwd, calls,
    notes: [`<task-notification>\n<task-id>gp${d}</task-id>\n<tool-use-id>${bg}</tool-use-id>\n<status>${status}</status>\n<summary>done</summary>\n</task-notification>`],
  }));
  // Explore subagents: read-only, on Opus 5.5, short (startup dominates).
  for (let k = 0; k < 4; k++) {
    const s = file({ sid: sid(d), agent: `ex${d}-${k}`, ts: ago(d, 11, k), cwd, startup: 36_000, turns: 3, usage: 8_000, calls: [{ tool: 'Read', input: { file_path: `${cwd}/a.ts` } }, { tool: 'Grep' }, { tool: 'Glob' }] });
    s.meta = meta('Explore', { builtIn: true, toolUseId: k === 0 ? fg : null, launchModel: 'opus' });
    put(s);
  }
  // A background general-purpose agent that edits (never a model card), stopped in 5 of 8 sessions.
  const gp = file({ sid: sid(d), agent: `gp${d}`, ts: ago(d, 12), cwd, turns: 12, usage: 50_000, calls: [{ tool: 'Edit', input: { file_path: `${cwd}/y.ts` } }, { tool: 'Read' }] });
  gp.meta = meta('general-purpose', { builtIn: true, toolUseId: bg });
  put(gp);
  // An own read-only reviewer (its file exists) and a plugin researcher, both on Opus; a Sonnet scout stays out.
  const rv = file({ sid: sid(d), agent: `rv${d}`, ts: ago(d, 13), cwd, turns: 10, usage: 60_000, calls: [{ tool: 'Read' }, { tool: 'Grep' }, { tool: 'Bash' }] });
  rv.meta = meta('code-reviewer');
  put(rv);
  const pr = file({ sid: sid(d), agent: `pr${d}`, ts: ago(d, 14), cwd, turns: 10, usage: 60_000, calls: [{ tool: 'WebFetch' }, { tool: 'WebSearch' }] });
  pr.meta = meta('acme:researcher');
  put(pr);
  const sc = file({ sid: sid(d), agent: `sc${d}`, ts: ago(d, 15), cwd, turns: 10, usage: 60_000, model: 'claude-sonnet-5-5', calls: [{ tool: 'Read' }, { tool: 'Grep' }] });
  sc.meta = meta('scout');
  put(sc);
}
// A session with a burst of 31 subagents within 10 minutes, one of them 3 levels deep.
for (let k = 0; k < 31; k++) {
  const s = file({ sid: sid(99), agent: `burst${k}`, ts: ago(2, 16, Math.floor(k / 4)), cwd: A, turns: 9, usage: 1000, calls: [{ tool: 'Edit' }] });
  s.meta = meta('general-purpose', { builtIn: true, spawnDepth: k === 0 ? 3 : 1 });
  put(s);
}
put(file({ sid: sid(99), ts: ago(2, 16), cwd: A }));

const env = (over: Partial<RecommendEnv> = {}): Partial<RecommendEnv> => ({
  now: NOW,
  unusedDays: 30,
  enabledPlugins: {},
  settingsFile: '~/.claude/settings.json',
  skillsDir: '~/.claude/skills',
  ownSkillExists: () => false,
  claudeJsonFile: '~/.claude.json',
  mcp: { user: [], local: {}, projectFile: () => [] },
  userClaudeMd: '~/.claude/CLAUDE.md',
  agentFile: (name) => (name === 'code-reviewer' ? '~/.claude/agents/code-reviewer.md' : null),
  ...over,
});
const range = { from: localDate(ago(29)), to: localDate(NOW) };
const run = (page?: InsightPage, lang: 'en' | 'uk' = 'en', over: Partial<RecommendEnv> = {}) => insights(store, range, null, lang, { env: env(over), page });
const byRule = (list: Insight[], rule: string) => list.find((i) => i.id.startsWith(rule));
const prompts = (c: Insight) => [c.prompts!.all, c.prompts!.ask];

// ---------- scanner ----------

describe('scanner: error kinds, subagent outcomes, meta', () => {
  const main = [...store.files.values()].find((f) => f.sessionId === sid(1) && !f.agentId)!;
  const day = Object.values(main.days)[0];
  it('error kinds: Edit "not found"; Bash output is an exit, a refusal is "denied"; a decline is no error', () => {
    expect(day.tools.Edit).toMatchObject({ calls: 4, err: 2, errKinds: { notFound: 2 } });
    expect(day.tools.Bash.errKinds).toEqual({ exit: 4, denied: 1 });
    expect(day.tools.Write.err).toBeUndefined();
    expect(errorKind('Read', 'File does not exist.')).toBe('noFile');
    expect(errorKind('Edit', 'File has not been read yet. Read it first before writing to it.')).toBe('notRead');
    expect(errorKind('Bash', 'Command timed out after 2m')).toBe('timeout');
    expect(errorKind('Bash', 'anything at all')).toBe('exit');
    expect(errorKind('WebFetch', 'Request failed with status code 404')).toBe('network');
  });
  it('outcomes: a foreground Agent result, a background launch waits for its notification', () => {
    expect(main.spawns.fg1.res).toBe('error');
    expect(main.spawns.bg1.res).toBe('stopped');
    expect(main.taskEnds).toEqual({ gp1: 'stopped' });
    const later = [...store.files.values()].find((f) => f.sessionId === sid(7) && !f.agentId)!;
    expect(later.spawns.fg7.res).toBe('ok');
    expect(later.spawns.bg7.res).toBe('ok');
    expect(taskNotification('<task-notification><task-id>b1</task-id><status>running</status></task-notification>')).toBeNull();
    expect(taskNotification('<task-notification><task-id>a1</task-id><status>failed</status></task-notification>')).toEqual({ taskId: 'a1', toolUseId: null, res: 'error' });
  });
  it('reads isBuiltIn and the launch model from the meta file', () => {
    const dir = path.join(tmp, 'meta');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'agent-x.meta.json'), JSON.stringify({ agentType: 'Explore', isBuiltIn: true, model: 'haiku', spawnDepth: 2 }));
    expect(readMeta(path.join(dir, 'agent-x.jsonl'))).toMatchObject({ agentType: 'Explore', builtIn: true, launchModel: 'haiku', spawnDepth: 2 });
  });
});

// ---------- permission rules ----------

describe('allow rules: only precise, safe-looking ones (the denylist always wins)', () => {
  it('never suggests broad or destructive rules', () => {
    for (const r of [
      'Bash(*)', 'Bash', 'Bash(:*)', 'Bash( *)', 'Bash(rm *)', 'Bash(rm -rf build *)', 'Bash(sudo ls *)', 'Bash(git push *)', 'Bash(git reset *)',
      'Bash(git checkout *)', 'Bash(git branch *)', 'Bash(git commit *)', 'Bash(curl *)', 'Bash(wget *)', 'Bash(curl x | sh)', 'Bash(chmod *)',
      'Bash(mv *)', 'Bash(pnpm install *)', 'Bash(pnpm add *)', 'Bash(npm publish *)', 'Bash(pnpm run deploy *)', 'Bash(npx -y foo *)',
      'Bash(find *)', 'Bash(xargs *)', 'Bash(bash *)', 'Bash(eval *)', 'Bash(kill *)', 'Bash(cat x > y)', 'Bash(ls; rm x)', 'Bash(ls $(rm x))',
      'Edit', 'Write', 'Read', 'WebFetch', 'WebFetch(domain:*)', 'Read(~/**)', 'Read(~/.ssh/**)', 'Read(~/.aws/creds/**)', 'Read(//etc/**)',
      'Read(~/.claude/**)', 'mcp__github__delete_repo', 'mcp__github__create_issue', 'mcp__srv__run_query', 'mcp__claude-in-chrome__computer', 'mcp__srv',
    ]) expect(isSafeAllowRule(r), r).toBe(false);
  });
  it('accepts precise read-only, check and lookup rules', () => {
    for (const r of [
      'Bash(git status *)', 'Bash(git diff *)', 'Bash(ls *)', 'Bash(rg *)', 'Bash(pnpm test *)', 'Bash(pnpm run typecheck *)', 'Bash(npx tsc *)',
      'Bash(python -m pytest *)', 'Bash(cargo test *)', 'Bash(git status:*)', 'WebSearch', 'WebFetch(domain:developer.mozilla.org)',
      'Read(~/code/lib/**)', 'Read(//tmp/build/**)', 'mcp__github__get_pull_request', 'mcp__linear__list_issues', 'mcp__docs__search_docs',
    ]) expect(isSafeAllowRule(r), r).toBe(true);
  });
  it('derives a rule per shell segment, or none', () => {
    expect(bashRule('git status --short')).toEqual({ rule: 'Bash(git status *)', kind: 'readonly' });
    expect(bashRule('pnpm test -- --run')).toEqual({ rule: 'Bash(pnpm test *)', kind: 'runner' });
    expect(bashRule('pnpm run typecheck')).toEqual({ rule: 'Bash(pnpm run typecheck *)', kind: 'runner' });
    expect(bashRule('CI=1 npx vitest run')).toEqual({ rule: 'Bash(npx vitest *)', kind: 'runner' });
    for (const c of ['rm -rf dist', 'git push origin main', 'pnpm run deploy', 'pnpm install', 'sudo ls', './scripts/x.sh', 'find . -delete', 'node x.js', 'git -C x status'])
      expect(bashRule(c), c).toBeNull();
    expect(splitBash('cd app && pnpm test | tail -n 5')).toEqual(['cd app', 'pnpm test', 'tail -n 5']);
    expect(splitBash('echo x > f')).toBeNull();
    expect(splitBash('ls $(pwd)')).toBeNull();
    expect(rulesFor({ tool: 'Bash', command: 'git status && git push', url: null, path: null })).toEqual({ skip: 'Bash: git push' });
    expect(rulesFor({ tool: 'Bash', command: 'git status && git diff', url: null, path: null })).toEqual({ rules: [{ rule: 'Bash(git status *)', kind: 'readonly' }, { rule: 'Bash(git diff *)', kind: 'readonly' }] });
    expect(rulesFor({ tool: 'WebFetch', command: null, url: 'https://docs.example.com/a?b', path: null })).toEqual({ rules: [{ rule: 'WebFetch(domain:docs.example.com)', kind: 'web' }] });
    expect(rulesFor({ tool: 'Edit', command: null, url: null, path: '/x' })).toEqual({ skip: 'Edit' });
    expect(readRule(path.join(HOME, 'code', 'lib', 'src', 'deep', 'a.ts'))).toBe('Read(~/code/lib/src/**)');
    expect(readRule(path.join(HOME, '.ssh', 'id_rsa'))).toBeNull();
    expect(readRule(path.join(HOME, 'notes.txt'))).toBeNull();
    expect(readRule('/etc/hosts')).toBeNull();
    expect(isReadOnlyMcpTool('get_page_text')).toBe(true);
    expect(isReadOnlyMcpTool('send_message')).toBe(false);
  });
});

describe('permission prompts → allow rules (hook events)', () => {
  const T0 = ago(3, 9);
  const ev = (ts: number, event: string, o: Partial<PermEvent> = {}): PermEvent => ({ ts, sessionId: 'S', event, tool: null, toolUseId: null, command: null, url: null, path: null, cwd: A, ...o });
  it('approved prompts: the tool ran after it; a prompt closed by the next user prompt was declined', () => {
    const { approved, runs } = approvals([
      ev(T0, 'PreToolUse', { tool: 'Bash', toolUseId: 'u0', command: 'git status' }),
      ev(T0 + 1000, 'PostToolUse', { tool: 'Bash', toolUseId: 'u0', command: 'git status' }),
      ev(T0 + 2000, 'PreToolUse', { tool: 'Bash', toolUseId: 'u1', command: 'git status' }),
      ev(T0 + 2100, 'PermissionRequest', { tool: 'Bash', toolUseId: 'u1', command: 'git status' }),
      ev(T0 + 62_100, 'PostToolUse', { tool: 'Bash', toolUseId: 'u1', command: 'git status' }),
      ev(T0 + 70_000, 'PermissionRequest', { tool: 'Bash', command: 'git push' }),
      ev(T0 + 90_000, 'UserPromptSubmit'),
    ]);
    expect(approved).toEqual([expect.objectContaining({ tool: 'Bash', command: 'git status', rawMs: 60_000, cwd: A })]);
    expect(runs.map((r) => r.ms)).toEqual([1000]);
  });

  // Hook events through the real log: git status in two projects, pnpm test in one, git push (never suggested), WebFetch.
  const db = ClorbitDb.open(path.join(tmp, 'hooks', 'clorbit.db'));
  const log = new HookLog(db);
  let t = T0;
  const prompt = (cwd: string, tool: string, input: Record<string, unknown>, waitMs: number, session = 'S1', approve = true) => {
    const id = `tu${seq++}`;
    log.record({ hook_event_name: 'PreToolUse', session_id: session, cwd, tool_name: tool, tool_use_id: id, tool_input: input }, t);
    log.record({ hook_event_name: 'PermissionRequest', session_id: session, cwd, tool_name: tool, tool_use_id: id, tool_input: input }, t + 100);
    if (approve) log.record({ hook_event_name: 'PostToolUse', session_id: session, cwd, tool_name: tool, tool_use_id: id, tool_input: input, tool_response: { stdout: 'ok' } }, t + 100 + waitMs);
    else log.record({ hook_event_name: 'UserPromptSubmit', session_id: session, cwd }, t + 100 + waitMs);
    t += waitMs + 60_000;
  };
  for (let i = 0; i < 3; i++) prompt(A, 'Bash', { command: 'git status' }, 30_000, 'S1');
  for (let i = 0; i < 2; i++) prompt(B, 'Bash', { command: 'git status --short' }, 30_000, 'S2');
  for (let i = 0; i < 3; i++) prompt(A, 'Bash', { command: 'pnpm test && git diff' }, 120_000, 'S1');
  for (let i = 0; i < 4; i++) prompt(A, 'Bash', { command: 'git push' }, 10_000, 'S1');
  for (let i = 0; i < 2; i++) prompt(A, 'Bash', { command: 'rm -rf dist' }, 10_000, 'S1', false);
  for (let i = 0; i < 2; i++) prompt(B, 'WebFetch', { url: 'https://developer.mozilla.org/en-US/docs/x' }, 20_000, 'S2');
  prompt(A, 'Edit', { file_path: `${A}/x.ts` }, 5000, 'S1');
  // An unprompted git status that takes 10 s: subtracted from the wait.
  log.record({ hook_event_name: 'PreToolUse', session_id: 'S3', cwd: A, tool_name: 'Bash', tool_use_id: 'free', tool_input: { command: 'git status' } }, t);
  log.record({ hook_event_name: 'PostToolUse', session_id: 'S3', cwd: A, tool_name: 'Bash', tool_use_id: 'free', tool_input: { command: 'git status' } }, t + 10_000);
  log.flush();
  // Today's range, and the env as given (the wait card reads the hook log directly).
  const list = insights(store, { from: localDate(T0), to: localDate(T0) }, log, 'en', { env: env() });
  const card = byRule(list, 'permission-allow:')!;

  it('one card on the Tools tab with precise rules, the waiting time as the saving', () => {
    expect(card.pages).toEqual(['tools']);
    expect(card.targets!.map((x) => x.key)).toEqual(['Bash(git status *)', 'Bash(git diff *)', 'Bash(pnpm test *)', 'WebFetch(domain:developer.mozilla.org)']);
    expect(card.title).toBe('10 permission prompts you approved could be skipped with 4 precise allow rules');
    // git status: 5 × (30 s − 10 s run); pnpm test && git diff: 3 × 120 s (split over two rules); WebFetch: 2 × 20 s.
    expect(card.saving).toMatchObject({ waitMs: 5 * 20_000 + 3 * 120_000 + 2 * 20_000, basis: 'range', days: 1 });
    expect(card.estSavingTokens).toBeUndefined();
    expect(card.evidence.join('\n')).toMatch(/Not suggested \(5 prompts\): Bash: git push, Edit/);
  });
  it('read-only rules seen in two projects go to the user settings, project commands to that project\'s local settings', () => {
    for (const p of prompts(card)) {
      expect(p).toContain('Add "Bash(git status *)" to "permissions.allow" in ~/.claude/settings.json');
      expect(p).toContain('Add "Bash(pnpm test *)" to "permissions.allow" in /work/proj-a/.claude/settings.local.json');
      expect(p).toContain('Add "Bash(git diff *)" to "permissions.allow" in /work/proj-a/.claude/settings.local.json');
      expect(p).toContain('cp ~/.claude/settings.json ~/.claude/settings.json.bak-$(date +%Y%m%d-%H%M%S)');
      expect(p).toContain('cp /work/proj-a/.claude/settings.local.json /work/proj-a/.claude/settings.local.json.bak-');
      expect(p).toMatch(/no Bash\(\*\)/);
      expect(p).not.toMatch(/"Bash\(git push|"Bash\(rm|"Edit"/);
      expect(p).not.toMatch(/\brm\b/);
      expect(p).toMatch(/apply to new Claude Code sessions/);
    }
    expect(card.prompts!.ask).toContain('AskUserQuestion');
  });
  it('the wait card points to the Tools tab instead of repeating the rules', () => {
    const w = byRule(list, 'hook-waits')!;
    expect(w.seeAlso).toBe('tools');
    expect(w.fix).not.toMatch(/permissions/);
    expect(run('tools').some((i) => i.id.startsWith('permission-allow:'))).toBe(false); // no hook log → no card
  });
  it('Ukrainian', () => {
    const uk = permissionRecommendation(log.permissionEvents(T0 - DAY_MS, T0 + DAY_MS), { from: localDate(T0), to: localDate(T0) }, 'uk', env() as RecommendEnv)!;
    expect(uk.title).toMatch(/запитів дозволу/);
    for (const text of [uk.title, uk.detail, ...uk.evidence, ...prompts(uk)]) expect(text).not.toMatch(/[ыэъё]/i);
    expect(uk.prompts!.all).toContain('Додати "Bash(git status *)" до "permissions.allow" у ~/.claude/settings.json');
    db.close();
  });
});

// ---------- Tools tab ----------

describe('Tools tab: re-reads, huge outputs, failing tools', () => {
  const list = run('tools');
  it('only Tools cards, MCP heavy results stay one card per server', () => {
    expect(list.every((i) => i.pages?.includes('tools'))).toBe(true);
    expect(list.map((i) => i.id.split(':')[0]).sort()).toEqual(['big-outputs', 'big-results-mcp', 'failing-tools', 'repeated-reads']);
  });
  it('repeated reads: a note in the project CLAUDE.md for a file re-read in many sessions, a review otherwise', () => {
    const c = byRule(list, 'repeated-reads:')!;
    expect(c.targets!.map((x) => x.key)).toEqual([REF, `${B}/README.md`]);
    expect(c.saving).toMatchObject({ basis: 'range' });
    expect(c.saving!.period).toBeGreaterThan(0);
    for (const p of prompts(c)) {
      expect(p).toContain('Add one line to the "Reference notes" section of /work/proj-a/CLAUDE.md');
      expect(p).toContain('src/api.ts: <2–5 lines');
      expect(p).toContain('cp /work/proj-a/CLAUDE.md /work/proj-a/CLAUDE.md.bak-$(date +%Y%m%d-%H%M%S)');
      expect(p).toMatch(/Look at why \/work\/proj-b\/README\.md is read again and again[^\n]*\n {3}Nothing to change automatically/);
      expect(p).not.toMatch(/\brm\b/);
    }
  });
  it('huge built-in outputs: one card, the Output hygiene tips as separate items in ~/.claude/CLAUDE.md', () => {
    const c = byRule(list, 'big-outputs:')!;
    expect(c.targets!.map((x) => x.key)).toEqual(['Bash', 'Grep']);
    expect(c.title).toMatch(/6 tool results over 20K tokens from 2 built-in tools/);
    expect(c.saving!.period).toBe(6 * (Math.round(90_000 / 3.6) - 5000));
    const p = c.prompts!.ask;
    expect(p).toContain('Add one line to the "Output hygiene" section of ~/.claude/CLAUDE.md');
    expect(p).toContain('| tail -n 40');
    expect(p).toContain('rg -l');
    expect(p).toContain('cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak-');
    expect(p).toContain('AskUserQuestion');
    expect(list.some((i) => i.id.startsWith('big-results-Bash'))).toBe(false);
  });
  it('failing tools: Edit with its reasons; a failing command or a decline is not a tool failure', () => {
    const c = byRule(list, 'failing-tools:')!;
    expect(c.targets!.map((x) => x.key)).toEqual(['Edit']);
    // Edit calls of the main sessions, the editing subagents and the burst: 32 + 8 + 31.
    expect(c.evidence[0]).toBe('Edit: 16 of 71 calls failed (23%); mostly: text to replace not found (16)');
    expect(c.prompts!.all).toContain('Nothing to change automatically');
    expect(c.title).toBe('Edit fails in 23% of calls');
  });
});

// ---------- Subagents tab ----------

describe('Subagents tab', () => {
  const list = run('subagents');
  it('only Subagents cards', () => {
    expect(list.every((i) => i.pages?.includes('subagents'))).toBe(true);
    expect(list.map((i) => i.id.split(':')[0]).sort()).toEqual(['agent-failing', 'agent-model', 'agent-nesting', 'agent-startup']);
  });
  it('model: read-only types on Opus → Sonnet; own file, built-in through CLAUDE.md, plugin as a review', () => {
    const c = byRule(list, 'agent-model:')!;
    expect(c.targets!.map((x) => x.key)).toEqual(['acme:researcher', 'code-reviewer', 'Explore']);
    // Opus 5.5 → Sonnet 5.5: half the cost; the period is half of their tokens.
    expect(modelPrice('claude-opus-5-5')).toBe(4);
    expect(SONNET_PRICE / modelPrice('claude-opus-5-5')!).toBe(0.5);
    expect(c.saving!.costShare).toBeCloseTo(0.5);
    const tokens = [...store.files.values()].filter((f) => ['Explore', 'acme:researcher', 'code-reviewer'].includes(f.meta?.agentType ?? '')).reduce((n, f) => n + f.total.reduce((a, b) => a + b, 0), 0);
    expect(c.saving!.period).toBe(Math.round(tokens * 0.5));
    for (const p of prompts(c)) {
      expect(p).toContain('Run the subagent code-reviewer on sonnet: set "model: sonnet" in the frontmatter of ~/.claude/agents/code-reviewer.md');
      expect(p).toContain('cp ~/.claude/agents/code-reviewer.md ~/.claude/agents/code-reviewer.md.bak-');
      expect(p).toContain('Add one line to the "Subagents" section of ~/.claude/CLAUDE.md');
      expect(p).toContain('Start Explore subagents for searches and lookups with model "sonnet"');
      expect(p).toMatch(/a user agent ~\/\.claude\/agents\/Explore\.md overrides the built-in/);
      expect(p).toMatch(/Choose how to run the plugin agent acme:researcher on Sonnet[^\n]*an update would overwrite/);
      expect(p).not.toMatch(/\brm\b/);
    }
    // Agents that edit, Sonnet agents, forks and workflow agents are never in it.
    expect(c.targets!.some((x) => ['general-purpose', 'scout'].includes(x.key))).toBe(false);
  });
  it('startup overhead: short Explore runs, half of their startup as the estimate, points to Startup context', () => {
    const c = byRule(list, 'agent-startup:')!;
    expect(c.seeAlso).toBe('startup');
    expect(c.targets!.map((x) => x.key)).toEqual(['Explore']);
    expect(c.title).toMatch(/^32 of 32 subagents were short/);
    const ex = [...store.files.values()].find((f) => f.meta?.agentType === 'Explore')!;
    const per = estTokens(Object.values(ex.startup).reduce((n, c) => n + c, 0));
    expect(per).toBeGreaterThan(9_000);
    expect(c.saving).toMatchObject({ perSubagent: per, period: Math.round(32 * per * BATCH_RATIO), basis: 'range' });
    expect(c.prompts!.all).toContain('Do not start a subagent for a lookup that takes one or two tool calls');
  });
  it('a burst of subagents and deep nesting: a review naming the session', () => {
    const c = byRule(list, 'agent-nesting:')!;
    expect(c.targets!.map((x) => x.key)).toEqual([sid(99)]);
    expect(c.evidence[0]).toMatch(/31 subagents, up to 31 within 10 minutes, nesting depth 3/);
    expect(c.prompts!.all).toContain(`session id ${sid(99)}`);
  });
  it('failing agents: from foreground results and background notifications', () => {
    const c = byRule(list, 'agent-failing:')!;
    expect(c.targets!.map((x) => x.key)).toEqual(['general-purpose', 'Explore']);
    expect(c.evidence).toEqual(['general-purpose: 0 failed and 5 stopped of 8 runs with a known outcome', 'Explore: 3 failed and 0 stopped of 8 runs with a known outcome']);
  });
  it('Ukrainian (never Russian letters)', () => {
    const uk = run(undefined, 'uk');
    for (const id of ['agent-model:', 'agent-startup:', 'agent-nesting:', 'agent-failing:', 'repeated-reads:', 'big-outputs:', 'failing-tools:']) {
      const c = byRule(uk, id)!;
      expect(c, id).toBeDefined();
      for (const text of [c.title, c.detail, ...c.evidence, ...prompts(c)]) expect(text).not.toMatch(/[ыэъё]/i);
      expect(c.prompts!.ask).toContain('Поки нічого не змінюй');
    }
    expect(byRule(uk, 'agent-model:')!.title).toMatch(/типи субагентів лише читають/);
  });
});

describe('agent definition files', () => {
  it('finds a subagent by file name or frontmatter name, project folders first', () => {
    const user = path.join(tmp, 'agents-user');
    const proj = path.join(tmp, 'agents-proj');
    fs.mkdirSync(user, { recursive: true });
    fs.mkdirSync(proj, { recursive: true });
    fs.writeFileSync(path.join(user, 'reviewer.md'), '---\nname: reviewer\nmodel: opus\n---\nbody');
    fs.writeFileSync(path.join(user, 'misc.md'), '---\nname: "doc-finder"\ndescription: x\n---\n');
    fs.writeFileSync(path.join(proj, 'reviewer.md'), '---\nname: reviewer\n---\n');
    expect(findAgentFile('reviewer', [proj, user])).toBe(path.join(proj, 'reviewer.md'));
    expect(findAgentFile('doc-finder', [proj, user])).toBe(path.join(user, 'misc.md'));
    expect(findAgentFile('nope', [proj, user])).toBeNull();
    expect(findAgentFile('../x', [user])).toBeNull();
  });
});
