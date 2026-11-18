// Demo "what did this agent change?": deterministic, consistent and alive.
import { describe, expect, it } from 'vitest';
import { demoAgentTypes, demoSessions } from './demo-sessions';
import { mockAgentChanges } from './changes';
import { mockResolve } from './index';

const SID = '1234abcd-0000-1111-2222-333344445555';
const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);
demoSessions.set(SID, { project: 'billing-service', title: () => 'demo', model: 'claude-opus-5-5', effort: 'high', alive: true });
demoAgentTypes.set('aexplore01', 'Explore');
demoAgentTypes.set('agp000001', 'general-purpose');

describe('mockAgentChanges', () => {
  it('is deterministic for the same ids and time', () => {
    expect(mockAgentChanges(SID, 'main', NOW)).toEqual(mockAgentChanges(SID, 'main', NOW));
  });

  it('has believable files with consistent totals', () => {
    for (const id of ['main', 'agp000001']) {
      const c = mockAgentChanges(SID, id, NOW);
      expect(c.cwd).toBe('/home/dev/code/billing-service');
      const ok = c.files.filter((f) => f.edits > 0);
      expect(ok.length).toBeGreaterThanOrEqual(2);
      expect(c.totals.files).toBe(ok.length);
      expect(c.totals.added).toBe(ok.reduce((n, f) => n + f.added, 0));
      expect(c.totals.removed).toBe(ok.reduce((n, f) => n + f.removed, 0));
      // Successful files first, newest first; every one has a preview.
      for (let i = 1; i < ok.length; i++) expect(ok[i - 1].lastTs).toBeGreaterThanOrEqual(ok[i].lastTs);
      for (const f of ok) {
        expect(f.hunks.length).toBeGreaterThan(0);
        expect(f.hunks.every((h) => h.lines.every((l) => /^[ +-]/.test(l)))).toBe(true);
        expect(f.path.startsWith('/')).toBe(false);
      }
      expect(c.files.slice(ok.length).every((f) => f.edits === 0 && f.failed > 0)).toBe(true);
    }
  });

  it('read-only agent types only read', () => {
    const c = mockAgentChanges(SID, 'aexplore01', NOW);
    expect(c.files).toEqual([]);
    expect(c.reads.length).toBeGreaterThan(0);
    expect(c.steps.some((s) => s.tool === 'Edit' || s.tool === 'Write')).toBe(false);
  });

  it('steps are ordered, capped and slide forward with time', () => {
    const a = mockAgentChanges(SID, 'main', NOW);
    expect(a.steps.length).toBeGreaterThan(50);
    expect(a.steps.length).toBeLessThanOrEqual(200);
    expect(a.stepsTotal).toBeGreaterThanOrEqual(a.steps.length);
    for (let i = 1; i < a.steps.length; i++) expect(a.steps[i].ts).toBeGreaterThanOrEqual(a.steps[i - 1].ts);
    expect(a.steps.every((s) => s.ts <= NOW)).toBe(true);
    expect(a.steps.some((s) => s.kind === 'text')).toBe(true);
    expect(a.steps.some((s) => s.status === 'error')).toBe(true);
    const later = mockAgentChanges(SID, 'main', NOW + 30_000);
    expect(later.steps[later.steps.length - 1].ts).toBeGreaterThan(a.steps[a.steps.length - 1].ts);
  });

  it('asleep sessions stay frozen; the session view merges agents', () => {
    const SLEEP = '9999abcd-0000-1111-2222-333344445555';
    demoSessions.set(SLEEP, { project: 'mobile-api', title: () => 'demo', model: null, effort: null, alive: false });
    expect(mockAgentChanges(SLEEP, 'main', NOW).steps).toEqual(mockAgentChanges(SLEEP, 'main', NOW + 60_000).steps);
    const all = mockAgentChanges(SLEEP, 'all', NOW);
    expect(all.steps).toEqual([]);
    expect(all.files.filter((f) => f.edits > 0).every((f) => f.agents && f.agents.length > 0)).toBe(true);
  });

  it('is served by the demo API', () => {
    const c = mockResolve(`/api/session/${SID}/agent/main/changes?lang=en`) as ReturnType<typeof mockAgentChanges>;
    expect(c.agentId).toBe('main');
    expect(c.sessionId).toBe(SID);
  });
});
