// Scanner unit tests on small synthetic transcripts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readLines } from '../lines';
import { scanFile, scanText } from '../scanner';
import { buildTree } from '../tree';
import type { FileSummary } from '../types';
import { localDate, sumT4 } from '../util';
import { OWN_SKILLS, migrateSummaryKeys, startupLabel } from '../i18n';

const opts = { knownPlugins: ['superpowers'] };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const SID = '11111111-2222-3333-4444-555555555555';
const mainId = { sessionId: SID, agentId: null, projectDir: '-tmp-proj' };

let n = 0;
function asst(o: {
  ts: string; req: string; usage?: [number, number, number, number]; blocks?: any[]; stop?: string | null; model?: string;
  skill?: string; plugin?: string; mcpServer?: string; mcpTool?: string; sidechain?: boolean;
}) {
  const [i, out, cr, cw] = o.usage ?? [10, 20, 300, 40];
  const rec: any = {
    parentUuid: null, isSidechain: o.sidechain ?? false,
    message: {
      model: o.model ?? 'claude-opus-5-5', id: 'msg_' + o.req, type: 'message', role: 'assistant',
      content: o.blocks ?? [{ type: 'text', text: 'hello' }], stop_reason: o.stop === undefined ? 'end_turn' : o.stop,
      usage: { input_tokens: i, output_tokens: out, cache_read_input_tokens: cr, cache_creation_input_tokens: cw, output_tokens_details: { thinking_tokens: 0 } },
    },
    requestId: o.req, type: 'assistant', uuid: 'u' + n++, timestamp: o.ts, sessionId: SID, cwd: '/tmp/proj', gitBranch: 'main', effort: 'high',
  };
  if (o.skill) rec.attributionSkill = o.skill;
  if (o.plugin) rec.attributionPlugin = o.plugin;
  if (o.mcpServer) rec.attributionMcpServer = o.mcpServer;
  if (o.mcpTool) rec.attributionMcpTool = o.mcpTool;
  return JSON.stringify(rec);
}
function toolResult(ts: string, id: string, content: any, dup = true) {
  const rec: any = {
    parentUuid: null, isSidechain: false, promptId: 'p', type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] },
    uuid: 'u' + n++, timestamp: ts,
  };
  if (dup) rec.toolUseResult = { stdout: typeof content === 'string' ? content : JSON.stringify(content) };
  rec.sessionId = SID;
  return JSON.stringify(rec);
}
const prompt = (ts: string, text: string) => JSON.stringify({ type: 'user', isSidechain: false, message: { role: 'user', content: text }, uuid: 'u' + n++, timestamp: ts });
const blob = (size: number) => JSON.stringify({ type: 'api-request-blob', sessionId: SID, hash: 'h', blob: 'x'.repeat(size) });

// Local date/hour to ISO: tests must pass in any time zone.
const iso = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();

describe('deduplication by requestId', () => {
  it('several records of one API turn count once', () => {
    const t = iso(2026, 11, 10, 12);
    const text = [
      asst({ ts: t, req: 'r1', blocks: [{ type: 'thinking', thinking: '' }], stop: 'tool_use' }),
      asst({ ts: t, req: 'r1', blocks: [{ type: 'text', text: 'Reading it now' }], stop: 'tool_use' }),
      asst({ ts: t, req: 'r1', blocks: [{ type: 'tool_use', id: 'tu1', name: 'Read', input: { file_path: '/a/b/c.ts' } }], stop: 'tool_use' }),
      asst({ ts: t, req: 'r2', usage: [1, 2, 3, 4] }),
    ].join('\n');
    const s = scanText('/x.jsonl', mainId, text, opts);
    expect(s.turns).toBe(2);
    expect(s.total).toEqual([11, 22, 303, 44]);
    expect(s.toolCalls).toBe(1);
    expect(s.carry.lastTool).toBe('Read c.ts');
    expect(s.carry.lastText).toBe('hello');
  });

  it('without requestId, message.id is used; <synthetic> is ignored', () => {
    const t = iso(2026, 11, 10, 12);
    const a = JSON.parse(asst({ ts: t, req: 'q' })); delete a.requestId;
    const b = JSON.parse(asst({ ts: t, req: 'q' })); delete b.requestId;
    const syn = asst({ ts: t, req: 'syn', model: '<synthetic>', usage: [999, 999, 999, 999] });
    const s = scanText('/x.jsonl', mainId, [JSON.stringify(a), JSON.stringify(b), syn].join('\n'), opts);
    expect(s.turns).toBe(1);
    expect(sumT4(s.total)).toBe(370);
  });
});

