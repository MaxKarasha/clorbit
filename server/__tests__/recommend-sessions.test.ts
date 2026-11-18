// Recommendations for the Sessions tab, the Session page, the Overview and the limits panel: what the scanner records
// (v9 cache facts: idle-gap rebuilds, model switches, a nearly full context, compaction sizes, effort rounds), every
// rule, session scoping, the overview picker, the limits cards (no source, no 5-hour window, run-out, pace), prompts.
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Insight, InsightPage, LimitsForecast, WindowForecast } from '../../shared/api.ts';
import { insightTotals, pickOverview } from '../../shared/insights';
import { insights, sessionInsights } from '../insights';
import { DAY_MS, type RecommendEnv } from '../recommend';
import { limitRecommendations, windowUsage } from '../recommend-limits';
import { sessionRange, sessionView } from '../recommend-sessions';
import { scanText } from '../scanner';
import { Store } from '../store';
import { MIN_SUMMARY_VERSION, SUMMARY_VERSION, type FileSummary } from '../types';
import { estTokens, localDate } from '../util';

const NOW = new Date(2026, 10, 18, 12).getTime();
const MIN = 60_000;
const at = (d: number, h = 10, m = 0) => new Date(NOW - d * DAY_MS).setHours(h, m, 0, 0);
const iso = (ts: number) => new Date(ts).toISOString();
const opts = { knownPlugins: [] };
let seq = 0;

type Ev =
  | { prompt: number; origin?: string }
  | { turn: number; read?: number; write?: number; input?: number; out?: number; model?: string; effort?: string; tools?: { name: string; input?: Record<string, unknown> }[]; end?: boolean }
  | { compact: number; pre?: number; auto?: boolean };

/** One transcript from events; `startup` chars of skill listing at the first event. */
function transcript(o: { sid: string; agent?: string; cwd: string; entrypoint?: string; startup?: number; events: Ev[] }): FileSummary {
  const lines: string[] = [];
  const first = o.events.map((e) => ('prompt' in e ? e.prompt : 'turn' in e ? e.turn : e.compact))[0];
  if (o.startup) lines.push(JSON.stringify({ type: 'attachment', attachment: { type: 'skill_listing', content: 's'.repeat(o.startup) }, timestamp: iso(first) }));
  const base = { sessionId: o.sid, cwd: o.cwd, ...(o.entrypoint ? { entrypoint: o.entrypoint } : {}) };
  for (const e of o.events) {
    if ('prompt' in e) {
      lines.push(JSON.stringify({ type: 'user', timestamp: iso(e.prompt), ...base, ...(e.origin ? { turnOrigin: e.origin } : {}), message: { role: 'user', content: 'please do it' } }));
    } else if ('compact' in e) {
      lines.push(JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: iso(e.compact), ...base, compactMetadata: { trigger: e.auto === false ? 'manual' : 'auto', preTokens: e.pre ?? 0 } }));
    } else {
      const content = e.tools?.length ? e.tools.map((t) => ({ type: 'tool_use', id: `tu${seq++}`, name: t.name, input: t.input ?? {} })) : [{ type: 'text', text: 'ok' }];
      lines.push(JSON.stringify({
        type: 'assistant', requestId: `r${seq++}`, timestamp: iso(e.turn), ...base, ...(e.effort ? { perTurnEffort: e.effort } : {}),
        message: {
          model: e.model ?? 'claude-opus-5-5', id: `m${seq++}`, content, stop_reason: e.end === false || e.tools?.length ? 'tool_use' : 'end_turn',
          usage: { input_tokens: e.input ?? 10, output_tokens: e.out ?? 100, cache_read_input_tokens: e.read ?? 0, cache_creation_input_tokens: e.write ?? 0 },
        },
      }));
      if (e.tools?.length) {
        const ids = content.map((c: any) => c.id);
        lines.push(JSON.stringify({ type: 'user', timestamp: iso(e.turn + 500), ...base, message: { role: 'user', content: ids.map((id: string) => ({ type: 'tool_result', tool_use_id: id, content: 'x'.repeat(2000) })) } }));
      }
    }
  }
  const p = o.agent ? `/p/-w/${o.sid}/subagents/agent-${o.agent}.jsonl` : `/p/-w/${o.sid}.jsonl`;
  return scanText(p, { sessionId: o.sid, agentId: o.agent ?? null, projectDir: '-w' }, lines.join('\n'), opts);
}
const day = (s: FileSummary, ts: number) => s.days[localDate(ts)];

