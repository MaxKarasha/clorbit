// Recommendations for the MCP and Startup context tabs: what the scanner records (MCP tool sizes, connection
// failures, tool errors, instruction files), every rule, the commands per MCP source, savings, the page filter, uk.
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Insight, InsightPage } from '../../shared/api.ts';
import { insights } from '../insights';
import { mcpNamesFrom } from '../mcp-config';
import { DAY_MS, type RecommendEnv } from '../recommend';
import { COMPRESS_RATIO, fileKind } from '../recommend-startup';
import { scanText } from '../scanner';
import { Store } from '../store';
import type { FileSummary } from '../types';
import { estTokens, localDate } from '../util';

const NOW = new Date(2026, 10, 18, 12).getTime();
const ago = (d: number, h = 10) => new Date(NOW - d * DAY_MS).setHours(h, 0, 0, 0);
const opts = { knownPlugins: ['alpha'] };
const HOME = os.homedir();
const USER_MD = path.join(HOME, '.claude', 'CLAUDE.md');
const RULES = '/work/proj-a/.claude/rules/style.md';
const MEMORY = path.join(HOME, '.claude', 'projects', '-work-proj-a', 'memory', 'MEMORY.md');

let seq = 0;
const at = (ts: number) => new Date(ts).toISOString();
const att = (ts: number, attachment: Record<string, unknown>) => JSON.stringify({ type: 'attachment', attachment, timestamp: at(ts) });
const tools = (server: string, names: string[]) => names.map((n) => `mcp__${server}__${n}`);

interface Call { tool: string; input?: Record<string, unknown>; error?: boolean; big?: boolean }
interface Spec {
  sid: string; agent?: string; ts: number; cwd: string;
  servers?: string[];                          // deferred MCP tools listed at the start (by key)
  instr?: Record<string, number>;              // MCP instructions by display name → chars
  defs?: Record<string, number>;               // MCP tools with full definitions in the prompt snapshot (key → tool count)
  failed?: string[]; auth?: string[];
  files?: { path: string; type: string; chars: number }[];
  hook?: number;
  calls?: Call[];
}

function file(o: Spec): FileSummary {
  const lines: string[] = [];
  if (o.instr) {
    const names = Object.keys(o.instr);
    lines.push(att(o.ts, { type: 'mcp_instructions_delta', addedNames: names, addedBlocks: names.map((n) => 'i'.repeat(o.instr![n])) }));
  }
  if (o.servers || o.failed || o.auth) {
    const names = (o.servers ?? []).flatMap((k) => tools(k, ['a', 'b']));
    lines.push(att(o.ts, {
      type: 'deferred_tools_delta', addedNames: names, addedLines: names,
      failedMcpServers: (o.failed ?? []).map((name) => ({ name, error: 'Connection closed' })),
      needsAuthMcpServers: o.auth ?? [],
    }));
  }
  if (o.defs) {
    const list = Object.entries(o.defs).flatMap(([k, n]) => Array.from({ length: n }, (_, i) => ({ name: `mcp__${k}__t${i}`, description: 'd'.repeat(300), schema: { type: 'object' } })));
    lines.push(att(o.ts, { type: 'prompt_snapshot', systemPrompt: ['sys'], tools: [{ name: 'Read', description: 'read' }, ...list] }));
  }
  if (o.files) lines.push(att(o.ts, { type: 'instructions', files: o.files.map((f) => ({ path: f.path, type: f.type, content: 'c'.repeat(f.chars) })) }));
  if (o.hook) lines.push(att(o.ts, { type: 'hook_additional_context', hookName: 'SessionStart', content: ['project status: ' + 'h'.repeat(o.hook)] }));
  const calls = o.calls?.length ? o.calls : [];
  const blocks: unknown[] = [{ type: 'text', text: 'ok' }];
  const results: unknown[] = [];
  for (const c of calls) {
    const id = `t${seq++}`;
    blocks.push({ type: 'tool_use', id, name: c.tool, input: c.input ?? {} });
    results.push({ type: 'tool_result', tool_use_id: id, is_error: c.error === true, content: c.big ? 'x'.repeat(90_000) : c.error ? 'Error: boom' : 'fine' });
  }
  lines.push(JSON.stringify({
    type: 'assistant', requestId: `r${seq++}`, timestamp: at(o.ts), sessionId: o.sid, cwd: o.cwd,
    message: { model: 'claude-opus-5-5', id: `m${seq++}`, content: blocks, stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } },
  }));
  if (results.length) lines.push(JSON.stringify({ type: 'user', timestamp: at(o.ts + 1000), sessionId: o.sid, cwd: o.cwd, message: { role: 'user', content: results } }));
  const p = o.agent ? `/p/-work/${o.sid}/subagents/agent-${o.agent}.jsonl` : `/p/-work/${o.sid}.jsonl`;
  return scanText(p, { sessionId: o.sid, agentId: o.agent ?? null, projectDir: '-work' }, lines.join('\n'), opts);
}

