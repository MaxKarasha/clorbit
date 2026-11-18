// Video export, the pure parts: the anonymizer, overlay layout and safe margins, camera fitting, the frame
// schedule and caption scheduling.
import { describe, expect, it } from 'vitest';
import type { ReplayEvent, SessionReplay } from '@shared/api';
import { normalizeReplayEvents } from '@shared/replay';
import { mockReplay } from '../../mock/replay';
import { anonymizeReplay, safeIdent, toolNameOf } from './anonymize';
import { FIT_LABEL_PX, fitSystem, GIF_MAX_WIDTH, GIF_PRESETS, inside, logicalSize, overlapsBox, overlayLayout, SAFE, safeArea, VIDEO_PRESETS, type Aspect } from './layout';
import { ALL_OVERLAYS, captionItems, captionsAt, CAPTION_GAP, CAPTION_LIFE, END_MS, exportFileName, frameSchedule, HOLD_MS, planExport, scheduleCaptions, TITLE_MS, type ExportSettings } from './plan';

const T0 = Date.UTC(2026, 10, 18, 10, 0);
const S = 1000;
const MIN = 60_000;

// ---------- anonymizer ----------

const SECRETS = [
  '/Users/alice', 'secret-project', 'Fix the billing bug for ACME', 'acme.internal', 'https://', 'webhook.ts', 'rm -rf', 'password',
  'README.md', 'src/', 'api.acme.dev', 'Find all callers of chargeCard', 'I will refactor', 'TOKEN=', 'C:\\\\Users', 'q4-roadmap.pdf',
];

function secretReplay(): SessionReplay {
  const ev: ReplayEvent[] = [
    { kind: 'prompt', ts: T0, text: 'Fix the billing bug for ACME in /Users/alice/secret-project' },
    { kind: 'status', ts: T0, status: 'working', reason: 'Got a prompt', code: 'gotPrompt', arg: null },
    { kind: 'tool', ts: T0 + 1 * S, agentId: 'main', label: 'Read webhook.ts' },
    { kind: 'tool', ts: T0 + 2 * S, agentId: 'main', label: 'Bash: rm -rf /Users/alice/secret-project/tmp && TOKEN=x' },
    { kind: 'tool', ts: T0 + 3 * S, agentId: 'main', label: 'Grep "password"' },
    { kind: 'tool', ts: T0 + 4 * S, agentId: 'main', label: 'WebFetch api.acme.dev' },
    { kind: 'tool', ts: T0 + 4 * S, agentId: 'main', label: 'WebSearch "acme.internal https://acme.internal/x"' },
    { kind: 'tool', ts: T0 + 5 * S, agentId: 'main', label: 'README.md' },
    { kind: 'tool', ts: T0 + 5 * S, agentId: 'main', label: 'src/billing/charge.ts' },
    { kind: 'tool', ts: T0 + 5 * S, agentId: 'main', label: 'C:\\\\Users\\\\alice\\\\q4-roadmap.pdf' },
    { kind: 'tool', ts: T0 + 6 * S, agentId: 'main', label: 'github · create_issue' },
    { kind: 'tool', ts: T0 + 6 * S, agentId: 'main', label: 'mcp__github__create_issue' },
    { kind: 'spawn', ts: T0 + 7 * S, agentId: 'agent-7f3a', parentId: 'main', agentType: 'Explore', description: 'Find all callers of chargeCard in src/' },
    { kind: 'spawn', ts: T0 + 7 * S, agentId: 'agent-99', parentId: 'agent-7f3a', agentType: '/Users/alice/.claude/agents/secret-project.md', description: 'q4-roadmap.pdf' },
    { kind: 'tool', ts: T0 + 8 * S, agentId: 'agent-7f3a', label: 'Agent → secret-project.reviewer' },
    { kind: 'text', ts: T0 + 9 * S, agentId: 'agent-7f3a', text: 'I will refactor chargeCard in webhook.ts' },
    { kind: 'tokens', ts: T0 + 9 * S, agentId: 'agent-7f3a', t: [1, 2, 3, 4] },
    { kind: 'status', ts: T0 + 10 * S, status: 'waiting', reason: 'Waiting for permission: Bash: rm -rf /Users/alice', code: 'waitingPermission', arg: 'Bash' },
    { kind: 'status', ts: T0 + 12 * S, status: 'waiting', reason: 'x', code: 'probablyPermission', arg: '/Users/alice/secret-project/webhook.ts' },
    { kind: 'finish', ts: T0 + 20 * S, agentId: 'agent-99', tokens: 10 },
    { kind: 'finish', ts: T0 + 21 * S, agentId: 'agent-7f3a', tokens: 100 },
  ];
  const events = normalizeReplayEvents(ev);
  return {
    sessionId: 'c0ffee00-1111-2222-3333-444455556666', project: 'secret-project', cwd: '/Users/alice/secret-project',
    title: 'Fix the billing bug for ACME', model: 'claude-opus-5-5', effort: 'high', contextLimit: 200_000,
    startedAt: T0, endedAt: T0 + 21 * S, live: false, generatedAt: T0, events,
  };
}