describe('tool result token estimate', () => {
  it('counts only the result content (not the toolUseResult duplicate), chars / 3.6', () => {
    const t = iso(2026, 11, 10, 12);
    const big = 'é'.repeat(36_000); // 10,000 tokens (multi-byte chars count as chars)
    const text = [
      asst({ ts: t, req: 'r1', blocks: [{ type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'ls -la /tmp && echo done' } }], stop: 'tool_use' }),
      toolResult(t, 'tu1', big),
      asst({ ts: t, req: 'r2', blocks: [{ type: 'tool_use', id: 'tu2', name: 'mcp__claude-in-chrome__computer', input: {} }], stop: 'tool_use' }),
      toolResult(t, 'tu2', [{ type: 'text', text: 'x'.repeat(360) }, { type: 'text', text: 'y'.repeat(360) }]),
    ].join('\n');
    const s = scanText('/x.jsonl', mainId, text, opts);
    const day = s.days[localDate(Date.parse(t))];
    expect(day.tools.Bash).toMatchObject({ calls: 1, res: 10_000, resN: 1, max: 10_000 });
    expect(day.tools['mcp__claude-in-chrome__computer'].res).toBe(200);
    expect(s.carry.pending).toEqual({});
    expect(s.mcpSeen).toContain('claude-in-chrome');
  });

  it('results > 20K tokens go to bigResults', () => {
    const t = iso(2026, 11, 10, 12);
    const text = [
      asst({ ts: t, req: 'r1', blocks: [{ type: 'tool_use', id: 'tu1', name: 'Read', input: { file_path: '/big.log' } }], stop: 'tool_use' }),
      toolResult(t, 'tu1', 'z'.repeat(90_000)),
    ].join('\n');
    const s = scanText('/x.jsonl', mainId, text, opts);
    expect(s.bigResults).toHaveLength(1);
    expect(s.bigResults[0]).toMatchObject({ tool: 'Read', label: 'Read big.log', tokens: 25_000 });
  });
});

describe('attribution', () => {
  it('splits tokens by skill, plugin, MCP server and tool', () => {
    const t = iso(2026, 11, 10, 12);
    const text = [
      asst({ ts: t, req: 'a', usage: [1, 1, 1, 1], skill: 'superpowers:brainstorming', plugin: 'superpowers' }),
      asst({ ts: t, req: 'b', usage: [2, 2, 2, 2], mcpServer: 'claude-in-chrome', mcpTool: 'computer' }),
      asst({ ts: t, req: 'c', usage: [5, 5, 5, 5] }),
      asst({ ts: t, req: 'd', blocks: [{ type: 'tool_use', id: 's1', name: 'Skill', input: { skill: 'superpowers:brainstorming' } }], usage: [0, 0, 0, 0], stop: 'tool_use' }),
    ].join('\n');
    const s = scanText('/x.jsonl', mainId, text, opts);
    const d = s.days[localDate(Date.parse(t))];
    expect(d.skills['superpowers:brainstorming'].t).toEqual([1, 1, 1, 1]);
    expect(d.plugins.superpowers.turns).toBe(1);
    expect(d.mcpServers['claude-in-chrome'].t).toEqual([2, 2, 2, 2]);
    expect(d.mcpTools['claude-in-chrome\u0001computer'].turns).toBe(1);
    expect(d.unattributed).toBe(20);
    expect(d.skillLoads['superpowers:brainstorming']).toBe(1);
  });

  it('startup context: plugin hook recognized by its text, skill listing split by plugin', () => {
    const t = iso(2026, 11, 10, 12);
    const hook = JSON.stringify({ type: 'attachment', attachment: { type: 'hook_additional_context', content: ['You have superpowers. superpowers:using-superpowers ...'], hookName: 'SessionStart' }, rendered: [{ content: 'a'.repeat(3600) }], timestamp: t });
    const listing = JSON.stringify({ type: 'attachment', attachment: { type: 'skill_listing', content: '- superpowers:brainstorming: a description\n- my-skill: another description' }, rendered: [{ content: 'b'.repeat(720) }], timestamp: t });
    const s = scanText('/x.jsonl', mainId, [hook, listing, asst({ ts: t, req: 'r' }), listing].join('\n'), opts);
    expect(s.startup['hook:plugin:superpowers']).toBe(3600);
    expect(s.startup.skills).toBe(720); // a repeated listing after the first reply is not counted
    expect(s.skillsByPlugin.superpowers).toBeGreaterThan(0);
    expect(s.skillsByPlugin[OWN_SKILLS]).toBeGreaterThan(0);
    expect(startupLabel('hook:plugin:superpowers', 'en')).toBe('Plugin hook superpowers');
    expect(startupLabel('skills', 'uk')).toBe('Список скілів');
  });

  it('migrates legacy (Ukrainian) startup keys of stored summaries', () => {
    const legacy = { startup: { 'Список скілів': 10, 'Хук плагіна superpowers': 5, 'CLAUDE.md': 3 }, skillsByPlugin: { 'власні скіли': 7 } };
    migrateSummaryKeys(legacy);
    expect(legacy.startup).toEqual({ skills: 10, 'hook:plugin:superpowers': 5, claudeMd: 3 });
    expect(legacy.skillsByPlugin).toEqual({ [OWN_SKILLS]: 7 });
  });
});

