// GET /api/insights with ?page and ?unusedDays against a real server over a synthetic Claude dir
// (settings.json with enabledPlugins, a skills folder, transcripts with a skill listing).
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Insight } from '../../shared/api.ts';

const root = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-insights-api-'));
const claude = path.join(tmp, 'claude');
const DAY = 86_400_000;
let server: ChildProcess | null = null;
let base = '';

const LISTING = '- gamma:g1: a gamma skill nobody uses\n- delta:d1: a delta skill in use\n- old-own: my own skill, never used';
const sid = (n: number) => `abcdabcd-0000-0000-0000-${String(n).padStart(12, '0')}`;
function session(n: number, daysAgo: number, use?: string) {
  const ts = new Date(Date.now() - daysAgo * DAY).toISOString();
  const lines = [
    JSON.stringify({ type: 'attachment', attachment: { type: 'skill_listing', content: LISTING }, timestamp: ts }),
    JSON.stringify({
      type: 'assistant', requestId: `r${n}`, timestamp: ts, sessionId: sid(n), cwd: '/work/app',
      message: { model: 'claude-opus-5-5', id: `m${n}`, stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
        content: use ? [{ type: 'tool_use', id: `t${n}`, name: 'Skill', input: { skill: use } }] : [{ type: 'text', text: 'ok' }] },
    }),
  ];
  fs.writeFileSync(path.join(claude, 'projects', '-work-app', `${sid(n)}.jsonl`), lines.join('\n') + '\n');
}

/** A session that loads the MCP server "pencil" (never called) and a large global CLAUDE.md. */
function mcpSession(n: number, daysAgo: number) {
  const ts = new Date(Date.now() - daysAgo * DAY).toISOString();
  const lines = [
    JSON.stringify({ type: 'attachment', attachment: { type: 'mcp_instructions_delta', addedNames: ['pencil'], addedBlocks: ['p'.repeat(3600)] }, timestamp: ts }),
    JSON.stringify({ type: 'attachment', attachment: { type: 'deferred_tools_delta', addedNames: ['mcp__pencil__draw'], addedLines: ['mcp__pencil__draw'] }, timestamp: ts }),
    JSON.stringify({ type: 'attachment', attachment: { type: 'instructions', files: [{ path: path.join(claude, 'CLAUDE.md'), type: 'User', content: 'c'.repeat(10_000) }] }, timestamp: ts }),
    JSON.stringify({
      type: 'assistant', requestId: `mr${n}`, timestamp: ts, sessionId: sid(n), cwd: '/work/app',
      message: { model: 'claude-opus-5-5', id: `mm${n}`, stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: 'ok' }] },
    }),
  ];
  fs.writeFileSync(path.join(claude, 'projects', '-work-app', `${sid(n)}.jsonl`), lines.join('\n') + '\n');
}

/** A session that re-reads one file, gets a huge Bash result and starts three read-only Explore subagents on Opus. */
function toolSession(n: number, daysAgo: number) {
  const ts = new Date(Date.now() - daysAgo * DAY).toISOString();
  const dir = path.join(claude, 'projects', '-work-app');
  const calls = [
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'tool_use', id: `rd${n}-${i}`, name: 'Read', input: { file_path: '/work/app/src/api.ts' } })),
    { type: 'tool_use', id: `bs${n}`, name: 'Bash', input: { command: 'pnpm build' } },
  ];
  const results = calls.map((c) => ({ type: 'tool_result', tool_use_id: c.id, content: c.name === 'Bash' ? 'x'.repeat(90_000) : 'export const api = 1;' }));
  const lines = [
    JSON.stringify({
      type: 'assistant', requestId: `tr${n}`, timestamp: ts, sessionId: sid(n), cwd: '/work/app',
      message: { model: 'claude-opus-5-5', id: `tm${n}`, stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 }, content: calls },
    }),
    JSON.stringify({ type: 'user', timestamp: ts, sessionId: sid(n), cwd: '/work/app', message: { role: 'user', content: results } }),
  ];
  fs.writeFileSync(path.join(dir, `${sid(n)}.jsonl`), lines.join('\n') + '\n');
  const subs = path.join(dir, sid(n), 'subagents');
  fs.mkdirSync(subs, { recursive: true });
  for (let k = 0; k < 3; k++) {
    const id = `ex${n}${k}`;
    fs.writeFileSync(path.join(subs, `agent-${id}.meta.json`), JSON.stringify({ agentType: 'Explore', isBuiltIn: true, spawnDepth: 1, model: 'opus' }));
    fs.writeFileSync(path.join(subs, `agent-${id}.jsonl`), JSON.stringify({
      type: 'assistant', requestId: `er${id}`, timestamp: ts, sessionId: sid(n), cwd: '/work/app', isSidechain: true,
      message: { model: 'claude-opus-5-5', id: `em${id}`, stop_reason: 'end_turn', usage: { input_tokens: 400_000, output_tokens: 1 },
        content: [{ type: 'tool_use', id: `g${id}`, name: 'Grep', input: { pattern: 'x' } }, { type: 'tool_use', id: `r${id}`, name: 'Read', input: { file_path: '/work/app/a.ts' } }] },
    }) + '\n');
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); });
  });
}