describe('anonymizer', () => {
  it('cuts tool labels to the tool name', () => {
    expect(toolNameOf('Read webhook.ts')).toBe('Read');
    expect(toolNameOf('Bash: rm -rf /')).toBe('Bash');
    expect(toolNameOf('Grep "password"')).toBe('Grep');
    expect(toolNameOf('WebFetch api.acme.dev')).toBe('WebFetch');
    expect(toolNameOf('Skill secret-skill')).toBe('Skill');
    expect(toolNameOf('github · create_issue')).toBe('github · create_issue');
    expect(toolNameOf('mcp__github__create_issue')).toBe('mcp__github__create_issue');
    expect(toolNameOf('Agent → Explore')).toBe('Agent → Explore');
    expect(toolNameOf('Agent → my.secret/agent')).toBe('Agent → agent');
    expect(toolNameOf('README.md')).toBe('tool');
    expect(toolNameOf('src/billing/charge.ts')).toBe('tool');
    expect(toolNameOf('/Users/alice')).toBe('tool');
    expect(toolNameOf('https://acme.dev/x')).toBe('tool');
    expect(toolNameOf('')).toBe('tool');
    expect(toolNameOf('x'.repeat(60))).toBe('tool');
  });

  it('keeps only plain identifiers as agent types', () => {
    expect(safeIdent('general-purpose', 'agent')).toBe('general-purpose');
    expect(safeIdent('plugin:code-reviewer', 'agent')).toBe('plugin:code-reviewer');
    expect(safeIdent('a/b', 'agent')).toBe('agent');
    expect(safeIdent('notes.md', 'agent')).toBe('agent');
    expect(safeIdent('two words', 'agent')).toBe('agent');
    expect(safeIdent(null, 'agent')).toBe('agent');
  });

  it('leaves nothing identifying in the replay', () => {
    const r = secretReplay();
    const a = anonymizeReplay(r);
    const json = JSON.stringify(a);
    for (const s of SECRETS) expect(json, s).not.toContain(s);
    expect(json).not.toContain('alice');
    expect(json).not.toContain('ACME');
    expect(json).not.toContain('c0ffee00');
    expect(a.project).toBe('project');
    expect(a.title).toBeNull();
    expect(a.cwd).toBe('');
    const tools = a.events.filter((e) => e.kind === 'tool').map((e) => (e as { label: string }).label);
    expect(tools).toEqual(['Read', 'Bash', 'Grep', 'WebFetch', 'WebSearch', 'tool', 'tool', 'tool', 'github · create_issue', 'mcp__github__create_issue', 'Agent → agent']);
    const spawns = a.events.filter((e) => e.kind === 'spawn') as Extract<ReplayEvent, { kind: 'spawn' }>[];
    expect(spawns.map((s) => [s.agentType, s.description])).toEqual([['Explore', null], ['agent', null]]);
    expect(spawns[1].parentId).toBe(spawns[0].agentId);
    const waits = a.events.filter((e) => e.kind === 'status' && e.status === 'waiting') as Extract<ReplayEvent, { kind: 'status' }>[];
    expect(waits.map((w) => [w.reason, w.arg, w.code])).toEqual([[null, 'Bash', 'waitingPermission'], [null, 'tool', 'probablyPermission']]);
  });

  it('keeps the timing and the structure, so the clip moves the same', () => {
    const r = secretReplay();
    const a = anonymizeReplay(r);
    expect(a.events.map((e) => [e.kind, e.ts])).toEqual(r.events.map((e) => [e.kind, e.ts]));
    expect([a.startedAt, a.endedAt, a.model, a.effort]).toEqual([r.startedAt, r.endedAt, r.model, r.effort]);
    const tok = a.events.find((e) => e.kind === 'tokens') as Extract<ReplayEvent, { kind: 'tokens' }>;
    expect(tok.t).toEqual([1, 2, 3, 4]);
  });

  it('cleans a demo replay too (captions only see tool-free types)', () => {
    const a = anonymizeReplay(mockReplay('11111111-aaaa-bbbb-cccc-000000000001'));
    const items = captionItems(a, a.startedAt, a.endedAt);
    for (const it of items) expect(it.agentType === '' || /^[A-Za-z][\w:-]*$/.test(it.agentType)).toBe(true);
    for (const e of a.events) {
      if (e.kind === 'tool') expect(e.label).not.toMatch(/[./"]/);
      if (e.kind === 'text' || e.kind === 'prompt') expect(e.text).toBe('');
    }
  });
});

// ---------- layout ----------

const ALL_SIZES = [...VIDEO_PRESETS, ...GIF_PRESETS];

describe('overlay layout and safe margins', () => {
  it('logical canvas: short side at most 600, same aspect, scale up to the output', () => {
    for (const p of ALL_SIZES) {
      const { w, h, scale } = logicalSize(p.width, p.height);
      expect(Math.min(w, h)).toBeLessThanOrEqual(600 + 1e-9);
      expect(w * scale).toBeCloseTo(p.width, 6);
      expect(h * scale).toBeCloseTo(p.height, 6);
      expect(scale).toBeGreaterThanOrEqual(1);
    }
    for (const p of VIDEO_PRESETS) { expect(p.width % 2).toBe(0); expect(p.height % 2).toBe(0); }
    for (const p of GIF_PRESETS) expect(p.width).toBeLessThanOrEqual(GIF_MAX_WIDTH);
  });

  it('every preset has the aspect it claims', () => {
    const ratio: Record<Aspect, number> = { '16:9': 16 / 9, '1:1': 1, '9:16': 9 / 16 };
    for (const p of ALL_SIZES) expect(Math.abs(p.width / p.height - ratio[p.aspect])).toBeLessThan(0.01);
  });

  for (const p of ALL_SIZES) {
    it(`${p.aspect} ${p.width}×${p.height}: overlays inside the safe area, apart, the system in between`, () => {
      const { w, h } = logicalSize(p.width, p.height);
      const L = overlayLayout(w, h, p.aspect);
      const m = SAFE[p.aspect];
      expect(L.safe.x).toBeCloseTo(w * m.x, 6);
      expect(L.safe.y).toBeCloseTo(h * m.top, 6);
      expect(h - (L.safe.y + L.safe.h)).toBeCloseTo(h * m.bottom, 6);
      for (const k of ['clock', 'counters', 'captions', 'system', 'card'] as const) expect(inside(L[k], L.safe), k).toBe(true);
      expect(overlapsBox(L.clock, L.counters)).toBe(false);
      expect(overlapsBox(L.clock, L.captions)).toBe(false);
      expect(overlapsBox(L.counters, L.captions)).toBe(false);
      expect(overlapsBox(L.system, L.clock)).toBe(false);
      expect(overlapsBox(L.system, L.counters)).toBe(false);
      if (p.aspect === '9:16') expect(overlapsBox(L.system, L.captions)).toBe(false);
      // Caption rows fit their box; the system keeps a usable area.
      expect(L.captionRows * L.captionRowH + (L.captionRows - 1) * 6).toBeLessThanOrEqual(L.captions.h + 1e-9);
      expect(L.system.h).toBeGreaterThan(h * 0.3);
      expect(L.system.w).toBeGreaterThan(w * 0.6);
    });
  }

  it('vertical clips keep clear of the app chrome at the top and bottom', () => {
    const s = safeArea(540, 960, '9:16');
    expect(s.y).toBeGreaterThanOrEqual(960 * 0.12 - 1e-9);
    expect(960 - (s.y + s.h)).toBeGreaterThanOrEqual(960 * 0.18 - 1e-9);
  });

  it('fits the system into its box: centred, within the width and the flattened height', () => {
    for (const p of VIDEO_PRESETS) {
      const { w, h } = logicalSize(p.width, p.height);
      const L = overlayLayout(w, h, p.aspect);
      for (const R of [60, 120, 240]) {
        const c: [number, number] = [w * 0.3, h * 0.7];
        const cam = fitSystem(c, R, L.system, w, h);
        // The system's centre lands on the box's centre.
        const sx = (c[0] - cam.x) * cam.s + w / 2, sy = (c[1] - cam.y) * cam.s + h / 2;
        expect(sx).toBeCloseTo(L.system.x + L.system.w / 2, 6);
        expect(sy).toBeCloseTo(L.system.y + L.system.h / 2, 6);
        if (cam.s > 0.3 && cam.s < 6) {
          // Its width fits, and its flattened height plus the label room.
          expect(2 * R * cam.s).toBeLessThanOrEqual(L.system.w + 1e-6);
          expect(2 * 0.42 * R * cam.s + 2 * FIT_LABEL_PX).toBeLessThanOrEqual(L.system.h + 1e-6);
          // And it is as large as that allows (one of the two bounds is tight).
          expect(Math.max((2 * R * cam.s) / (L.system.w * 0.92), (2 * 0.42 * R * cam.s) / (L.system.h * 0.92 - 2 * FIT_LABEL_PX))).toBeCloseTo(1, 6);
        }
      }
    }
  });
});

// ---------- frame schedule ----------

describe('deterministic frame scheduling', () => {
  const map = { start: T0, end: T0 + 30 * MIN, toReal: (c: number) => T0 + c * 60 };

  it('frame i is at i/fps exactly, with exact µs timestamps that add up', () => {
    const s = frameSchedule(30, TITLE_MS, 30_000, END_MS, map);
    expect(s.total).toBe(Math.round(((TITLE_MS + 30_000 + END_MS) * 30) / 1000));
    let us = 0;
    for (let i = 0; i < s.total; i++) {
      const f = s.at(i);
      expect(f.us).toBe(us);
      expect(f.durUs === 33333 || f.durUs === 33334).toBe(true);
      us += f.durUs;
      expect(f.v).toBe((i * 1000) / 30);
    }
    expect(s.at(30).us).toBe(1_000_000);
  });

  it('title, run and end phases in order; time never goes back; the run reaches the end', () => {
    const s = frameSchedule(30, TITLE_MS, 20_000, END_MS, map);
    const phases: string[] = [];
    let t = -Infinity;
    for (let i = 0; i < s.total; i++) {
      const f = s.at(i);
      if (phases[phases.length - 1] !== f.phase) phases.push(f.phase);
      expect(f.t).toBeGreaterThanOrEqual(t);
      t = f.t;
      if (f.phase === 'title') expect(f.t).toBe(T0);
    }
    expect(phases).toEqual(['title', 'run', 'end']);
    expect(s.at(s.total - 1).t).toBe(map.end);
    const firstRun = [...Array(s.total).keys()].map((i) => s.at(i)).find((f) => f.phase === 'run')!;
    expect(firstRun.c).toBe(0);
    expect(firstRun.t).toBe(T0);
  });

  it('the same input gives the same schedule; GIF at 15 fps', () => {
    const a = frameSchedule(15, 0, 12_345, HOLD_MS, map);
    const b = frameSchedule(15, 0, 12_345, HOLD_MS, map);
    expect(a.total).toBe(Math.round(((12_345 + HOLD_MS) * 15) / 1000));
    for (let i = 0; i < a.total; i++) expect(a.at(i)).toEqual(b.at(i));
  });

  it('plans a whole export: target length, range and toggles', () => {
    const r = mockReplay('11111111-aaaa-bbbb-cccc-000000000001');
    const base: ExportSettings = { format: 'mp4', size: '16:9-1080', range: null, target: 30, overlays: ALL_OVERLAYS, anonymize: false };
    const p = planExport(r, base);
    expect(p.schedule.total).toBe(30 * 30);
    expect([p.width, p.height, p.fps]).toEqual([1920, 1080, 30]);
    expect(p.schedule.titleMs + p.schedule.contentMs + p.schedule.tailMs).toBe(30_000);
    const q = planExport(r, { ...base, format: 'gif', size: '9:16', target: 15, overlays: { ...ALL_OVERLAYS, title: false, end: false } });
    expect([q.width, q.height, q.fps]).toEqual([405, 720, 15]);
    expect(q.schedule.titleMs).toBe(0);
    expect(q.schedule.tailMs).toBe(HOLD_MS);
    expect(q.schedule.total).toBe(15 * 15);
    const mid = r.startedAt + (r.endedAt - r.startedAt) / 2;
    const sel = planExport(r, { ...base, range: { from: mid, to: r.endedAt + 99 * MIN } });
    expect(sel.from).toBe(mid);
    expect(sel.to).toBe(r.endedAt);
    expect(sel.schedule.at(sel.schedule.total - 1).t).toBe(r.endedAt);
    // Same replay and settings → same plan.
    const again = planExport(r, base);
    for (const i of [0, 77, 450, 899]) expect(again.schedule.at(i)).toEqual(p.schedule.at(i));
    expect(again.captions).toEqual(p.captions);
  });

  it('real speed plays at 1× with gaps squeezed, capped per format', () => {
    const r = mockReplay('demo-xyz-12345678');
    const p = planExport(r, { format: 'webm', size: '1:1', range: { from: r.startedAt, to: r.startedAt + 2 * MIN }, target: 'real', overlays: ALL_OVERLAYS, anonymize: false });
    expect(p.schedule.contentMs).toBeLessThanOrEqual(2 * MIN);
    expect(p.schedule.contentMs).toBeGreaterThan(MIN);
    const g = planExport(r, { format: 'gif', size: '1:1', range: null, target: 'real', overlays: ALL_OVERLAYS, anonymize: false });
    expect(g.schedule.contentMs).toBeLessThanOrEqual(60_000);
  });

  it('file names: project or "session", the start date, the format', () => {
    const ts = new Date(2026, 10, 18, 9, 30).getTime();
    expect(exportFileName('Aurora Web', ts, 'mp4')).toBe('clorbit-aurora-web-2026-11-18.mp4');
    expect(exportFileName(null, ts, 'gif')).toBe('clorbit-session-2026-11-18.gif');
    expect(exportFileName('проєкт', ts, 'webm')).toBe('clorbit-session-2026-11-18.webm');
  });
});

// ---------- captions ----------

describe('caption scheduling', () => {
  const r: SessionReplay = {
    sessionId: 's', project: 'p', cwd: '', title: null, model: null, effort: null, contextLimit: null, startedAt: T0, endedAt: T0 + 60 * S, live: false, generatedAt: T0,
    events: normalizeReplayEvents([
      { kind: 'spawn', ts: T0 + 1 * S, agentId: 'a', parentId: 'main', agentType: 'Explore', description: 'x' },
      { kind: 'spawn', ts: T0 + 1 * S + 10, agentId: 'b', parentId: 'main', agentType: 'Plan', description: 'y' },
      { kind: 'status', ts: T0 + 1 * S + 20, status: 'waiting', reason: null, code: 'waitingPermission', arg: 'Bash' },
      { kind: 'status', ts: T0 + 2 * S, status: 'waiting', reason: null, code: 'waitingPermission', arg: 'Bash' },
      { kind: 'status', ts: T0 + 3 * S, status: 'working', reason: null, code: 'working', arg: null },
      { kind: 'tool', ts: T0 + 4 * S, agentId: 'a', label: 'Read x' },
      { kind: 'finish', ts: T0 + 30 * S, agentId: 'a', tokens: 1200 },
    ]),
  };

  it('collects spawns, returns (with the type) and the start of each wait', () => {
    const items = captionItems(r, r.startedAt, r.endedAt);
    expect(items.map((i) => [i.kind, i.agentType, i.arg, i.tokens])).toEqual([
      ['spawn', 'Explore', null, 0], ['spawn', 'Plan', null, 0], ['wait', '', 'Bash', 0], ['finish', 'Explore', null, 1200],
    ]);
    expect(captionItems(r, T0 + 10 * S, r.endedAt).map((i) => i.kind)).toEqual(['finish']);
  });

  it('thins bursts (one per CAPTION_GAP), a wait wins over a crowding spawn', () => {
    const items = captionItems(r, r.startedAt, r.endedAt);
    const caps = scheduleCaptions(items, (t) => t - T0);
    expect(caps.map((c) => c.kind)).toEqual(['wait', 'finish']);
    for (let i = 1; i < caps.length; i++) expect(caps[i].v - caps[i - 1].v).toBeGreaterThanOrEqual(CAPTION_GAP);
    const slow = scheduleCaptions(items, (t) => (t - T0) * 1000);
    expect(slow.map((c) => c.kind)).toEqual(['spawn', 'spawn', 'wait', 'finish']);
  });

  it('shows at most `rows` live captions, fading in and out, newest last', () => {
    const caps = [0, 600, 1200, 1800].map((v, i) => ({ kind: 'spawn' as const, ts: i, agentType: `t${i}`, arg: null, tokens: 0, v }));
    expect(captionsAt(caps, -1, 3)).toEqual([]);
    const at = captionsAt(caps, 1900, 3);
    expect(at.map((x) => x.cap.agentType)).toEqual(['t1', 't2', 't3']);
    expect(at[2].a).toBeLessThan(1);
    expect(at[0].a).toBe(1);
    expect(captionsAt(caps, 1800 + CAPTION_LIFE + 1, 3)).toEqual([]);
  });
});
