// Event console: lines from events, merging history with the live stream, filters.
import { describe, expect, it } from 'vitest';
import type { AgentNode, LiveSnapshot, RecentEvent } from '@shared/api';
import { filterLines, groupAutomated, mergeLines, NO_FILTER, projectsOf, toLine, type ConsoleLine } from './model';

const node = (id: string, type: string, children: AgentNode[] = []): AgentNode => ({
  id, type, description: null, depth: id === 'main' ? 0 : 1, status: 'working', model: null, effort: null, currentTool: null, lastText: null,
  startedAt: 0, lastActivity: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, toolCalls: 0, finishedChildren: 0, children,
});
const snap = { sessions: [{ sessionId: 's1', project: 'billing', root: node('main', 'main', [node('a1', 'Explore')]) }] } as unknown as LiveSnapshot;

describe('toLine', () => {
  it('uses the server context, then the snapshot', () => {
    const withCtx = toLine({ kind: 'tool', ts: 1, sessionId: 's9', agentId: 'x', tool: 'Read', label: 'Read a.ts', project: 'aurora', agentName: 'Plan' }, null)!;
    expect(withCtx).toMatchObject({ kind: 'tool', project: 'aurora', agentId: 'x', agentName: 'Plan', text: 'Read a.ts' });
    const fromSnap = toLine({ kind: 'tool', ts: 2, sessionId: 's1', agentId: 'a1', tool: 'Grep', label: 'Grep "x"' }, snap)!;
    expect(fromSnap).toMatchObject({ project: 'billing', agentName: 'Explore' });
    const unknown = toLine({ kind: 'tool', ts: 3, sessionId: 'abcdef1234', agentId: 'main', tool: 'Bash', label: 'Bash: ls' }, null)!;
    expect(unknown).toMatchObject({ project: 'abcdef12', agentName: null });
  });

  it('spawn keeps both agents; only waiting statuses become lines; text events are skipped', () => {
    const sp = toLine({ kind: 'spawn', ts: 1, sessionId: 's1', parentId: 'a1', agentId: 'n1', agentType: 'Plan', description: 'Plan it' }, snap)!;
    expect(sp).toMatchObject({ kind: 'spawn', agentId: 'n1', agentName: 'Plan', parentId: 'a1', parentName: 'Explore', text: 'Plan it' });
    expect(toLine({ kind: 'status', ts: 1, sessionId: 's1', status: 'working', reason: null }, snap)).toBeNull();
    expect(toLine({ kind: 'status', ts: 1, sessionId: 's1', status: 'waiting', reason: 'Waiting for permission: Bash' }, snap)).toMatchObject({ kind: 'wait', text: 'Waiting for permission: Bash' });
    expect(toLine({ kind: 'text', ts: 1, sessionId: 's1', agentId: 'main', text: 'hi' }, snap)).toBeNull();
  });
});

describe('mergeLines', () => {
  const l = (ts: number, text = `t${ts}`) => toLine({ kind: 'tool', ts, sessionId: 's1', agentId: 'main', tool: 'X', label: text, project: 'p' } as RecentEvent, null)!;
  it('deduplicates (history + live stream overlap), sorts and caps', () => {
    let cur: ConsoleLine[] = [l(5), l(6)];
    cur = mergeLines(cur, [l(1), l(5), l(7)]);
    expect(cur.map((x) => x.ts)).toEqual([1, 5, 6, 7]);
    const same = mergeLines(cur, [l(6)]);
    expect(same).toBe(cur);
    expect(mergeLines(cur, [l(8), l(9)], 3).map((x) => x.ts)).toEqual([7, 8, 9]);
  });
});

describe('filterLines', () => {
  const lines = [
    toLine({ kind: 'tool', ts: 1, sessionId: 's1', agentId: 'a1', tool: 'Read', label: 'Read invoice.ts', project: 'billing', agentName: 'Explore' }, null)!,
    toLine({ kind: 'status', ts: 2, sessionId: 's2', status: 'waiting', reason: 'Waiting for your reply', project: 'aurora' }, null)!,
    toLine({ kind: 'compact', ts: 3, sessionId: 's1', project: 'billing' }, null)!,
  ];
  it('by project, kind, text and "clear view"', () => {
    expect(filterLines(lines, NO_FILTER)).toHaveLength(3);
    expect(filterLines(lines, { ...NO_FILTER, projects: ['billing'] }).map((x) => x.ts)).toEqual([1, 3]);
    expect(filterLines(lines, { ...NO_FILTER, kinds: ['wait', 'compact'] }).map((x) => x.ts)).toEqual([2, 3]);
    expect(filterLines(lines, { ...NO_FILTER, q: 'EXPLORE' }).map((x) => x.ts)).toEqual([1]);
    expect(filterLines(lines, { ...NO_FILTER, q: 'invoice' }).map((x) => x.ts)).toEqual([1]);
    expect(filterLines(lines, { ...NO_FILTER, clearedAt: 2 }).map((x) => x.ts)).toEqual([3]);
  });
  it('lists projects, most recent first', () => {
    expect(projectsOf(lines).map((p) => p.project)).toEqual(['billing', 'aurora']);
  });
});

describe('groupAutomated', () => {
  const line = (ts: number, project: string, automated: boolean): ConsoleLine => ({
    key: `${ts}|${project}`, ts, kind: 'tool', sessionId: `${project}-s`, project, agentId: 'main', agentName: null, text: 't', ...(automated ? { automated: true } : {}),
  });
  const lines = [line(1, 'ci', true), line(2, 'web', false), line(3, 'ci', true), line(4, 'nightly', true), line(5, 'web', false), line(6, 'ci', true)];

  it('folds each project\'s automated lines into one row at its newest line', () => {
    const items = groupAutomated(lines, new Set());
    expect(items.map((i) => (i.t === 'line' ? i.line.ts : `${i.project}×${i.count}`))).toEqual([2, 'nightly×1', 5, 'ci×3']);
    const g = items[3];
    expect(g).toMatchObject({ t: 'group', key: 'auto:ci', lastTs: 6, open: false });
  });

  it('open groups carry their lines; grouping can be turned off', () => {
    const items = groupAutomated(lines, new Set(['auto:ci']));
    const g = items.find((i) => i.t === 'group' && i.project === 'ci')!;
    expect(g.t === 'group' && g.open && g.lines.map((l) => l.ts)).toEqual([1, 3, 6]);
    expect(groupAutomated(lines, new Set(), false)).toHaveLength(6);
  });

  it('toLine marks lines of automated sessions (server context or snapshot)', () => {
    expect(toLine({ kind: 'prompt', ts: 1, sessionId: 'q', project: 'ci', automated: true }, null)).toMatchObject({ automated: true });
    const s = { sessions: [{ sessionId: 'z', project: 'ci', kind: 'automated', root: node('main', 'main') }] } as unknown as LiveSnapshot;
    expect(toLine({ kind: 'prompt', ts: 1, sessionId: 'z' }, s)).toMatchObject({ project: 'ci', automated: true });
    expect(toLine({ kind: 'prompt', ts: 1, sessionId: 's1' }, snap)).not.toHaveProperty('automated');
  });
});
