// Session replay parsing on synthetic transcripts: main + subagents linked by meta.toolUseId, waits, compaction,
// archived summaries, capping.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReplayEvent, SessionReplay } from '../../shared/api.ts';
import { replaySession, replayStateAt, replayTree } from '../../shared/replay';
import { buildReplay } from '../replay';
import { scanFile } from '../scanner';
import type { FileSummary } from '../types';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-replay-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const projects = path.join(tmp, 'projects');
const SID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const dir = path.join(projects, '-tmp-proj');
const subDir = path.join(dir, SID, 'subagents');

const T0 = Date.UTC(2026, 10, 18, 9, 0);
const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();
let req = 0;
const usage = (n: number) => ({ input_tokens: n, output_tokens: n, cache_read_input_tokens: n * 10, cache_creation_input_tokens: n });
function asst(sec: number, blocks: any[], stop = 'tool_use', n = 10, extra: Record<string, unknown> = {}) {
  const r = `req_${++req}`;
  return JSON.stringify({ type: 'assistant', isSidechain: false, requestId: r, timestamp: at(sec), cwd: '/tmp/proj', sessionId: SID, message: { id: 'm' + r, model: 'claude-opus-5-5', role: 'assistant', content: blocks, stop_reason: stop, usage: usage(n) }, ...extra });
}
function result(sec: number, id: string, permission?: Record<string, unknown>) {
  const rec: Record<string, unknown> = { parentUuid: null, isSidechain: false, type: 'user', message: { role: 'user', content: [{ tool_use_id: id, type: 'tool_result', content: 'ok '.repeat(2000) }] }, uuid: 'u' + id, timestamp: at(sec), toolUseResult: { stdout: 'ok '.repeat(2000), timestamp: 'nested' } };
  if (permission) rec.permissionDecision = permission;
  return JSON.stringify(rec);
}
const prompt = (sec: number, text: string) => JSON.stringify({ type: 'user', isSidechain: false, message: { role: 'user', content: text }, timestamp: at(sec), cwd: '/tmp/proj', sessionId: SID, permissionMode: 'default' });
const tu = (id: string, name: string, input: Record<string, unknown>) => ({ type: 'tool_use', id, name, input });

function write(file: string, lines: string[]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

let files: FileSummary[] = [];
async function scanAll(): Promise<FileSummary[]> {
  const out: FileSummary[] = [];
  const all = [path.join(dir, `${SID}.jsonl`), ...fs.readdirSync(subDir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(subDir, f))];
  for (const f of all) out.push((await scanFile(projects, f, null, { knownPlugins: [] }))!.summary);
  return out;
}

beforeAll(async () => {
  // Main: a prompt, a Read, an Agent call (Plan), a Bash that the user had to approve (12 s), a compaction,
  // a question to the user, an Edit with a config decision (no wait), the answer.
  write(path.join(dir, `${SID}.jsonl`), [
    prompt(0, 'Add rate limiting to the webhook'),
    asst(2, [{ type: 'text', text: 'Looking at the handler first.' }, tu('t1', 'Read', { file_path: '/tmp/proj/src/webhook.ts' })], 'tool_use', 100),
    result(3, 't1', { decision: 'accept', source: 'config' }),
    asst(5, [tu('ag1', 'Agent', { subagent_type: 'Plan', description: 'Plan the limiter' })], 'tool_use', 120),
    result(60, 'ag1'),
    asst(62, [tu('t2', 'Bash', { command: 'pnpm add hono-rate-limiter' })], 'tool_use', 130),
    result(74, 't2', { decision: 'accept', source: 'user_temporary', grantScope: 'once' }),
    JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(80), compactMetadata: { trigger: 'auto', preTokens: 170000 } }),
    asst(82, [tu('t3', 'AskUserQuestion', { questions: [] })], 'tool_use', 40),
    result(95, 't3'),
    asst(96, [tu('t4', 'Edit', { file_path: '/tmp/proj/src/webhook.ts' })], 'tool_use', 50),
    result(97, 't4', { decision: 'accept', source: 'config', reasonType: 'mode' }),
    asst(99, [{ type: 'text', text: 'Done: the webhook is rate limited.' }], 'end_turn', 60),
  ]);
  // Plan (spawned by main via ag1) spawns Explore (via ag2) and finishes after it.
  write(path.join(subDir, 'agent-p1.jsonl'), [
    asst(6, [tu('p-t1', 'Grep', { pattern: 'rateLimit' })], 'tool_use', 20),
    result(7, 'p-t1'),
    asst(10, [tu('ag2', 'Agent', { subagent_type: 'Explore', description: 'Find the middleware' })], 'tool_use', 20),
    result(40, 'ag2'),
    asst(58, [{ type: 'text', text: 'Plan ready.' }], 'end_turn', 20),
  ]);
  fs.writeFileSync(path.join(subDir, 'agent-p1.meta.json'), JSON.stringify({ agentType: 'Plan', description: 'Plan the limiter', toolUseId: 'ag1', spawnDepth: 1 }));
  write(path.join(subDir, 'agent-e1.jsonl'), [
    asst(12, [tu('e-t1', 'Glob', { pattern: 'src/**/*.ts' })], 'tool_use', 5),
    result(13, 'e-t1'),
    asst(38, [{ type: 'text', text: 'Found it in src/middleware.' }], 'end_turn', 5),
  ]);
  fs.writeFileSync(path.join(subDir, 'agent-e1.meta.json'), JSON.stringify({ agentType: 'Explore', description: 'Find the middleware', toolUseId: 'ag2', spawnDepth: 2 }));
  files = await scanAll();
});

