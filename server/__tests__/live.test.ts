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
  it('tool_use without a result for > 10 s: probably waiting for permission', () => {
    const s = scanText('/m', id, rec(t0, [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'rm -rf build' } }], 'tool_use', 'r1'), { knownPlugins: [] });
    const tree = buildTree(s, [], t0 + 30_000, true, false);
    const st = sessionStatus(s, [], tree, t0 + 30_000, true, 'busy');
    expect(st).toEqual({ status: 'waiting', reason: { k: 'probablyPermission', a: 'Bash' } });
    expect(reasonText(st.reason, 'en')).toBe('Probably waiting for permission: Bash');
    expect(reasonText(st.reason, 'uk')).toBe('Ймовірно, чекає дозволу: Bash');
    expect(sessionStatus(s, [], tree, t0 + 5_000, true, 'busy').status).toBe('working');
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