describe('scanner: v9 cache facts', () => {
  it('counts a rebuild after an idle gap only when the cache was really re-written; a warm gap does not count', () => {
    const t0 = at(1);
    const s = transcript({
      sid: 's-scan-1', cwd: '/w/a', events: [
        { prompt: t0 }, { turn: t0 + MIN, write: 150_000 },
        { prompt: t0 + 20 * MIN }, { turn: t0 + 21 * MIN, write: 148_000 },           // 20 min idle, rebuilt
        { prompt: t0 + 30 * MIN }, { turn: t0 + 31 * MIN, read: 148_000, write: 2_000 }, // 10 min idle, still warm
        { prompt: t0 + 3 * 60 * MIN }, { turn: t0 + 3 * 60 * MIN + MIN, write: 151_000 }, // over an hour, rebuilt
      ],
    });
    expect(s.v).toBe(SUMMARY_VERSION);
    expect(day(s, t0).rebuilds).toEqual({ n: 2, n60: 1, write: 299_000 });
    expect(day(s, t0).switches).toBeUndefined();
  });

  it('a model switch that rebuilds the cache, a compaction (not a rebuild), compaction size and a full context', () => {
    const t0 = at(1);
    const s = transcript({
      sid: 's-scan-2', cwd: '/w/a', events: [
        { prompt: t0 }, { turn: t0 + MIN, write: 180_000 },
        { turn: t0 + 2 * MIN, model: 'claude-sonnet-5-5', write: 181_000 }, // switched model, same minute range
        { compact: t0 + 3 * MIN, pre: 181_000 },
        { turn: t0 + 30 * MIN, model: 'claude-sonnet-5-5', write: 30_000 },  // after the compaction: no rebuild
        { turn: t0 + 31 * MIN, model: 'claude-sonnet-5-5', read: 880_000, write: 1000 },
      ],
    });
    const b = day(s, t0);
    expect(b.switches).toEqual({ n: 1, write: 181_000 });
    expect(b.rebuilds).toBeUndefined();
    expect(b.compactPre).toBe(181_000);
    expect(b.autoCompactions).toBe(1);
    expect(b.ctxHi).toEqual([3, 1]);
  });

  it('counts prompt rounds per effort level; simple = ≤ 2 requests, no tools, a short answer', () => {
    const t0 = at(1);
    const s = transcript({
      sid: 's-scan-3', cwd: '/w/a', events: [
        { prompt: t0 }, { turn: t0 + 1000, effort: 'max', out: 200 },
        { prompt: t0 + MIN }, { turn: t0 + MIN + 1000, effort: 'max', tools: [{ name: 'Read', input: { file_path: '/w/a/x.ts' } }] }, { turn: t0 + MIN + 3000, effort: 'max', out: 50 },
        { prompt: t0 + 2 * MIN }, { turn: t0 + 2 * MIN + 1000, effort: 'high', out: 5000 },
      ],
    });
    const e = day(s, t0).effort!;
    expect(e.max).toMatchObject({ rounds: 2, simple: 1 });
    expect(e.max.tok).toBe(10 + 200);
    expect(e.high).toEqual({ rounds: 1, simple: 0, tok: 0 });
  });

  it('carries the state across an incremental read; subagent transcripts get no cache facts', () => {
    const t0 = at(1);
    const head = transcript({ sid: 's-scan-4', cwd: '/w/a', events: [{ prompt: t0 }, { turn: t0 + MIN, write: 100_000 }] });
    const tail = [
      JSON.stringify({ type: 'user', timestamp: iso(t0 + 15 * MIN), sessionId: 's-scan-4', message: { role: 'user', content: 'go on' } }),
      JSON.stringify({ type: 'assistant', requestId: 'tail-r', timestamp: iso(t0 + 16 * MIN), sessionId: 's-scan-4', message: { model: 'claude-opus-5-5', id: 'tail-m', stop_reason: 'end_turn', content: [], usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 99_000 } } }),
    ].join('\n');
    const resumed = scanText(head.path, { sessionId: 's-scan-4', agentId: null, projectDir: '-w' }, tail, opts, head);
    expect(day(resumed, t0).rebuilds).toEqual({ n: 1, n60: 0, write: 99_000 });
    const sub = transcript({ sid: 's-scan-4', agent: 'a1', cwd: '/w/a', events: [{ turn: t0, write: 100_000 }, { turn: t0 + 20 * MIN, write: 100_000 }] });
    expect(day(sub, t0).rebuilds).toBeUndefined();
    expect(day(sub, t0).ctxHi).toBeUndefined();
  });
});