const meta = { sessionId: SID, project: 'proj', cwd: '/tmp/proj', title: 'Rate limit', model: 'claude-opus-5-5', effort: 'high' };
const kinds = (r: SessionReplay, k: ReplayEvent['kind']) => r.events.filter((e) => e.kind === k);
const sec = (ts: number) => (ts - T0) / 1000;

describe('buildReplay', () => {
  it('links subagents to their parents through meta.toolUseId and orders the events', async () => {
    const r = await buildReplay(files, meta, { alive: false, lang: 'en', now: T0 + 3_600_000 });
    expect(r.startedAt).toBe(T0);
    expect(r.endedAt).toBe(T0 + 99_000);
    const spawns = kinds(r, 'spawn') as Extract<ReplayEvent, { kind: 'spawn' }>[];
    expect(spawns.map((s) => [s.agentId, s.parentId, s.agentType, sec(s.ts)])).toEqual([['p1', 'main', 'Plan', 5], ['e1', 'p1', 'Explore', 10]]);
    expect(spawns[0].description).toBe('Plan the limiter');
    const fin = kinds(r, 'finish') as Extract<ReplayEvent, { kind: 'finish' }>[];
    expect(fin.map((f) => [f.agentId, sec(f.ts)])).toEqual([['e1', 38], ['p1', 58]]);
    expect(fin[0].tokens).toBe(2 * (5 + 5 + 50 + 5));
    // Agent calls are spawns, not tool lines; every other call is a tool line of its agent.
    expect((kinds(r, 'tool') as Extract<ReplayEvent, { kind: 'tool' }>[]).map((t) => `${t.agentId}:${t.label}`)).toEqual([
      'main:Read webhook.ts', 'p1:Grep "rateLimit"', 'e1:Glob src/**/*.ts', 'main:Bash: pnpm add hono-rate-limiter', 'main:AskUserQuestion', 'main:Edit webhook.ts',
    ]);
    for (let i = 1; i < r.events.length; i++) expect(r.events[i].ts).toBeGreaterThanOrEqual(r.events[i - 1].ts);
  });

  it('prompts, compactions, texts and per-turn tokens with the main context', async () => {
    const r = await buildReplay(files, meta, { alive: false, lang: 'en', now: T0 + 3_600_000 });
    expect(kinds(r, 'prompt')).toEqual([{ kind: 'prompt', ts: T0, text: 'Add rate limiting to the webhook' }]);
    expect(kinds(r, 'compact')).toEqual([{ kind: 'compact', ts: T0 + 80_000, auto: true, preTokens: 170000 }]);
    expect(kinds(r, 'text').map((e) => (e as { text: string }).text)).toContain('Plan ready.');
    const mainTok = kinds(r, 'tokens').filter((e) => (e as { agentId: string }).agentId === 'main') as Extract<ReplayEvent, { kind: 'tokens' }>[];
    expect(mainTok).toHaveLength(6);
    expect(mainTok[0].context).toBe(100 + 1000 + 100);
    expect(kinds(r, 'tokens').filter((e) => (e as { agentId: string }).agentId === 'e1')).toHaveLength(2);
  });

  it('waits: a user-approved permission and a question to the user; config decisions are not waits', async () => {
    const r = await buildReplay(files, meta, { alive: false, lang: 'en', now: T0 + 3_600_000 });
    const st = (kinds(r, 'status') as Extract<ReplayEvent, { kind: 'status' }>[]).map((s) => `${sec(s.ts)}:${s.status}:${s.code}${s.arg ? ':' + s.arg : ''}`);
    expect(st).toEqual([
      '0:working:gotPrompt',
      '62:waiting:waitingPermission:Bash',
      '74:working:working',
      '82:waiting:waitingInput',
      '95:working:working',
      '99:idle:answerReady',
    ]);
    const wait = kinds(r, 'status').find((e) => (e as { status: string }).status === 'waiting') as Extract<ReplayEvent, { kind: 'status' }>;
    expect(wait.reason).toBe('Waiting for permission: Bash');
    const uk = await buildReplay(files, meta, { alive: false, lang: 'uk', now: T0 + 3_600_000 });
    expect((kinds(uk, 'status')[1] as { reason: string }).reason).toBe('Чекає дозволу: Bash');
  });

  it('the shared model replays it: nesting mid-way, a parent outliving its child, the end state', async () => {
    const r = await buildReplay(files, meta, { alive: false, lang: 'en', now: T0 + 3_600_000 });
    const tree = (s: number) => {
      const out: string[] = [];
      const w = (n: { id: string; depth: number; children: any[] }) => { out.push(`${n.depth}:${n.id}`); n.children.forEach(w); };
      w(replayTree(replayStateAt(r, T0 + s * 1000)));
      return out.join(' ');
    };
    expect(tree(4)).toBe('0:main');
    expect(tree(20)).toBe('0:main 1:p1 2:e1');
    expect(tree(45)).toBe('0:main 1:p1');
    expect(tree(70)).toBe('0:main');
    const end = replaySession(replayStateAt(r, r.endedAt), r);
    expect(end.subagentsTotal).toBe(2);
    expect(end.compactions).toBe(1);
    expect(end.status).toBe('idle');
    expect(end.contextLimit).toBe(200_000);
  });

  it('older transcripts without decisions: the 10-second heuristic, dropped while another agent is busy', async () => {
    const lone = path.join(tmp, 'old', '-tmp-old', 'bbbbbbbb-0000-0000-0000-000000000000.jsonl');
    write(lone, [
      prompt(0, 'go'),
      asst(1, [tu('x1', 'Bash', { command: 'make deploy' })], 'tool_use'),
      result(40, 'x1'),
      asst(41, [{ type: 'text', text: 'ok' }], 'end_turn'),
    ]);
    const s = (await scanFile(path.join(tmp, 'old'), lone, null, { knownPlugins: [] }))!.summary;
    const r = await buildReplay([s], { ...meta, sessionId: s.sessionId }, { alive: false, lang: 'en', now: T0 + 3_600_000 });
    const st = (kinds(r, 'status') as Extract<ReplayEvent, { kind: 'status' }>[]).map((x) => `${sec(x.ts)}:${x.status}:${x.code}`);
    expect(st).toEqual(['0:working:gotPrompt', '11:waiting:probablyPermission', '40:working:working', '41:idle:answerReady']);
  });

  it('a live session ends now; an open call keeps it waiting', async () => {
    const liveFile = path.join(tmp, 'live', '-tmp-live', 'cccccccc-0000-0000-0000-000000000000.jsonl');
    write(liveFile, [prompt(0, 'go'), asst(1, [tu('y1', 'AskUserQuestion', {})], 'tool_use')]);
    const s = (await scanFile(path.join(tmp, 'live'), liveFile, null, { knownPlugins: [] }))!.summary;
    const now = T0 + 120_000;
    const r = await buildReplay([s], { ...meta, sessionId: s.sessionId }, { alive: true, lang: 'en', now });
    expect(r.live).toBe(true);
    expect(r.endedAt).toBe(now);
    expect(replayStateAt(r, now).status).toBe('waiting');
  });

  it('archived transcripts: structure and hourly tokens from the summaries', async () => {
    const r = await buildReplay(files, meta, { alive: false, lang: 'en', now: T0 + 3_600_000, isMissing: () => true });
    expect(r.archived).toBe(true);
    expect(kinds(r, 'spawn')).toHaveLength(2);
    expect(kinds(r, 'finish')).toHaveLength(2);
    expect(kinds(r, 'tool')).toHaveLength(0);
    const total = kinds(r, 'tokens').reduce((a, e) => a + (e as Extract<ReplayEvent, { kind: 'tokens' }>).t.reduce((x, y) => x + y, 0), 0);
    const expected = files.reduce((a, f) => a + f.total.reduce((x, y) => x + y, 0), 0);
    expect(total).toBe(expected);
    expect(replayStateAt(r, r.endedAt).status).toBe('idle');
  });

  it('caps huge sessions, keeping structure', async () => {
    const r = await buildReplay(files, meta, { alive: false, lang: 'en', now: T0 + 3_600_000, max: 12 });
    expect(r.sampled).toBeDefined();
    expect(kinds(r, 'spawn')).toHaveLength(2);
    expect(kinds(r, 'finish')).toHaveLength(2);
    expect(kinds(r, 'prompt')).toHaveLength(1);
  });
});