async function waitFor<T>(fn: () => Promise<T | null>, ms = 15000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* not up yet */ }
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 150));
  }
}

const get = async (q: string) => (await (await fetch(`${base}/api/insights?${q}`)).json()) as Insight[];
const today = new Date();
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const RANGE = `from=${day(new Date(Date.now() - 60 * DAY))}&to=${day(today)}`;

beforeAll(async () => {
  fs.mkdirSync(path.join(claude, 'projects', '-work-app'), { recursive: true });
  fs.mkdirSync(path.join(claude, 'skills', 'old-own'), { recursive: true });
  fs.writeFileSync(path.join(claude, 'settings.json'), JSON.stringify({ enabledPlugins: { 'gamma@mkt': true, 'delta@mkt': true } }));
  session(1, 40);
  session(2, 3, 'delta:d1');
  session(3, 1, 'delta:d1');
  mcpSession(10, 45);
  mcpSession(11, 2);
  toolSession(20, 1);
  // Claude Code's account file: only the MCP server names are read from it.
  fs.writeFileSync(path.join(tmp, 'claude.json'), JSON.stringify({ mcpServers: { pencil: { command: 'pencil-mcp', env: { TOKEN: 'secret' } } } }));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    stdio: 'ignore',
    env: {
      ...process.env,
      CLORBIT_PORT: String(port),
      CLORBIT_CLAUDE_DIR: claude,
      CLORBIT_DATA_DIR: path.join(tmp, 'data'),
      CLORBIT_STATUSLINE_FILE: path.join(tmp, 'statusline.json'),
      CLORBIT_CLAUDE_JSON: path.join(tmp, 'claude.json'),
      CLORBIT_SERVE_WEB: '0',
    },
  });
  await waitFor(async () => {
    const j = (await (await fetch(`${base}/api/live`)).json()) as { scan: { done: boolean } };
    return j.scan.done ? j : null;
  });
}, 30000);