describe('per-day buckets', () => {
  it('turns on different local dates land in different buckets and hours', () => {
    const t1 = iso(2026, 11, 10, 23, 30);
    const t2 = iso(2026, 11, 11, 0, 30);
    const s = scanText('/x.jsonl', mainId, [asst({ ts: t1, req: 'a', usage: [1, 0, 0, 0] }), asst({ ts: t2, req: 'b', usage: [0, 2, 0, 0] })].join('\n'), opts);
    expect(Object.keys(s.days).sort()).toEqual(['2026-11-10', '2026-11-11']);
    expect(s.days['2026-11-10'].hours['23']).toEqual([1, 0, 0, 0]);
    expect(s.days['2026-11-11'].hours['0']).toEqual([0, 2, 0, 0]);
  });
});

describe('incremental reads', () => {
  const projectsDir = path.join(tmp, 'projects');
  const file = path.join(projectsDir, '-tmp-proj', `${SID}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const lines: string[] = [];
  for (let i = 0; i < 40; i++) {
    const t = iso(2026, 11, 10 + (i % 3), 8 + (i % 10), i);
    lines.push(prompt(t, `prompt ${i}`));
    lines.push(asst({ ts: t, req: `r${i}`, blocks: [{ type: 'text', text: `thinking ${i}` }], stop: 'tool_use' }));
    lines.push(asst({ ts: t, req: `r${i}`, blocks: [{ type: 'tool_use', id: `tu${i}`, name: i % 2 ? 'Read' : 'Grep', input: { file_path: `/f${i % 4}.ts`, pattern: 'x' } }], stop: 'tool_use' }));
    if (i % 5 === 0) lines.push(blob(5_000_000)); // a large line that does not fit into one read chunk
    lines.push(toolResult(t, `tu${i}`, 'r'.repeat(1000 + i * 37)));
    lines.push(asst({ ts: t, req: `s${i}`, usage: [i, i, i, i], skill: i % 3 ? undefined : 'image-gen' }));
  }
  const full = lines.join('\n') + '\n';

  it('a file read in several chunks yields the same summary as a full parse', async () => {
    // Cut inside a group of records of one requestId and in the middle of a line.
    const cut1 = full.indexOf(`"requestId":"r7"`) + 5;
    const cut2 = Math.floor(full.length * 0.7);
    fs.writeFileSync(file, full.slice(0, cut1));
    const a = await scanFile(projectsDir, file, null, opts);
    fs.appendFileSync(file, full.slice(cut1, cut2));
    const b = await scanFile(projectsDir, file, a!.summary, opts);
    expect(b!.resumed).toBe(true);
    fs.appendFileSync(file, full.slice(cut2));
    const c = await scanFile(projectsDir, file, b!.summary, opts);
    const fresh = await scanFile(projectsDir, file, null, opts);
    const norm = (s: FileSummary) => ({ ...s, mtimeMs: 0 });
    expect(norm(c!.summary)).toEqual(norm(fresh!.summary));
    expect(fresh!.summary.turns).toBe(80);
    expect(fresh!.summary.offset).toBe(Buffer.byteLength(full));
  });

  it('readLines skips api-request-blob without parsing and leaves an incomplete tail', async () => {
    const f = path.join(tmp, 'lines.jsonl');
    fs.writeFileSync(f, `${blob(6_000_000)}\n{"type":"ai-title","aiTitle":"ü"}\n{"type":"ai-ti`);
    const got: string[] = [];
    const skipped: number[] = [];
    const off = await readLines(f, 0, { line: (b) => got.push(b.toString()), skipped: (_k, n) => skipped.push(n) });
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toBeGreaterThan(6_000_000);
    expect(got).toEqual(['{"type":"ai-title","aiTitle":"ü"}']);
    expect(off).toBe(fs.statSync(f).size - '{"type":"ai-ti'.length);
  });
});