// ---------- the synthetic history ----------

const store = new Store(path.join(os.tmpdir(), 'clorbit-none'), null, opts);
const put = (s: FileSummary) => (store as any).put(s);
const A = '/w/proj-a', B = '/w/proj-b', C = '/w/proj-c';
const S1 = 'aaaaaaaa-0000-0000-0000-000000000001', S2 = 'aaaaaaaa-0000-0000-0000-000000000002', S3 = 'aaaaaaaa-0000-0000-0000-000000000003';
const S4 = 'aaaaaaaa-0000-0000-0000-000000000004', S6 = 'aaaaaaaa-0000-0000-0000-000000000006', QUIET = 'aaaaaaaa-0000-0000-0000-000000000009';
const STARTUP = 3600;

// S1 (proj-a, day 2): two rebuilds after breaks (one over an hour), a warm break; re-reads its notes 4 times.
{
  const t = at(2);
  put(transcript({
    sid: S1, cwd: A, startup: STARTUP, events: [
      { prompt: t }, { turn: t + MIN, write: 150_000, tools: Array.from({ length: 4 }, () => ({ name: 'Read', input: { file_path: `${A}/NOTES.md` } })) },
      { turn: t + 2 * MIN, read: 150_000, write: 1000 },
      { prompt: t + 25 * MIN }, { turn: t + 26 * MIN, write: 150_000 },
      { prompt: t + 4 * 60 * MIN }, { turn: t + 4 * 60 * MIN + MIN, write: 160_000 },
      { prompt: t + 4 * 60 * MIN + 12 * MIN }, { turn: t + 4 * 60 * MIN + 13 * MIN, read: 160_000, write: 1000 },
    ],
  }));
}
// S2 (proj-b, day 3): a rebuild, three auto-compactions, mostly a nearly full context, a re-read file, three Explore
// subagents on Opus that only read.
{
  const t = at(3);
  const ev: Ev[] = [{ prompt: t }, { turn: t + 30_000, write: 100_000, tools: Array.from({ length: 4 }, () => ({ name: 'Read', input: { file_path: `${B}/src/api.ts` } })) }];
  // Back after 40 minutes: the cache expired (a compaction right before a break would not count).
  ev.push({ prompt: t + 40 * MIN }, { turn: t + 41 * MIN, write: 150_000 });
  const t2 = t + 42 * MIN;
  for (let i = 0; i < 20; i++) ev.push({ turn: t2 + i * 30_000, read: i < 12 ? 178_000 : 90_000, write: 2000 });
  for (let k = 0; k < 3; k++) ev.push({ compact: t2 + (21 + k) * 30_000, pre: 172_000 });
  ev.push({ prompt: t2 + 60 * MIN }, { turn: t2 + 61 * MIN, write: 60_000 });
  put(transcript({ sid: S2, cwd: B, startup: STARTUP, events: ev }));
  for (let k = 0; k < 3; k++) {
    const sub = transcript({ sid: S2, agent: `ex${k}`, cwd: B, events: [{ turn: t + (k + 1) * MIN, input: 400_000, tools: [{ name: 'Grep' }, { name: 'Read', input: { file_path: `${B}/a.ts` } }] }] });
    sub.meta = { agentType: 'Explore', description: null, spawnDepth: 1, toolUseId: null, finished: true, workflow: null, worktreePath: null, builtIn: true, launchModel: 'opus' };
    put(sub);
  }
}
// S3 (proj-a, day 4): 12 of 30 turns with the context over 170K.
{
  const t = at(4);
  const ev: Ev[] = [{ prompt: t }];
  for (let i = 0; i < 30; i++) ev.push({ turn: t + (i + 1) * 20_000, read: i < 12 ? 185_000 : 60_000, write: 1000 });
  put(transcript({ sid: S3, cwd: A, startup: STARTUP, events: ev }));
}
// S4 (proj-a, day 5): 24 rounds at max effort, 14 of them simple; some at high (never flagged).
{
  const t = at(5);
  const ev: Ev[] = [];
  for (let i = 0; i < 24; i++) {
    const p = t + i * MIN;
    ev.push({ prompt: p });
    if (i < 14) ev.push({ turn: p + 1000, effort: 'max', out: 120, read: 40_000 });
    else ev.push({ turn: p + 1000, effort: 'max', tools: [{ name: 'Edit', input: { file_path: `${A}/x.ts` } }], read: 40_000 }, { turn: p + 3000, effort: 'max', out: 300, read: 41_000 });
  }
  for (let i = 0; i < 10; i++) ev.push({ prompt: t + (30 + i) * MIN }, { turn: t + (30 + i) * MIN + 1000, effort: 'high', out: 80, read: 40_000 });
  put(transcript({ sid: S4, cwd: A, startup: STARTUP, events: ev }));
}
// S5 (proj-c, days 1-3): three claude -p runs (sdk-cli) that read a lot.
for (let k = 0; k < 3; k++) {
  const t = at(1 + k, 3);
  put(transcript({ sid: `aaaaaaaa-0000-0000-0000-00000000005${k}`, cwd: C, entrypoint: 'sdk-cli', events: [{ prompt: t, origin: 'sdk' }, { turn: t + 1000, read: 2_000_000, write: 5000 }] }));
}
// S6 (proj-b, day 6): a day of cache rebuilds after breaks and a model switch: a low cache hit day.
{
  const t = at(6);
  const ev: Ev[] = [{ prompt: t }, { turn: t + MIN, write: 300_000 }];
  for (let i = 1; i <= 4; i++) ev.push({ prompt: t + i * 30 * MIN }, { turn: t + i * 30 * MIN + MIN, write: 300_000 });
  ev.push({ turn: t + 4 * 30 * MIN + 2 * MIN, model: 'claude-sonnet-5-5', write: 300_000 });
  put(transcript({ sid: S6, cwd: B, startup: STARTUP, events: ev }));
}
// A quiet session with nothing to say.
{
  const t = at(2, 15);
  put(transcript({ sid: QUIET, cwd: A, startup: STARTUP, events: [{ prompt: t }, { turn: t + 1000, write: 20_000 }, { turn: t + 2000, read: 20_000, write: 100 }] }));
}

