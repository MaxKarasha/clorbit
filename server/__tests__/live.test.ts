// Tests for tool labels, status heuristics and hook intake.
import { describe, expect, it } from 'vitest';
import { Hooks } from '../hooks';
import { localizeEvent, reasonText } from '../i18n';
import { tokensSince } from '../live';
import { scanText } from '../scanner';
import { buildTree, sessionStatus } from '../tree';
import { toolLabel } from '../util';

const id = { sessionId: 's', agentId: null, projectDir: 'p' };
const rec = (ts: number, blocks: any[], stop: string, req: string) => JSON.stringify({
  type: 'assistant', isSidechain: false, requestId: req, timestamp: new Date(ts).toISOString(),
  message: { model: 'claude-opus-5-5', content: blocks, stop_reason: stop, usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 1, cache_creation_input_tokens: 1 } },
});

describe('tool labels', () => {
  it('short human labels', () => {
    expect(toolLabel('Read', { file_path: '/a/b/index.ts' })).toBe('Read index.ts');
    expect(toolLabel('Grep', { pattern: 'useAuth' })).toBe('Grep "useAuth"');
    expect(toolLabel('Bash', { command: 'pnpm test --run && echo ok\nsecond line' })).toBe('Bash: pnpm test --run && echo ok');
    expect(toolLabel('Agent', { subagent_type: 'Explore' })).toBe('Agent → Explore');
    expect(toolLabel('mcp__claude-in-chrome__navigate', {})).toBe('claude-in-chrome · navigate');
  });
});

describe('session status without hooks', () => {
  const t0 = Date.parse('2026-11-10T12:00:00Z');
  const longBash = () => scanText('/m', id, rec(t0, [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'pnpm test' } }], 'tool_use', 'r1'), { knownPlugins: [] });
  it('no status from Claude Code (older versions): a tool_use without a result for > 10 s is probably waiting', () => {
    const s = longBash();
    const tree = buildTree(s, [], t0 + 30_000, true, false);
    const st = sessionStatus(s, [], tree, t0 + 30_000, true, null);
    expect(st).toEqual({ status: 'waiting', reason: { k: 'probablyPermission', a: 'Bash' } });
    expect(reasonText(st.reason, 'en')).toBe('Probably waiting for permission: Bash');
    expect(reasonText(st.reason, 'uk')).toBe('Ймовірно, чекає дозволу: Bash');
    expect(sessionStatus(s, [], tree, t0 + 5_000, true, null).status).toBe('working');
  });
  it('Claude Code says busy: a long-running tool is working, not waiting (session and agent)', () => {
    const s = longBash();
    const tree = buildTree(s, [], t0 + 120_000, true, false, 'busy');
    expect(sessionStatus(s, [], tree, t0 + 120_000, true, 'busy')).toEqual({ status: 'working', reason: { k: 'running', a: 'Bash: pnpm test' } });
    expect(tree.root.status).toBe('working');
  });
  it('a subagent with a long call is working while Claude Code says busy', () => {
    const main = scanText('/m', id, rec(t0, [{ type: 'tool_use', id: 'a1', name: 'Agent', input: { subagent_type: 'x' } }], 'tool_use', 'r0'), { knownPlugins: [] });
    const sub = scanText('/s', { sessionId: 's', agentId: 'x1', projectDir: 'p' }, rec(t0 + 1000, [{ type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'pnpm build' } }], 'tool_use', 'r2'), { knownPlugins: [] });
    const busy = buildTree(main, [sub], t0 + 60_000, true, false, 'busy');
    expect(busy.root.children[0].status).toBe('working');
    expect(sessionStatus(main, [sub], busy, t0 + 60_000, true, 'busy').status).toBe('working');
    // The same picture while Claude Code shows a dialog: the subagent's call is what waits.
    const waiting = buildTree(main, [sub], t0 + 60_000, true, false, 'waiting');
    expect(waiting.root.children[0].status).toBe('waiting');
    expect(sessionStatus(main, [sub], waiting, t0 + 60_000, true, 'waiting', 'dialog open')).toEqual({ status: 'waiting', reason: { k: 'waitingPermission', a: 'Bash' } });
  });
  it('Claude Code says waiting: trust it right away, with its reason', () => {
    const s = longBash();
    const tree = buildTree(s, [], t0 + 2_000, true, false, 'waiting');
    expect(sessionStatus(s, [], tree, t0 + 2_000, true, 'waiting', 'dialog open')).toEqual({ status: 'waiting', reason: { k: 'waitingPermission', a: 'Bash' } });
    expect(tree.root.status).toBe('waiting');
    const done = scanText('/m', id, rec(t0, [{ type: 'text', text: 'Which one?' }], 'end_turn', 'r1'), { knownPlugins: [] });
    const t2 = buildTree(done, [], t0 + 2_000, true, false, 'waiting');
    expect(sessionStatus(done, [], t2, t0 + 2_000, true, 'waiting', 'input needed')).toEqual({ status: 'waiting', reason: { k: 'waitingInput' } });
    expect(sessionStatus(done, [], t2, t0 + 2_000, true, 'waiting', 'goal proposal')).toEqual({ status: 'waiting', reason: { k: 'waitingFor', a: 'goal proposal' } });
    expect(reasonText({ k: 'waitingFor', a: 'goal proposal' }, 'uk')).toBe('Чекає на тебе: goal proposal');
  });
  it('end_turn: answer ready; no process: stopped', () => {
    const s = scanText('/m', id, rec(t0, [{ type: 'text', text: 'Done' }], 'end_turn', 'r1'), { knownPlugins: [] });
    const tree = buildTree(s, [], t0 + 60_000, true, false);
    expect(sessionStatus(s, [], tree, t0 + 60_000, true, 'idle')).toEqual({ status: 'idle', reason: { k: 'answerReady' } });
    expect(sessionStatus(s, [], tree, t0 + 60_000, false, null).status).toBe('stopped');
  });
});