const sid = (n: number) => `11111111-0000-0000-0000-${String(n).padStart(12, '0')}`;
const store = new Store(path.join(os.tmpdir(), 'clorbit-none'), null, opts);
const put = (s: FileSummary) => (store as any).put(s);

const ALL = ['pencil', 'localsrv', 'projsrv', 'plugin_alpha_alpha-mcp', 'plugin_gone_gmcp', 'claude_ai_Canva', 'claude_ai_Figma', 'mystery', 'github'];
const INSTR = { pencil: 3600, 'plugin:alpha:alpha-mcp': 1800, 'claude.ai Canva': 720, 'claude.ai Figma': 720, 'plugin:gone:gmcp': 360, github: 1440 };
// 50 days ago pencil and alpha's server were used; mystery, localsrv, projsrv were already there.
put(file({ sid: sid(900), ts: ago(50), cwd: '/work/proj-a', servers: ALL, instr: INSTR, calls: [{ tool: 'mcp__pencil__a' }, { tool: 'mcp__plugin_alpha_alpha-mcp__a' }] }));
const projects = ['/work/proj-a', '/work/proj-b', '/work/proj-c'];
for (let d = 1; d <= 12; d++) {
  const cwd = projects[d % 3];
  const calls: Call[] = [{ tool: 'mcp__claude_ai_Figma__a' }];
  if (cwd === '/work/proj-a') calls.push({ tool: 'mcp__github__a' });
  if (d <= 2) calls.push({ tool: 'mcp__claude-in-chrome__computer', big: true }, { tool: 'mcp__claude-in-chrome__read_page', big: true });
  if (d <= 6) calls.push(...Array.from({ length: 2 }, (_, i) => ({ tool: 'mcp__errsrv__q', error: i === 0 })));
  if (d === 5) calls.push({ tool: 'mcp__flaky__a' });
  if (d === 1) calls.push({ tool: 'Skill', input: { skill: 'alpha:helper' } }); // the plugin alpha is in use
  put(file({
    sid: sid(d), ts: ago(d), cwd,
    servers: [...ALL, 'claude-in-chrome', 'errsrv', ...(d === 5 ? ['flaky'] : [])],
    instr: INSTR,
    defs: { github: 4 },
    failed: d <= 4 ? ['flaky'] : [],
    auth: d <= 3 ? ['claude.ai Gmail'] : [],
    files: [
      { path: USER_MD, type: 'User', chars: 12_000 },
      { path: path.join(cwd, 'CLAUDE.md'), type: 'Project', chars: 2_000 },
      ...(cwd === '/work/proj-a' ? [{ path: RULES, type: 'Project', chars: 9_000 }, { path: MEMORY, type: 'AutoMem', chars: 5_400 }] : []),
    ],
    hook: 2000,
    calls,
  }));
  if (d <= 6) put(file({ sid: sid(d), agent: `s${d}`, ts: ago(d, 11), cwd, servers: ALL, instr: INSTR, files: [{ path: USER_MD, type: 'User', chars: 12_000 }] }));
}