const env = (over: Partial<RecommendEnv> = {}): Partial<RecommendEnv> => ({
  now: NOW, unusedDays: 30, enabledPlugins: {}, settingsFile: '~/.claude/settings.json', skillsDir: '~/.claude/skills',
  ownSkillExists: () => false, claudeJsonFile: '~/.claude.json', mcp: { user: [], local: {}, projectFile: () => [] },
  userClaudeMd: '~/.claude/CLAUDE.md', agentFile: () => null, autoCompactPct: undefined, ...over,
});
const fullEnv = (over: Partial<RecommendEnv> = {}) => env(over) as RecommendEnv;
const range = { from: localDate(at(9)), to: localDate(NOW) };
const run = (lang: 'en' | 'uk' = 'en', page?: InsightPage) => insights(store, range, null, lang, { env: env(), page });
const rule = (list: Insight[], id: string) => list.find((i) => i.id.split(':')[0] === id);
const FORBIDDEN = /[ыэъё]/i;

describe('Sessions tab rules', () => {
  const list = run('en', 'sessions');

  it('shows its cards on the Sessions tab only', () => {
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((i) => i.pages?.includes('sessions'))).toBe(true);
    expect(list.map((i) => i.id.split(':')[0]).sort()).toEqual(['auto-compactions', 'automated-sessions', 'context-full', 'effort-simple', 'idle-rebuilds', 'low-cache-days']);
  });

  it('idle-gap rebuilds: measured cache writes after breaks, minus the startup context a fresh session writes', () => {
    const c = rule(list, 'idle-rebuilds')!;
    // S1: 150K + 160K, S2: 150K (not the turn after its compactions), S6: 4 × 300K (the model switch is not a break).
    const rows = [[2, 310_000], [1, 150_000], [4, 1_200_000]];
    // Every session here has the same startup context (the listing line, as the scanner measures it).
    const startupTok = estTokens(Object.values(store.mainOf(S1)!.startup).reduce((n, c) => n + c, 0));
    const expected = rows.reduce((n, [k, w]) => n + w - k * startupTok, 0);
    expect(c.estSavingTokens).toBe(expected);
    expect(c.saving).toMatchObject({ period: expected, basis: 'range' });
    expect(c.title).toBe('Resuming after breaks re-wrote ≈ 1.7M tokens of context to the cache (7 times in 3 sessions)');
    expect(c.evidence[0]).toBe('In total: 7 rebuilds, 1 after more than an hour; ≈ 1.7M tokens written again');
    expect(c.targets!.map((t) => t.key)).toEqual([S6, S1, S2]);
    expect(c.prompts).toBeUndefined();
    expect(c.fix).toMatch(/\/compact/);
  });

  it('auto-compactions: a CLAUDE.md note for long tasks, backed up, nothing else changes', () => {
    const c = rule(list, 'auto-compactions')!;
    expect(c.title).toBe('3 auto-compactions in 1 session');
    expect(c.evidence).toContain('Average context at an auto-compaction: ≈ 172K tokens');
    expect(c.estSavingTokens).toBeUndefined();
    for (const p of [c.prompts!.all, c.prompts!.ask]) {
      expect(p).toContain('Add one line to the "Long tasks" section of ~/.claude/CLAUDE.md');
      expect(p).toContain('cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak-$(date +%Y%m%d-%H%M%S)');
      expect(p).toContain('do not touch autoCompactEnabled');
      expect(p).not.toMatch(/\brm\s/);
    }
    expect(c.prompts!.ask).toContain('AskUserQuestion');
    const withEnv = insights(store, range, null, 'en', { env: env({ autoCompactPct: '70' }), page: 'sessions' });
    expect(rule(withEnv, 'auto-compactions')!.evidence).toContain('Your auto-compaction threshold: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=70');
  });

  it('a nearly full context: sessions with many turns over 85% of their window', () => {
    const c = rule(list, 'context-full')!;
    expect(c.title).toBe('2 sessions keep running with a nearly full context');
    expect(c.targets!.map((t) => t.key).sort()).toEqual([S2, S3].sort());
    expect(c.evidence.join('\n')).toMatch(/of the 200K window \(12\)/);
    expect(c.prompts).toBeUndefined();
  });

  it('raised effort on simple prompts: a review without a saving; "high" is never counted', () => {
    const c = rule(list, 'effort-simple')!;
    expect(c.title).toBe('14 of 24 prompts at max effort were simple');
    expect(c.estSavingTokens).toBeUndefined();
    expect(c.saving).toBeUndefined();
    expect(c.prompts).toBeUndefined();
    expect(c.evidence.join('\n')).not.toMatch(/high/);
  });

  it('automated runs: grouped by project and entrypoint, with their share of all tokens', () => {
    const c = rule(list, 'automated-sessions')!;
    expect(c.targets!.map((t) => t.label)).toEqual(['proj-c · sdk-cli']);
    expect(c.evidence[0]).toMatch(/^proj-c · sdk-cli: 3 runs, ≈ 6\.0M tokens \(\d+% of all\), mostly claude-opus-5-5/);
    expect(c.prompts).toBeUndefined();
  });

  it('low cache hit days: the likely causes from the data, and no saving of its own (the idle-gap card has it)', () => {
    const c = rule(list, 'low-cache-days')!;
    expect(c.evidence[0]).toMatch(new RegExp(`^${localDate(at(6))}: cache .* — likely: 4 rebuilds after breaks \\(≈ 1\\.2M\\), 1 model switch \\(≈ 300K\\)`));
    expect(c.estSavingTokens).toBeUndefined();
  });

  it('Ukrainian: no letters of other alphabets, the prompts follow the language', () => {
    const uk = run('uk', 'sessions');
    expect(uk.length).toBe(list.length);
    for (const c of uk) {
      const text = [c.title, c.detail, c.fix ?? '', ...c.evidence, c.prompts?.all ?? '', c.prompts?.ask ?? ''].join('\n');
      expect(text).not.toMatch(FORBIDDEN);
    }
    expect(rule(uk, 'idle-rebuilds')!.title).toMatch(/^Продовження після перерв знову записало в кеш/);
    expect(rule(uk, 'auto-compactions')!.prompts!.ask).toContain('Поки нічого не змінюй');
    expect(rule(uk, 'auto-compactions')!.prompts!.all).toContain('.bak-$(date +%Y%m%d-%H%M%S)');
  });

  it('archived summaries of older versions (without the v9 fields) still work', () => {
    const old = new Store(path.join(os.tmpdir(), 'clorbit-none'), null, opts);
    for (const s of store.files.values()) {
      const c: FileSummary = structuredClone(s);
      c.v = MIN_SUMMARY_VERSION;
      for (const b of Object.values(c.days)) { delete b.rebuilds; delete b.switches; delete b.ctxHi; delete b.compactPre; delete b.effort; }
      (old as any).put(c);
    }
    const l = insights(old, range, null, 'en', { env: env(), page: 'sessions' });
    expect(l.map((i) => i.id.split(':')[0]).sort()).toEqual(['auto-compactions', 'automated-sessions', 'low-cache-days']);
    expect(rule(l, 'low-cache-days')!.evidence[0]).toMatch(/no cause visible in the data|compaction|new sessions/);
    expect(sessionInsights(old, S2, 'en', fullEnv()).map((i) => i.id.split(':')[0]).sort()).toEqual(['agent-model@session', 'auto-compactions@session', 'repeated-reads@session']);
  });
});

