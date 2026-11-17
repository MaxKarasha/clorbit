// The console's in-memory event history.
import { describe, expect, it } from 'vitest';
import { RecentEvents } from '../recent-events';

describe('RecentEvents', () => {
  it('keeps console-worthy events with their names, newest last, capped', () => {
    const r = new RecentEvents(3);
    r.push({ kind: 'text', ts: 1, sessionId: 's', agentId: 'main', text: 'hi' }, {});
    r.push({ kind: 'status', ts: 2, sessionId: 's', status: 'working', reason: null }, {});
    r.push({ kind: 'status', ts: 3, sessionId: 's', status: 'waiting', reason: { k: 'waitingPermission', a: 'Bash' } }, { project: 'billing' });
    for (let i = 0; i < 3; i++) r.push({ kind: 'tool', ts: 10 + i, sessionId: 's', agentId: 'a1', tool: 'Read', label: `Read f${i}` }, { project: 'billing', agentName: 'Explore' });
    expect(r.size).toBe(3);
    const l = r.list('uk', 10);
    expect(l.map((e) => e.ts)).toEqual([10, 11, 12]);
    expect(l[2]).toMatchObject({ kind: 'tool', project: 'billing', agentName: 'Explore', label: 'Read f2' });
    expect(r.list('en', 1).map((e) => e.ts)).toEqual([12]);
  });

  it('localizes waiting reasons per request', () => {
    const r = new RecentEvents();
    r.push({ kind: 'status', ts: 3, sessionId: 's', status: 'waiting', reason: { k: 'waitingPermission', a: 'Bash' } }, { project: 'billing' });
    expect(r.list('en')[0]).toMatchObject({ reason: 'Waiting for permission: Bash', code: 'waitingPermission', arg: 'Bash', project: 'billing' });
    expect(r.list('uk')[0]).toMatchObject({ reason: 'Чекає дозволу: Bash' });
  });
});