const env = (over: Partial<RecommendEnv> = {}): Partial<RecommendEnv> => ({
  now: NOW,
  unusedDays: 30,
  enabledPlugins: { 'alpha@mkt': true, 'gone@mkt': true },
  settingsFile: '~/.claude/settings.json',
  skillsDir: '~/.claude/skills',
  ownSkillExists: () => false,
  claudeJsonFile: '~/.claude.json',
  mcp: {
    user: ['pencil', 'github'],
    local: { '/work/proj-a': ['localsrv'] },
    projectFile: (dir) => (dir === '/work/proj-b' ? ['projsrv'] : []),
  },
  ...over,
});
const range = { from: localDate(ago(29)), to: localDate(NOW) };
const run = (over: Partial<RecommendEnv> = {}, page?: InsightPage, lang: 'en' | 'uk' = 'en') => insights(store, range, null, lang, { env: env(over), page });
const byRule = (list: Insight[], rule: string) => list.find((i) => i.id.startsWith(rule));

describe('scanner: MCP sizes, failures, errors and instruction files', () => {
  const s = [...store.files.values()].find((f) => f.sessionId === sid(1) && !f.agentId)!;
  it('records deferred tool names and full tool definitions per server', () => {
    expect(s.mcpToolNames!.pencil).toBe('mcp__pencil__a'.length + 1 + 'mcp__pencil__b'.length + 1);
    expect(s.mcpToolDefs!.github).toBeGreaterThan(4 * 300);
    expect(s.mcpToolDefs!.Read).toBeUndefined();
  });
  it('records failed and needs-auth servers, and tool errors that are not the user declining', () => {
    expect(s.mcpIssues!.flaky).toMatchObject({ failed: 1, auth: 0, error: 'Connection closed' });
    expect(s.mcpIssues!['claude.ai Gmail']).toMatchObject({ failed: 0, auth: 1 });
    const day = Object.values(s.days)[0];
    expect(day.tools['mcp__errsrv__q']).toMatchObject({ calls: 2, err: 1 });
    const declined = scanText('/p/-w/x.jsonl', { sessionId: 'x', agentId: null, projectDir: '-w' }, [
      JSON.stringify({ type: 'assistant', requestId: 'q', timestamp: at(NOW), message: { id: 'q', content: [{ type: 'tool_use', id: 'u1', name: 'mcp__a__b', input: {} }], usage: { input_tokens: 1 } } }),
      JSON.stringify({ type: 'user', timestamp: at(NOW), message: { content: [{ type: 'tool_result', tool_use_id: 'u1', is_error: true, content: "The user doesn't want to proceed with this tool use." }] } }),
    ].join('\n'), opts);
    expect(Object.values(declined.days)[0].tools['mcp__a__b'].err).toBeUndefined();
  });
  it('records instruction files by path (a repeat keeps the largest size), only before the first reply', () => {
    expect(s.memoryFiles![USER_MD]).toEqual({ type: 'User', chars: 12_000 });
    const nested = scanText('/p/-w/y.jsonl', { sessionId: 'y', agentId: null, projectDir: '-w' }, [
      att(NOW, { type: 'nested_memory', path: '/w/sub/CLAUDE.md', content: { path: '/w/sub/CLAUDE.md', type: 'Project', content: 'n'.repeat(500) } }),
      att(NOW, { type: 'instructions', files: [{ path: '/w/CLAUDE.md', type: 'Project', content: 'a'.repeat(100) }] }),
      att(NOW, { type: 'instructions', files: [{ path: '/w/CLAUDE.md', type: 'Project', content: 'a'.repeat(300) }] }),
      JSON.stringify({ type: 'assistant', requestId: 'z', timestamp: at(NOW), message: { id: 'z', content: [], usage: { input_tokens: 1 } } }),
      att(NOW, { type: 'instructions', files: [{ path: '/w/late/CLAUDE.md', type: 'Project', content: 'l'.repeat(900) }] }),
    ].join('\n'), opts);
    expect(nested.memoryFiles).toEqual({ '/w/sub/CLAUDE.md': { type: 'Project', chars: 500 }, '/w/CLAUDE.md': { type: 'Project', chars: 300 } });
  });
  it('classifies instruction files', () => {
    expect(fileKind(USER_MD, 'User')).toBe('user');
    expect(fileKind(RULES, 'Project')).toBe('rules');
    expect(fileKind('/w/CLAUDE.local.md', 'Local')).toBe('local');
    expect(fileKind(MEMORY, 'AutoMem')).toBe('memory');
    expect(fileKind('/w/CLAUDE.md', 'Project')).toBe('project');
  });
  it('reads only MCP server names from ~/.claude.json', () => {
    const v = mcpNamesFrom({ mcpServers: { pencil: { command: 'x', env: { TOKEN: 'secret' } } }, projects: { '/work/a': { mcpServers: { db: {} } }, relative: { mcpServers: { no: {} } } }, oauthAccount: { emailAddress: 'a@b' } });
    expect(v).toEqual({ user: ['pencil'], local: { '/work/a': ['db'] } });
    expect(JSON.stringify(v)).not.toContain('secret');
  });
});

