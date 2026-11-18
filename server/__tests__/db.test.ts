// SQLite persistence: migrations, legacy JSON import, archived summaries, hook waits, limits history.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { overview, sessions } from '../analytics';
import { ClorbitDb, SCHEMA_VERSION } from '../db';
import { deriveWaits, HookLog, MAX_PAYLOAD_BYTES, trimHookPayload, type WaitEvent } from '../hook-log';
import { insights } from '../insights';
import { LimitsLog, parseTsRange } from '../limits-log';
import { scanText } from '../scanner';
import { sessionDetail } from '../session-detail';
import { Store } from '../store';
import { SUMMARY_VERSION } from '../types';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-db-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
let seq = 0;
const dbPath = () => path.join(tmp, `t${seq++}`, 'clorbit.db');

const SID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const opts = { knownPlugins: [] };
const iso = (y: number, mo: number, d: number, h: number) => new Date(y, mo - 1, d, h).toISOString();
const asst = (ts: string, req: string, usage: [number, number, number, number]) => JSON.stringify({
  type: 'assistant', isSidechain: false, requestId: req, timestamp: ts, sessionId: SID, cwd: '/tmp/proj',
  message: { model: 'claude-opus-5-5', id: 'm' + req, content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn',
    usage: { input_tokens: usage[0], output_tokens: usage[1], cache_read_input_tokens: usage[2], cache_creation_input_tokens: usage[3] } },
});

describe('migrations', () => {
  it('creates the schema on an empty DB and is idempotent on reopen', () => {
    const file = dbPath();
    const a = ClorbitDb.open(file);
    expect(a.schemaVersion).toBe(SCHEMA_VERSION);
    const tables = (a.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['meta', 'file_summaries', 'hook_events', 'limits']));
    expect((a.db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode).toBe('wal');
    a.close();
    const b = ClorbitDb.open(file);
    expect(b.schemaVersion).toBe(SCHEMA_VERSION);
    expect(b.stats().rows).toMatchObject({ fileSummaries: 0, hookEvents: 0, limits: 0 });
    b.close();
  });

  it('refuses a DB from a newer build', () => {
    const file = dbPath();
    const a = ClorbitDb.open(file);
    a.setMeta('schema_version', String(SCHEMA_VERSION + 1));
    a.close();
    expect(() => ClorbitDb.open(file)).toThrow(/newer/);
  });
});

describe('legacy JSON cache import', () => {
  it('imports summaries-v<current>.json once, ignores other versions', () => {
    const cacheDir = path.join(tmp, 'cache-import');
    fs.mkdirSync(cacheDir, { recursive: true });
    const s1 = scanText('/p/-tmp-proj/' + SID + '.jsonl', { sessionId: SID, agentId: null, projectDir: '-tmp-proj' }, asst(iso(2026, 11, 1, 10), 'r1', [1, 2, 3, 4]), opts);
    const s2 = scanText('/p/-tmp-proj/' + SID + '/subagents/agent-x.jsonl', { sessionId: SID, agentId: 'x', projectDir: '-tmp-proj' }, asst(iso(2026, 11, 1, 11), 'r2', [5, 5, 5, 5]), opts);
    fs.writeFileSync(path.join(cacheDir, `summaries-v${SUMMARY_VERSION}.json`), JSON.stringify({ version: SUMMARY_VERSION, savedAt: 0, files: [s1, s2] }));
    fs.writeFileSync(path.join(cacheDir, 'summaries-v1.json'), JSON.stringify({ version: 1, savedAt: 0, files: [] }));
    const db = ClorbitDb.open(dbPath());
    const r = db.importJsonCache(cacheDir);
    expect(r).toMatchObject({ count: 2, skipped: ['summaries-v1.json'] });
    const loaded = db.loadSummaries();
    expect(loaded.map((x) => x.summary).sort((a, b) => a.path.localeCompare(b.path))).toEqual([s1, s2].sort((a, b) => a.path.localeCompare(b.path)));
    expect(loaded.every((x) => x.missingSince === null)).toBe(true);
    // Second run is a no-op.
    expect(db.importJsonCache(cacheDir)).toBeNull();
    expect(db.stats().rows.fileSummaries).toBe(2);
    db.close();
  });
});