afterAll(() => {
  server?.kill('SIGTERM');
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('GET /api/insights', () => {
  it('?page=skills: the tab\'s cards, with targets, savings and prompts', async () => {
    const list = await get(`${RANGE}&page=skills`);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((i) => i.pages?.includes('skills'))).toBe(true);
    const plugins = list.find((i) => i.id.startsWith('unused-plugins:'))!;
    expect(plugins.targets!.map((t) => t.key)).toEqual(['gamma@mkt']);
    expect(plugins.scope).toBe('history');
    expect(plugins.saving!.perSession).toBeGreaterThan(0);
    expect(plugins.prompts!.all).toContain('claude plugin disable gamma@mkt --scope user');
    const own = list.find((i) => i.id.startsWith('unused-own-skills:'))!;
    expect(own.targets!.map((t) => t.key)).toEqual(['old-own']);
    expect(own.prompts!.all).toContain('skills-disabled/old-own');
  });

  it('?page filters, unknown pages are empty, no page returns everything', async () => {
    const all = await get(RANGE);
    const mcp = await get(`${RANGE}&page=mcp`);
    expect(mcp.some((i) => i.id.startsWith('unused-plugins:'))).toBe(false);
    expect(all.length).toBeGreaterThanOrEqual((await get(`${RANGE}&page=skills`)).length);
    expect(await get(`${RANGE}&page=bogus`)).toEqual([]);
  });

  it('?page=mcp: the unused server, with the command for its scope', async () => {
    const list = await get(`${RANGE}&page=mcp`);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((i) => i.pages?.includes('mcp'))).toBe(true);
    const card = list.find((i) => i.id.startsWith('unused-mcp:'))!;
    expect(card.targets!.map((t) => t.key)).toEqual(['pencil']);
    expect(card.prompts!.all).toContain('claude mcp remove pencil --scope user');
    expect(card.prompts!.all).toContain('claude.json.bak-$(date +%Y%m%d-%H%M%S)');
    expect(JSON.stringify(list)).not.toContain('secret');
    const uk = (await get(`${RANGE}&page=mcp&lang=uk`)).find((i) => i.id.startsWith('unused-mcp:'))!;
    expect(uk.title).toMatch(/MCP-сервер pencil/);
  });

  it('?page=startup: the large CLAUDE.md, the total and the unused server', async () => {
    const list = await get(`${RANGE}&page=startup`);
    expect(list.every((i) => i.pages?.includes('startup'))).toBe(true);
    const big = list.find((i) => i.id.startsWith('big-instructions:'))!;
    expect(big.prompts!.all).toMatch(/Compress .*CLAUDE\.md without losing meaning/);
    expect(big.saving!.perSession).toBeGreaterThan(0);
    expect(list.some((i) => i.id === 'startup-total')).toBe(true);
    expect(list.some((i) => i.id.startsWith('unused-mcp:'))).toBe(true);
    expect(list.some((i) => i.id.startsWith('mcp-failing:'))).toBe(false);
  });

  it('?page=tools: re-reads and huge Bash results; permission prompts from hook events become allow rules', async () => {
    const hook = (body: Record<string, unknown>) => fetch(`${base}/api/hook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    for (let i = 0; i < 3; i++) {
      const common = { session_id: 'hook-s', cwd: '/work/app', tool_name: 'Bash', tool_use_id: `hk${i}`, tool_input: { command: 'git status' } };
      await hook({ hook_event_name: 'PermissionRequest', ...common });
      await hook({ hook_event_name: 'PostToolUse', ...common, tool_response: { stdout: 'clean' } });
    }
    const list = await waitFor(async () => {
      const l = await get(`${RANGE}&page=tools`);
      return l.some((i) => i.id.startsWith('permission-allow:')) ? l : null;
    }, 5000);
    expect(list.every((i) => i.pages?.includes('tools'))).toBe(true);
    const ids = list.map((i) => i.id.split(':')[0]);
    for (const id of ['repeated-reads', 'big-outputs', 'permission-allow']) expect(ids).toContain(id);
    const allow = list.find((i) => i.id.startsWith('permission-allow:'))!;
    expect(allow.targets!.map((t) => t.key)).toEqual(['Bash(git status *)']);
    expect(allow.prompts!.all).toContain('Add "Bash(git status *)" to "permissions.allow" in /work/app/.claude/settings.local.json');
    expect(list.find((i) => i.id.startsWith('big-outputs:'))!.prompts!.all).toMatch(/"Output hygiene" section of .*CLAUDE\.md/);
  });

  it('?page=subagents: read-only Explore agents on Opus → Sonnet; ?lang=uk', async () => {
    const list = await get(`${RANGE}&page=subagents`);
    expect(list.every((i) => i.pages?.includes('subagents'))).toBe(true);
    const model = list.find((i) => i.id.startsWith('agent-model:'))!;
    expect(model.targets!.map((t) => t.key)).toEqual(['Explore']);
    expect(model.saving!.costShare).toBeCloseTo(0.5);
    expect(model.prompts!.all).toContain('Start Explore subagents for searches and lookups with model "sonnet"');
    const uk = (await get(`${RANGE}&page=subagents&lang=uk`)).find((i) => i.id.startsWith('agent-model:'))!;
    expect(uk.title).toMatch(/Субагент Explore лише читає/);
  });

  it('?unusedDays overrides the threshold; ?lang=uk words the prompts in Ukrainian', async () => {
    expect((await get(`${RANGE}&page=skills&unusedDays=60`)).some((i) => i.id.startsWith('unused-plugins:'))).toBe(false);
    const uk = (await get(`${RANGE}&page=skills&lang=uk`)).find((i) => i.id.startsWith('unused-plugins:'))!;
    expect(uk.title).toMatch(/Плагін gamma/);
    expect(uk.prompts!.ask).toContain('Поки нічого не змінюй');
  });

  it('the threshold from the settings applies when the query has none', async () => {
    const put = await fetch(`${base}/api/settings`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recommendations: { unusedDays: 60 } }) });
    expect(put.status).toBe(200);
    expect((await get(`${RANGE}&page=skills`)).some((i) => i.id.startsWith('unused-plugins:'))).toBe(false);
  });
});