describe('Session page: the same rules over one session', () => {
  it('a store view holds only that session\'s files, over the days it covers', () => {
    const v = sessionView(store, S2);
    expect([...v.files.values()].every((s) => s.sessionId === S2)).toBe(true);
    expect(v.files.size).toBe(4);
    expect(sessionRange(store, S2)).toEqual({ from: localDate(at(3)), to: localDate(at(3)) });
    expect(sessionRange(store, 'nope-nope-nope')).toBeNull();
  });

  it('S2: compactions, the rebuild, a full context, its re-read file and its Explore agents on Opus', () => {
    const l = sessionInsights(store, S2, 'en', fullEnv());
    expect(l.map((i) => i.id.split(':')[0]).sort()).toEqual(['agent-model@session', 'auto-compactions@session', 'context-full@session', 'idle-rebuilds@session', 'repeated-reads@session']);
    expect(l.every((i) => i.pages!.length === 1 && i.pages![0] === 'session')).toBe(true);
    const see = Object.fromEntries(l.map((i) => [i.id.split(':')[0], i.seeAlso]));
    expect(see).toMatchObject({ 'idle-rebuilds@session': 'sessions', 'repeated-reads@session': 'tools', 'agent-model@session': 'subagents' });
    expect(rule(l, 'idle-rebuilds@session')!.title).toBe('After breaks, this session re-wrote ≈ 150K tokens of context to the cache (1 time)');
    expect(rule(l, 'auto-compactions@session')!.title).toBe('This session auto-compacted 3 times');
    expect(rule(l, 'context-full@session')!.title).toBe('This session ran 52% of its turns with the context over 85% full');
    // Only this session's file, not S1's.
    const reads = rule(l, 'repeated-reads@session')!;
    expect(reads.targets!.map((t) => t.key)).toEqual([`${B}/src/api.ts`]);
    expect(JSON.stringify(l)).not.toContain('NOTES.md');
    // Sorted by savings.
    for (let i = 1; i < l.length; i++) expect(l[i - 1].estSavingTokens ?? 0).toBeGreaterThanOrEqual(l[i].estSavingTokens ?? 0);
  });

  it('nothing to say → no cards; an unknown session → none; page "session" without an id → none', () => {
    expect(sessionInsights(store, QUIET, 'en', fullEnv())).toEqual([]);
    expect(sessionInsights(store, 'zzzzzzzz-0000', 'en', fullEnv())).toEqual([]);
    expect(insights(store, range, null, 'en', { env: env(), page: 'session' })).toEqual([]);
    expect(insights(store, range, null, 'en', { env: env(), page: 'session', session: S1 }).map((i) => i.id.split(':')[0]).sort()).toEqual(['idle-rebuilds@session', 'repeated-reads@session']);
  });

  it('a session card id differs from the tab card, so hiding one does not hide the other', () => {
    const tab = run('en', 'sessions').map((i) => i.id);
    const page = sessionInsights(store, S2, 'en', fullEnv()).map((i) => i.id);
    expect(page.some((id) => tab.includes(id))).toBe(false);
  });
});