describe('archived transcripts', () => {
  it('keeps a deleted transcript in analytics and serves an archived session detail', async () => {
    const projectsDir = path.join(tmp, 'projects-arch');
    const file = path.join(projectsDir, '-tmp-proj', `${SID}.jsonl`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, [asst(iso(2026, 10, 5, 10), 'a', [10, 20, 30, 40]), asst(iso(2026, 10, 6, 10), 'b', [1, 1, 1, 1])].join('\n') + '\n');
    const range = { from: '2026-10-01', to: '2026-10-31' };
    const dbFile = dbPath();

    const db1 = ClorbitDb.open(dbFile);
    const st1 = new Store(projectsDir, db1, opts);
    st1.loadCache();
    await st1.coldScan(0);
    const before = overview(st1, range).totals;
    expect(before.total).toBe(104);
    db1.close();

    fs.rmSync(file);

    // Restart: summaries come from SQLite, the scan notices the file is gone.
    const db2 = ClorbitDb.open(dbFile);
    const st2 = new Store(projectsDir, db2, opts);
    st2.loadCache();
    await st2.coldScan(0);
    expect(st2.isMissing(file)).toBe(true);
    expect(overview(st2, range).totals).toEqual(before);
    expect(sessions(st2, range, null).map((s) => s.sessionId)).toEqual([SID]);
    expect(Array.isArray(insights(st2, range))).toBe(true);
    const row = db2.db.prepare('SELECT missing_since FROM file_summaries WHERE path = ?').get(file) as { missing_since: number | null };
    expect(row.missing_since).toBeGreaterThan(0);
    expect(db2.stats().rows.archived).toBe(1);

    const d = await sessionDetail(st2, SID, false);
    expect(d).not.toBeNull();
    expect(d!.archived).toBe(true);
    expect(d!.timeline).toEqual([]);
    expect(d!.summary.total).toBe(104);
    expect(d!.tree.id).toBe('main');
    db2.close();

    // A third start still has it (archived flag persisted).
    const db3 = ClorbitDb.open(dbFile);
    const st3 = new Store(projectsDir, db3, opts);
    st3.loadCache();
    expect(st3.isMissing(file)).toBe(true);
    expect(overview(st3, range).totals.total).toBe(104);
    db3.close();
  });
});

describe('hook events', () => {
  it('trims payloads to at most 4 KB and drops tool bodies', () => {
    const body = {
      hook_event_name: 'PostToolUse', session_id: 's', tool_name: 'Read',
      tool_input: { file_path: '/a.ts', content: 'x'.repeat(50_000), nested: { deep: 1 } },
      tool_response: { file: { content: 'y'.repeat(200_000) } },
      cwd: '/tmp/' + 'z'.repeat(10_000),
    };
    const s = trimHookPayload(body);
    expect(Buffer.byteLength(s)).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
    const j = JSON.parse(s);
    expect(j.tool_response).toBeUndefined();
    expect(j.tool_response_chars).toBeGreaterThan(200_000);
    expect(j.tool_input.file_path).toBe('/a.ts');
    expect(j.tool_input.nested).toBe('[object]');
  });

  it('derives wait intervals from notifications and permission requests', () => {
    const e = (ts: number, sessionId: string, event: string, extra: Partial<WaitEvent> = {}): WaitEvent =>
      ({ ts, sessionId, event, tool: null, notificationType: null, message: null, ...extra });
    const waits = deriveWaits([
      // Session A: PreToolUse → PermissionRequest + Notification (same wait) → PostToolUse.
      e(1000, 'A', 'PreToolUse', { tool: 'Bash' }),
      e(2000, 'A', 'PermissionRequest', { tool: 'Bash' }),
      e(2500, 'A', 'Notification', { notificationType: 'permission_prompt', message: 'Claude needs your permission to use Bash' }),
      e(62_000, 'A', 'PostToolUse', { tool: 'Bash' }),
      // Session B: idle prompt → user answers.
      e(10_000, 'B', 'Stop'),
      e(70_000, 'B', 'Notification', { notificationType: 'idle_prompt', message: 'Claude is waiting for your input' }),
      e(190_000, 'B', 'UserPromptSubmit'),
      // Session A again: permission via notification text only; never closed → dropped.
      e(300_000, 'A', 'Notification', { message: 'Claude needs your permission to use WebFetch' }),
      // Session C: unrelated events produce nothing.
      e(5000, 'C', 'PreToolUse', { tool: 'Read' }),
      e(6000, 'C', 'PostToolUse', { tool: 'Read' }),
    ]);
    expect(waits).toEqual([
      { sessionId: 'A', start: 2000, end: 62_000, kind: 'permission', tool: 'Bash' },
      { sessionId: 'B', start: 70_000, end: 190_000, kind: 'input', tool: null },
    ]);
  });

  it('caps very long waits', () => {
    const w = deriveWaits([
      { ts: 0, sessionId: 'A', event: 'Notification', tool: null, notificationType: 'idle_prompt', message: null },
      { ts: 48 * 3_600_000, sessionId: 'A', event: 'UserPromptSubmit', tool: null, notificationType: null, message: null },
    ], 3_600_000);
    expect(w[0].end - w[0].start).toBe(3_600_000);
  });

  it('stores events, prunes after 90 days and feeds the wait insight', () => {
    const db = ClorbitDb.open(dbPath());
    const log = new HookLog(db);
    const now = new Date(2026, 10, 10, 12).getTime();
    log.record({ hook_event_name: 'PreToolUse', session_id: 'S', tool_name: 'Bash', tool_input: { command: 'rm -rf build' } }, now - 100 * 86_400_000);
    log.record({ hook_event_name: 'PermissionRequest', session_id: 'S', tool_name: 'Bash', tool_input: { command: 'rm -rf build' } }, now);
    log.record({ hook_event_name: 'PostToolUse', session_id: 'S', tool_name: 'Bash', tool_response: { stdout: 'ok' } }, now + 5 * 60_000);
    log.flush();
    expect(db.stats().rows.hookEvents).toBe(3);
    expect(log.prune(now)).toBe(1);
    const row = db.db.prepare("SELECT tool, event FROM hook_events WHERE event = 'PermissionRequest'").get() as { tool: string };
    expect(row.tool).toBe('Bash');

    const store = new Store(path.join(tmp, 'none'), null, opts);
    const ins = insights(store, { from: '2026-11-10', to: '2026-11-10' }, log);
    const w = ins.find((i) => i.id === 'hook-waits');
    expect(w?.title).toContain('5m');
    expect(w?.evidence[0]).toContain('Bash: 1');
    // The same insight in Ukrainian.
    const uk = insights(store, { from: '2026-11-10', to: '2026-11-10' }, log, 'uk').find((i) => i.id === 'hook-waits');
    expect(uk?.title).toContain('5 хв');
    // No hook data in another range → no wait insight.
    expect(insights(store, { from: '2026-10-01', to: '2026-10-02' }, log).some((i) => i.id === 'hook-waits')).toBe(false);
    db.close();
  });
});