describe('tokens over 24 h', () => {
  it('takes only hours that overlap the window', () => {
    const now = new Date(2026, 10, 11, 12, 30).getTime();
    const old = new Date(2026, 10, 10, 11, 10).getTime(); // outside the window
    const fresh = new Date(2026, 10, 10, 12, 50).getTime(); // this hour crosses the boundary
    const s = scanText('/m', id, [rec(old, [], 'end_turn', 'a'), rec(fresh, [], 'end_turn', 'b')].join('\n'), { knownPlugins: [] });
    expect(tokensSince(s, now - 24 * 3_600_000, [0, 0, 0, 0])).toEqual([1, 1, 1, 1]);
  });
});

describe('hooks', () => {
  it('turns hook events into events and flips hooksInstalled', () => {
    const h = new Hooks();
    expect(h.installed).toBe(false);
    const ev = h.ingest({ hook_event_name: 'PreToolUse', session_id: 'x', tool_name: 'Grep', tool_input: { pattern: 'foo' } });
    expect(h.installed).toBe(true);
    expect(ev[0]).toMatchObject({ kind: 'tool', sessionId: 'x', agentId: 'main', tool: 'Grep', label: 'Grep "foo"' });
    const n = h.ingest({ hook_event_name: 'Notification', session_id: 'x', message: 'Claude needs your permission to use Bash' });
    const st = n.find((e) => e.kind === 'status')!;
    expect(localizeEvent(st, 'en')).toMatchObject({ kind: 'status', status: 'waiting', reason: 'Waiting for permission: Bash' });
    expect(localizeEvent(st, 'uk')).toMatchObject({ reason: 'Чекає дозволу: Bash' });
    expect(h.bySession.get('x')?.status).toBe('waiting');
  });
});

describe('automation signals of pre-0.2.1 summaries', () => {
  it('readHeadOrigin finds the entrypoint and the first prompt origin in the head of a transcript', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { readHeadOrigin } = await import('../live');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-head-'));
    const f = path.join(dir, 'a.jsonl');
    fs.writeFileSync(f, [
      JSON.stringify({ type: 'session-owner' }),
      JSON.stringify({ type: 'user', isMeta: true, entrypoint: 'sdk-cli', promptSource: 'system' }),
      JSON.stringify({ type: 'user', entrypoint: 'sdk-cli', promptSource: 'sdk', turnOrigin: 'sdk' }),
    ].join('\n'));
    expect(readHeadOrigin(f)).toEqual({ entrypoint: 'sdk-cli', promptOrigin: 'sdk' });
    expect(readHeadOrigin(path.join(dir, 'missing.jsonl'))).toEqual({ entrypoint: null, promptOrigin: null });
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