describe('MCP: unused servers (whole history)', () => {
  const card = byRule(run(), 'unused-mcp:')!;
  const text = card.prompts!.all;
  it('one card with every unused server, but not plugins already in the "unused plugins" card', () => {
    expect(card.targets!.map((t) => t.key).sort()).toEqual(['claude_ai_Canva', 'localsrv', 'mystery', 'pencil', 'plugin_alpha_alpha-mcp', 'plugin_gone_gmcp', 'projsrv']);
    expect(card.scope).toBe('history');
    expect(card.pages).toEqual(['mcp', 'startup']);
    const covered = insights(store, range, null, 'en', { env: env() }).find((i) => i.id.startsWith('unused-plugins:'));
    // No skill listing here, so the skills rules have nothing to say about "gone": it stays in this card.
    expect(covered).toBeUndefined();
  });
  it('names the exact command for each source', () => {
    expect(text).toContain('claude mcp remove pencil --scope user');
    expect(text).toContain(`claude mcp add-json pencil "$(jq -c --arg n pencil '.mcpServers[$n]' <the backup of ~/.claude.json>)" --scope user`);
    expect(text).toContain('cd /work/proj-a && claude mcp remove localsrv --scope local');
    expect(text).toContain('"disabledMcpjsonServers" in /work/proj-b/.claude/settings.local.json');
    expect(text).toMatch(/MCP server plugin:alpha:alpha-mcp comes with the plugin alpha[^\n]*claude plugin disable alpha@mkt --scope user/);
    // A plugin's server whose plugin is unused as a whole: disable the plugin.
    expect(text).toMatch(/Disable the plugin gone@mkt — its MCP server plugin:gone:gmcp is unused, and so is the plugin as a whole/);
    expect(text).toContain('claude plugin disable gone@mkt --scope user');
    expect(text).toMatch(/Disconnect the claude\.ai connector Canva — [^\n]*claude\.ai → Settings → Connectors/);
    expect(text).not.toContain('disableClaudeAiConnectors');
    expect(text).toMatch(/Find where the MCP server mystery is configured/);
    // Backups of every file the steps edit; removal only through claude mcp remove; no rm.
    expect(text).toContain('cp ~/.claude.json ~/.claude.json.bak-$(date +%Y%m%d-%H%M%S)');
    expect(text).toContain('cp /work/proj-b/.claude/settings.local.json');
    expect(text).toContain('"claude mcp remove" is the one removal allowed here');
    expect(text).not.toMatch(/\brm\b/);
    expect(text).toContain('claude mcp list');
  });
  it('savings come from instructions and tool names, per session and per subagent', () => {
    const pencil = card.targets!.find((t) => t.key === 'pencil')!;
    expect(pencil.lastUsed).toBe(ago(50));
    const names = ('mcp__pencil__a'.length + 1) * 2;
    expect(pencil.tokensPerSession).toBe(estTokens(3600 + names));
    expect(card.saving!.perSubagent).toBeGreaterThan(0);
    expect(card.saving!.period).toBeGreaterThan(card.saving!.perSession!);
    expect(card.evidence.find((e) => e.startsWith('pencil'))).toMatch(/user config \(~\/\.claude\.json\).*instructions 1\.0K \+ tool names/);
  });
  it('all claude.ai connectors unused → one switch in the user settings', () => {
    const c = byRule(run({ unusedDays: 1 }), 'unused-mcp:')!;
    expect(c.prompts!.all).toContain('"disableClaudeAiConnectors": true in ~/.claude/settings.json');
    expect(c.prompts!.all).toContain('cp ~/.claude/settings.json');
  });
  it('a plugin covered by the skills card is left out', () => {
    const LIST = '- gone:g1: a skill nobody uses';
    const s2 = new Store(path.join(os.tmpdir(), 'clorbit-none-2'), null, opts);
    for (const f of store.files.values()) (s2 as any).put(f);
    const extra = scanText('/p/-work/zz.jsonl', { sessionId: 'zz', agentId: null, projectDir: '-work' }, [
      att(ago(45), { type: 'skill_listing', content: LIST }),
      att(ago(45), { type: 'mcp_instructions_delta', addedNames: ['plugin:gone:gmcp'], addedBlocks: ['x'] }),
      JSON.stringify({ type: 'assistant', requestId: 'zz', timestamp: at(ago(45)), cwd: '/work/proj-a', message: { id: 'zz', content: [], usage: { input_tokens: 1 } } }),
      att(ago(2), { type: 'skill_listing', content: LIST }),
    ].join('\n'), opts);
    (s2 as any).put(extra);
    (s2 as any).put({ ...extra, path: '/p/-work/zz2.jsonl', sessionId: 'zz2', firstTs: ago(2), lastTs: ago(2), skillsByPlugin: { gone: LIST.length + 1 }, skillsByName: { 'gone:g1': LIST.length + 1 } });
    const list = insights(s2, range, null, 'en', { env: env() });
    expect(byRule(list, 'unused-plugins:')!.targets!.map((t) => t.label)).toContain('gone');
    expect(byRule(list, 'unused-mcp:')!.targets!.map((t) => t.key)).not.toContain('plugin_gone_gmcp');
  });
});