describe('limits history', () => {
  it('records only changes and serves a time range', () => {
    const db = ClorbitDb.open(dbPath());
    const log = new LimitsLog(db, () => null);
    const base = { fiveHourPct: 10, fiveHourResetsAt: 5_000_000, sevenDayPct: 40, sevenDayResetsAt: 9_000_000 };
    expect(log.record({ ...base, updatedAt: 1000 })).toBe(true);
    expect(log.record({ ...base, updatedAt: 2000 })).toBe(false); // same values
    expect(log.record({ ...base, fiveHourPct: 12, updatedAt: 3000 })).toBe(true);
    expect(log.record({ ...base, fiveHourPct: 12, updatedAt: 3000 })).toBe(false);
    expect(log.record({ fiveHourPct: null, fiveHourResetsAt: null, sevenDayPct: null, sevenDayResetsAt: null, updatedAt: 4000 })).toBe(false);
    expect(log.record({ ...base, fiveHourPct: 0, fiveHourResetsAt: 6_000_000, updatedAt: 3000 })).toBe(true); // window reset; ts kept increasing
    expect(log.history(0, 10_000)).toEqual([
      { ts: 1000, fiveHourPct: 10, sevenDayPct: 40, fiveHourResetsAt: 5_000_000, sevenDayResetsAt: 9_000_000 },
      { ts: 3000, fiveHourPct: 12, sevenDayPct: 40, fiveHourResetsAt: 5_000_000, sevenDayResetsAt: 9_000_000 },
      { ts: 3001, fiveHourPct: 0, sevenDayPct: 40, fiveHourResetsAt: 6_000_000, sevenDayResetsAt: 9_000_000 },
    ]);
    expect(log.history(2000, 3000)).toHaveLength(1);
    // Dedupe survives a restart (last row is reloaded).
    const again = new LimitsLog(db, () => ({ ...base, fiveHourPct: 0, fiveHourResetsAt: 6_000_000, updatedAt: 9000 }));
    expect(again.poll()).toBe(false);
    db.close();
  });

  it('parses date and epoch ranges', () => {
    const q = (s: string) => new URLSearchParams(s);
    const r = parseTsRange(q('from=2026-11-01&to=2026-11-02'));
    expect(r.from).toBe(new Date(2026, 10, 1).getTime());
    expect(r.to).toBe(new Date(2026, 10, 3).getTime() - 1);
    expect(parseTsRange(q('from=5&to=10'))).toEqual({ from: 5, to: 10 });
    expect(parseTsRange(q(''), 1_000_000_000)).toEqual({ from: 1_000_000_000 - 7 * 86_400_000, to: 1_000_000_000 });
  });
});