describe('subagent parent links', () => {
  it('the parent is the agent whose transcript has a tool_use with id = meta.toolUseId', () => {
    const t = iso(2026, 11, 10, 12);
    const main = scanText('/m.jsonl', mainId, [
      asst({ ts: t, req: 'm1', blocks: [{ type: 'tool_use', id: 'agentCall1', name: 'Agent', input: { subagent_type: 'Explore', description: 'find it' } }], stop: 'tool_use' }),
    ].join('\n'), opts);
    const sub1 = scanText('/s1.jsonl', { sessionId: SID, agentId: 'aaa', projectDir: '-tmp-proj' }, [
      asst({ ts: t, req: 's1', blocks: [{ type: 'tool_use', id: 'agentCall2', name: 'Agent', input: { subagent_type: 'Plan' } }], stop: 'tool_use' }),
    ].join('\n'), opts);
    sub1.meta = { agentType: 'Explore', description: 'find it', spawnDepth: 1, toolUseId: 'agentCall1', finished: null, workflow: null, worktreePath: null };
    const sub2 = scanText('/s2.jsonl', { sessionId: SID, agentId: 'bbb', projectDir: '-tmp-proj' }, [asst({ ts: t, req: 's2', stop: 'end_turn' })].join('\n'), opts);
    sub2.meta = { agentType: 'Plan', description: null, spawnDepth: 2, toolUseId: 'agentCall2', finished: true, workflow: null, worktreePath: null };
    const now = Date.parse(t) + 5_000;
    const full = buildTree(main, [sub2, sub1], now, true, true);
    expect(full.root.children.map((c) => c.id)).toEqual(['aaa']);
    expect(full.root.children[0].children.map((c) => c.id)).toEqual(['bbb']);
    expect(full.root.children[0].children[0]).toMatchObject({ depth: 2, status: 'done', type: 'Plan' });
    expect(full.root.children[0].finishedChildren).toBe(1);
    expect(full.root.children[0].status).toBe('working');
    // Live view: active children only.
    const live = buildTree(main, [sub2, sub1], now, true, false);
    expect(live.root.children[0].children).toEqual([]);
    expect(live.active).toBe(1);
  });
});

describe('automation signals', () => {
  const id = { sessionId: 's', agentId: null, projectDir: 'p' };
  const user = (extra: object) => JSON.stringify({ type: 'user', timestamp: '2026-11-10T12:00:00Z', message: { role: 'user', content: 'go' }, ...extra });
  it('records the first entrypoint and the first prompt origin', () => {
    const s = scanText('/x.jsonl', id, [
      JSON.stringify({ type: 'attachment', entrypoint: 'sdk-cli', timestamp: '2026-11-10T11:59:59Z', attachment: { type: 'hook_success' } }),
      user({ entrypoint: 'sdk-cli', promptSource: 'sdk', turnOrigin: 'sdk' }),
      user({ entrypoint: 'cli', turnOrigin: 'human' }),
    ].join('\n'), { knownPlugins: [] });
    expect(s.entrypoint).toBe('sdk-cli');
    expect(s.promptOrigin).toBe('sdk');
  });
  it('an interactive transcript', () => {
    const s = scanText('/x.jsonl', id, user({ entrypoint: 'cli', promptSource: 'typed', origin: { kind: 'human' } }), { knownPlugins: [] });
    expect(s).toMatchObject({ entrypoint: 'cli', promptOrigin: 'typed' });
    expect(scanText('/y.jsonl', id, user({}), { knownPlugins: [] })).toMatchObject({ entrypoint: null, promptOrigin: '' });
  });
});