describe('Overview: the best cards of every tab', () => {
  it('ranks by savings, every card keeps its own tab, limits cards stay on the panel', () => {
    const forecast = fc({ sevenDay: win('7d', { pct: 70, ratePerHour: 2, hitsAt: NOW + 15 * 3_600_000, resetsAt: NOW + 2 * DAY_MS, pctAtReset: 100 }) });
    const all = insights(store, range, null, 'en', { env: env(), limits: () => forecast });
    expect(all.some((i) => i.id.startsWith('limits-runout:'))).toBe(true);
    const top = insights(store, range, null, 'en', { env: env(), page: 'overview', limits: () => forecast });
    expect(top.length).toBeGreaterThan(0);
    expect(top.some((i) => i.pages?.includes('limits'))).toBe(false);
    expect(top[0].id.split(':')[0]).toBe('idle-rebuilds');
    for (let i = 1; i < top.length; i++) expect(top[i - 1].estSavingTokens ?? 0).toBeGreaterThanOrEqual(top[i].estSavingTokens ?? 0);
    expect(top.every((i) => i.pages && i.pages[0] !== 'overview')).toBe(true);
  });

  it('pickOverview: savings first, then severity; cards without a tab or with nothing measured and only info are left out', () => {
    const c = (id: string, o: Partial<Insight>): Insight => ({ id, severity: 'info', title: id, detail: '', evidence: [], pages: ['tools'], ...o });
    const picked = pickOverview([
      c('a', { estSavingTokens: 10 }), c('b', { estSavingTokens: 500 }), c('w', { saving: { waitMs: 60_000 } }),
      c('h', { severity: 'high' }), c('i', {}), c('l', { pages: ['limits'], severity: 'high' }), c('n', { pages: [], estSavingTokens: 9e9 }),
      c('s', { pages: ['session'], estSavingTokens: 9e9 }),
    ]);
    expect(picked.map((i) => i.id)).toEqual(['b', 'a', 'w', 'h']);
    expect(pickOverview(Array.from({ length: 30 }, (_, k) => c(`x${k}`, { estSavingTokens: k + 1 })), 3).map((i) => i.id)).toEqual(['x29', 'x28', 'x27']);
  });

  it('the Insights total adds up only the cards\' own token savings and keeps waiting time apart', () => {
    const list = run('en');
    const t = insightTotals(list);
    expect(t.tokens).toBe(list.reduce((n, i) => n + (i.estSavingTokens ?? 0), 0));
    // Diagnosis and limits cards carry no token saving of their own.
    for (const id of ['low-cache-days', 'auto-compactions', 'context-full', 'effort-simple', 'automated-sessions']) expect(rule(list, id)?.estSavingTokens).toBeUndefined();
  });
});

