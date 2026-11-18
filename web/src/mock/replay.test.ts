// The demo replay: a believable, deterministic 20–40 minute run with nested agents, a wait and a compaction.
import { describe, expect, it } from 'vitest';
import { extractMarkers, replayStateAt, replayTree } from '@shared/replay';
import type { AgentNode } from '@shared/api';
import { mockReplay } from './replay';

const depth = (n: AgentNode): number => Math.max(n.depth, ...n.children.map(depth));

describe('mockReplay', () => {
  for (const id of ['11111111-aaaa-bbbb-cccc-000000000001', 'demo-xyz-12345678', 'ffffffff-0000-0000-0000-00000000beef']) {
    it(`is believable and deterministic (${id.slice(0, 8)})`, () => {
      const r = mockReplay(id);
      const min = (r.endedAt - r.startedAt) / 60_000;
      expect(min).toBeGreaterThan(20);
      expect(min).toBeLessThan(42);
      for (let i = 1; i < r.events.length; i++) expect(r.events[i].ts).toBeGreaterThanOrEqual(r.events[i - 1].ts);
      const kinds = new Set(extractMarkers(r.events).map((m) => m.kind));
      expect([...kinds].sort()).toEqual(['compact', 'prompt', 'spawn', 'wait']);
      // nested agents at some point, and nothing left running at the end
      let deepest = 0;
      for (let t = r.startedAt; t <= r.endedAt; t += 15_000) deepest = Math.max(deepest, depth(replayTree(replayStateAt(r, t))));
      expect(deepest).toBeGreaterThanOrEqual(2);
      const end = replayStateAt(r, r.endedAt);
      expect(end.subagentsActive).toBe(0);
      expect(end.status).toBe('idle');
      const again = mockReplay(id);
      expect(again.events.map((e) => [e.kind, e.ts - again.startedAt])).toEqual(r.events.map((e) => [e.kind, e.ts - r.startedAt]));
    });
  }
});