describe('MCP: failing servers, heavy results, servers used in few projects', () => {
  const list = run();
  it('failures and tool errors from the selected range; re-auth or fix, never automatic', () => {
    const card = byRule(list, 'mcp-failing:')!;
    expect(card.targets!.map((t) => t.label).sort()).toEqual(['claude.ai Gmail', 'errsrv', 'flaky']);
    expect(card.evidence.join('\n')).toMatch(/flaky: failed to connect in 4 of 5 sessions \(last error: Connection closed\)/);
    expect(card.evidence.join('\n')).toMatch(/errsrv: 6 of 12 tool calls returned an error/);
    const p = card.prompts!.all;
    expect(p).toMatch(/Sign in to the MCP server claude\.ai Gmail again[^\n]*Reconnect it on claude\.ai/);
    expect(p).toMatch(/Find out why the MCP server flaky fails[^\n]*claude mcp get flaky/);
    expect(p).toContain('Nothing to change automatically');
    expect(card.scope).toBe('range');
  });
  it('heavy results: one card per server on the MCP and Tools tabs, with tips, not in the per-tool cards', () => {
    const card = byRule(list, 'big-results-mcp:claude-in-chrome')!;
    expect(card.pages).toEqual(['mcp', 'tools']);
    expect(card.title).toMatch(/claude-in-chrome: 4 results over 20K tokens/);
    expect(card.detail).toMatch(/screenshots at a lower scale/);
    expect(card.saving).toMatchObject({ basis: 'range' });
    expect(card.prompts!.all).toMatch(/Review how I call claude-in-chrome \((computer, read_page|read_page, computer)\)/);
    expect(list.some((i) => i.id.startsWith('big-results-mcp__'))).toBe(false);
  });
  it('a user-scope server used in one of three projects: move it to that project', () => {
    const card = byRule(list, 'mcp-projects:github')!;
    expect(card.title).toBe('MCP server github loads in every project, used in 1 of 3');
    expect(card.saving!.perSession).toBeGreaterThan(estTokens(1440));
    expect(card.saving!.period).toBeLessThan(byRule(list, 'mcp-projects:github')!.saving!.perSession! * 30 * 100);
    const p = card.prompts!.all;
    expect(p).toContain(`(cd /work/proj-a && claude mcp add-json github "$(jq -c --arg n github '.mcpServers[$n]' ~/.claude.json)" --scope local) && claude mcp remove github --scope user`);
    expect(p).toContain('(cd /work/proj-a && claude mcp remove github --scope local)');
    expect(p).toContain('cp ~/.claude.json ~/.claude.json.bak-');
    // Not also in the unused card.
    expect(byRule(list, 'unused-mcp:')!.targets!.some((t) => t.key === 'github')).toBe(false);
  });
});