// ---------- limits ----------

function win(w: '5h' | '7d', o: Partial<WindowForecast> = {}): WindowForecast {
  return { window: w, pct: null, resetsAt: null, ratePerHour: 0, hitsAt: null, pctAtReset: null, confidence: 'medium', basis: 'limits', points: 10, ...o };
}
function fc(o: Partial<LimitsForecast> = {}): LimitsForecast {
  return { source: 'statusline', now: NOW, updatedAt: NOW, fiveHour: win('5h', { noWindow: true }), sevenDay: win('7d'), ...o };
}
const lever = (id: string, est: number, page: 'tools' | 'subagents', extra: Partial<Insight> = {}): Insight => ({
  id, severity: 'warn', title: `Lever ${id}`, detail: '', evidence: [], pages: [page], estSavingTokens: est, saving: { period: est, days: 5, basis: 'range' }, ...extra,
});

describe('limits panel', () => {
  it('no source: how to connect it, with /clorbit statusline (a preview) and no prompt that edits settings', () => {
    const l = limitRecommendations(store, fc({ source: 'none' }), 'en', () => null);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ id: 'limits-connect', pages: ['limits'], fix: '/clorbit statusline' });
    expect(l[0].prompts).toBeUndefined();
    expect(l[0].evidence.join('\n')).toMatch(/dry run .* changes nothing/);
    const uk = limitRecommendations(store, fc({ source: 'none' }), 'uk', () => null)[0];
    expect(uk.title).toBe('Ліміти підписки не підключені');
    expect([uk.title, uk.detail, ...uk.evidence].join('\n')).not.toMatch(FORBIDDEN);
  });

  it('the week runs out before its reset: what eats it, the levers as a share of the window; no 5-hour talk without that window', () => {
    const reset = NOW + 2 * DAY_MS;
    const f = fc({ sevenDay: win('7d', { pct: 80, ratePerHour: 1, hitsAt: NOW + 20 * 3_600_000, resetsAt: reset, pctAtReset: 100 }) });
    let from = 0;
    const l = limitRecommendations(store, f, 'en', (x) => {
      from = x;
      return { cards: [lever('tools-x', 400_000, 'tools'), lever('agents-y', 600_000, 'subagents', { saving: { period: 600_000, days: 5, basis: 'range', costShare: 0.5 } }), lever('tiny', 1, 'tools')], range: { from: localDate(x), to: localDate(NOW) } };
    });
    expect(from).toBe(reset - 7 * DAY_MS);
    expect(l).toHaveLength(1);
    const c = l[0];
    expect(c.id.startsWith('limits-runout:')).toBe(true);
    expect(c.title).toBe('At this pace the weekly limit runs out ≈ 28h before it resets');
    expect(c.severity).toBe('high');
    expect(c.evidence[0]).toMatch(/^Now 80% used, ≈ 1\.0%\/h; runs out ≈ .*; resets .*; ≈ 128% by the reset at this pace$/);
    expect(c.evidence.join('\n')).toMatch(/Projects in this window: proj-/);
    expect(c.evidence.join('\n')).toMatch(/Who: main sessions \d+%/);
    expect(JSON.stringify(c)).not.toMatch(/5-hour/);
    expect(c.targets!.map((t) => t.key)).toEqual(['tools-x', 'agents-y']);
    expect(c.saving!.window).toBe('7d');
    expect(c.saving!.windowPct).toBeGreaterThan(0);
    expect(c.estSavingTokens).toBeUndefined();
    expect(c.seeAlso).toBe('tools');
    // The levers' shares: context savings weigh as cache writes, a cheaper model at the window's mix.
    const use = windowUsage(store, from, NOW);
    const expected = Math.min(128 * 0.9, (400_000 * 1.25 / use.total) * 128 + (600_000 * use.mix / use.total) * 128);
    expect(c.saving!.windowPct).toBeCloseTo(Math.round(expected * 10) / 10, 5);
  });

  it('the week has room: the pace card (info); used up: a "high" card; a 5-hour window that runs out when it exists', () => {
    const reset = NOW + 3 * DAY_MS;
    const pace = limitRecommendations(store, fc({ sevenDay: win('7d', { pct: 30, ratePerHour: 0.2, resetsAt: reset, pctAtReset: 44 }) }), 'en', () => null);
    expect(pace).toHaveLength(1);
    expect(pace[0]).toMatchObject({ severity: 'info', title: 'On pace to finish the week at ≈ 44% of the weekly limit: you have room' });
    expect(pace[0].evidence[0]).toBe('Used 30% · 57% of the week gone · ≈ 44% at the reset');
    const tight = limitRecommendations(store, fc({ sevenDay: win('7d', { pct: 60, ratePerHour: 0.5, resetsAt: reset, pctAtReset: 96 }) }), 'en', () => null);
    expect(tight[0].severity).toBe('warn');
    // No forecast yet (a thin history): a straight line through the use so far.
    const line = limitRecommendations(store, fc({ sevenDay: win('7d', { pct: 70, resetsAt: reset, basis: 'none', confidence: 'low' }) }), 'en', () => null);
    expect(line[0]).toMatchObject({ severity: 'warn', title: 'On a straight line the weekly limit runs out before it resets (≈ 123% by then)' });
    const gone = limitRecommendations(store, fc({ sevenDay: win('7d', { pct: 100, exhausted: true, resetsAt: reset, pctAtReset: 100 }) }), 'en', () => null);
    expect(gone[0]).toMatchObject({ severity: 'high', title: 'The weekly limit is used up; it resets in 3 d 0 h' });
    const five = limitRecommendations(store, fc({
      fiveHour: win('5h', { pct: 70, ratePerHour: 30, hitsAt: NOW + 3_600_000, resetsAt: NOW + 3 * 3_600_000, pctAtReset: 100 }),
      sevenDay: win('7d', { pct: 20, ratePerHour: 0.1, resetsAt: reset, pctAtReset: 27 }),
    }), 'en', () => null);
    expect(five[0].title).toBe('At this pace the 5-hour limit runs out ≈ 2h before it resets');
  });

  it('nothing known about the week (and no 5-hour window): no card; through insights() only with a forecast', () => {
    expect(limitRecommendations(store, fc(), 'en', () => null)).toEqual([]);
    expect(insights(store, range, null, 'en', { env: env(), page: 'limits' })).toEqual([]);
    const l = insights(store, range, null, 'en', { env: env(), page: 'limits', limits: () => fc({ source: 'none' }) });
    expect(l.map((i) => i.id)).toEqual(['limits-connect']);
    expect(insights(store, range, null, 'en', { env: env(), page: 'tools', limits: () => fc({ source: 'none' }) }).some((i) => i.id === 'limits-connect')).toBe(false);
  });
});