describe('Startup context', () => {
  const list = run();
  it('large instruction files: compress with a backup; savings are an estimate of 40%', () => {
    const card = byRule(list, 'big-instructions:')!;
    expect(card.targets!.map((t) => t.label)).toEqual(['~/.claude/CLAUDE.md', RULES]);
    expect(card.targets![0].tokensPerSession).toBe(estTokens(12_000));
    // The global file is in every session and subagent; 40% of it.
    expect(card.saving!.perSubagent).toBe(Math.round(estTokens(12_000) * COMPRESS_RATIO));
    expect(card.detail).toMatch(/about 40%/);
    const p = card.prompts!.all;
    expect(p).toContain('Compress ~/.claude/CLAUDE.md without losing meaning');
    expect(p).toContain('cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak-$(date +%Y%m%d-%H%M%S)');
    expect(p).toMatch(/not an @import/);
    expect(p).toContain(`wc -c ~/.claude/CLAUDE.md ${RULES}`);
    expect(p).not.toMatch(/\brm\b/);
  });
  it('a large memory index: consolidate, archive instead of delete', () => {
    const card = byRule(list, 'big-memory:')!;
    expect(card.targets![0].label).toBe('~/.claude/projects/-work-proj-a/memory/MEMORY.md');
    expect(card.targets![0].note).toBe('proj-a');
    expect(card.prompts!.ask).toMatch(/into an "archive" folder next to them \(do not delete them\)/);
  });
  it('settings hooks that print context at every start; plugin hooks are not repeated', () => {
    const card = byRule(list, 'hook-event-context:')!;
    expect(card.title).toMatch(/The SessionStart hook adds ~\d+ tokens to every session/);
    expect(card.prompts!.all).toMatch(/Review the SessionStart hook[^\n]*~\/\.claude\/settings\.json/);
    expect(list.some((i) => i.id.startsWith('hook-context:'))).toBe(false);
  });
  it('the startup total says what subagents pay again', () => {
    const card = list.find((i) => i.id === 'startup-total')!;
    expect(card.pages).toEqual(['startup']);
    expect(card.evidence.join('\n')).toMatch(/Subagents start with their own startup context: 6 in this period ×/);
  });
  it('page filter: MCP and startup tabs get their cards only', () => {
    const mcp = run({}, 'mcp');
    expect(mcp.every((i) => i.pages?.includes('mcp'))).toBe(true);
    expect(mcp.map((i) => i.id.split(':')[0]).sort()).toEqual(['big-results-mcp', 'mcp-failing', 'mcp-projects', 'unused-mcp']);
    const startup = run({}, 'startup');
    expect(startup.every((i) => i.pages?.includes('startup'))).toBe(true);
    expect(startup.some((i) => i.id.startsWith('big-instructions:'))).toBe(true);
    expect(startup.some((i) => i.id.startsWith('mcp-failing:'))).toBe(false);
  });
  it('Ukrainian wording and prompts (never Russian letters)', () => {
    const uk = run({}, undefined, 'uk');
    for (const id of ['unused-mcp:', 'mcp-failing:', 'mcp-projects:', 'big-results-mcp:', 'big-instructions:', 'big-memory:', 'hook-event-context:', 'startup-total']) {
      const c = byRule(uk, id)!;
      expect(c, id).toBeDefined();
      for (const text of [c.title, c.detail, ...c.evidence, c.prompts?.all ?? '', c.prompts?.ask ?? '']) expect(text).not.toMatch(/[ыэъё]/i);
    }
    const unused = byRule(uk, 'unused-mcp:')!;
    expect(unused.title).toMatch(/MCP-сервер/);
    expect(unused.prompts!.ask).toContain('Поки нічого не змінюй');
    expect(unused.prompts!.all).toContain('claude mcp remove pencil --scope user');
    expect(byRule(uk, 'big-instructions:')!.prompts!.all).toContain('Стиснути ~/.claude/CLAUDE.md без втрати змісту');
  });
});
