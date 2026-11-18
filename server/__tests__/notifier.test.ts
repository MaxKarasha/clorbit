// System notifications: AppleScript escaping, execFile arguments, rate limiting, settings/DND and
// the server-side settings store (SQLite migration v2).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../../shared/api';
import { normalizeSettings } from '../../shared/settings';
import { ClorbitDb } from '../db';
import { detectTool, escapeAppleScript, notificationBody, notifierCommand, ServerNotifications, SystemNotifier, type Cmd } from '../notifier';
import { SettingsStore } from '../settings';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-notify-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('AppleScript escaping and commands', () => {
  it('escapes quotes and backslashes, flattens control characters', () => {
    expect(escapeAppleScript('say "hi"')).toBe('say \\"hi\\"');
    expect(escapeAppleScript('C:\\path')).toBe('C:\\\\path');
    expect(escapeAppleScript('a\nb\r\tc')).toBe('a b c');
    expect(escapeAppleScript('\\"')).toBe('\\\\\\"');
  });

  it('osascript gets one -e argument with escaped literals, no shell', () => {
    const c = notifierCommand('osascript', 'Clorbit', 'x" & do shell script "rm -rf ~" & "');
    expect(c.file).toBe('osascript');
    expect(c.args).toHaveLength(2);
    expect(c.args[0]).toBe('-e');
    expect(c.args[1]).toBe('display notification "x\\" & do shell script \\"rm -rf ~\\" & \\"" with title "Clorbit"');
  });

  it('notify-send ends options before the text', () => {
    expect(notifierCommand('notify-send', 'Clorbit', '--help me')).toEqual({ file: 'notify-send', args: ['--app-name=Clorbit', '--', 'Clorbit', '--help me'] });
  });

  it('long bodies are cut', () => {
    const c = notifierCommand('notify-send', 'Clorbit', 'x'.repeat(1000));
    expect(c.args[3].length).toBe(240);
  });

  it('detects notify-send on PATH on Linux, nothing elsewhere', () => {
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(bin, { recursive: true });
    expect(detectTool('linux', bin)).toBeNull();
    fs.writeFileSync(path.join(bin, 'notify-send'), '#!/bin/sh\n', { mode: 0o755 });
    expect(detectTool('linux', `/nonexistent${path.delimiter}${bin}`)).toBe('notify-send');
    expect(detectTool('win32', bin)).toBeNull();
  });
});

describe('notification text', () => {
  it('waiting for a permission, in both languages', () => {
    const ev = { type: 'session_waiting' as const, ts: 0, sessionId: 's', project: 'billing-service', wait: 'permission' as const, tool: 'Bash' };
    expect(notificationBody(ev, 'en')).toBe('billing-service is waiting for you: permission for Bash');
    expect(notificationBody(ev, 'uk')).toBe('billing-service чекає на тебе: дозвіл на Bash');
    expect(notificationBody({ ...ev, wait: 'input', tool: null }, 'uk')).toBe('billing-service чекає на твою відповідь');
  });
  it('other events', () => {
    expect(notificationBody({ type: 'session_done', ts: 0, sessionId: 's', project: 'p' }, 'en')).toBe('p: answer ready');
    expect(notificationBody({ type: 'subagent_finished', ts: 0, sessionId: 's', project: 'p', agentType: 'Explore', count: 3 }, 'en')).toBe('p: 3 subagents finished');
    expect(notificationBody({ type: 'limit_high', ts: 0, sessionId: null, project: null, pct: 83, window: '7d' }, 'uk')).toBe('Ліміт підписки (7 днів): використано 83%');
    const at = new Date(2026, 10, 18, 14, 20).getTime();
    const fc = { type: 'limit_forecast' as const, ts: 0, sessionId: null, project: null, pct: 62, window: '5h' as const, at, resetsAt: at + 70 * 60_000 };
    expect(notificationBody(fc, 'en')).toBe('The 5 h limit will run out around 14:20 — 1 h 10 min before the reset (62% used now)');
    expect(notificationBody({ ...fc, resetsAt: at + 25 * 60_000 }, 'uk')).toBe('Ліміт 5 год вичерпається близько 14:20 — за 25 хв до скидання (зараз 62%)');
  });
});

describe('SystemNotifier', () => {
  it('rate-limits and backs off after repeated failures', async () => {
    let now = 1_000_000;
    const calls: Cmd[] = [];
    let fail = false;
    const n = new SystemNotifier('osascript', async (c) => { calls.push(c); if (fail) throw new Error('boom'); }, () => now,
      { perMinute: 3, minGapMs: 1000, maxFailures: 2, pauseMs: 60_000 });
    expect(n.send('Clorbit', 'a')).toBe(true);
    expect(n.send('Clorbit', 'b')).toBe(false); // too soon
    now += 1000; expect(n.send('Clorbit', 'c')).toBe(true);
    now += 1000; expect(n.send('Clorbit', 'd')).toBe(true);
    now += 1000; expect(n.send('Clorbit', 'e')).toBe(false); // 3 per minute
    now += 60_000;
    fail = true;
    expect(n.send('Clorbit', 'f')).toBe(true);
    now += 1000; expect(n.send('Clorbit', 'g')).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    now += 1000; expect(n.send('Clorbit', 'h')).toBe(false); // paused after 2 failures
    now += 60_000; fail = false; expect(n.send('Clorbit', 'i')).toBe(true);
    expect(calls).toHaveLength(6);
  });

  it('is a no-op without a tool', () => {
    expect(new SystemNotifier(null).send('Clorbit', 'x')).toBe(false);
  });
});

describe('ServerNotifications', () => {
  const setup = (patch: unknown) => {
    let settings: Settings = normalizeSettings(patch);
    let now = new Date(2026, 10, 17, 12, 0).getTime();
    const sent: string[] = [];
    const notifier = new SystemNotifier('osascript', async () => {}, () => now, { perMinute: 100, minGapMs: 0, maxFailures: 9, pauseMs: 0 });
    vi.spyOn(notifier, 'send').mockImplementation((_t, b) => { sent.push(b); return true; });
    const sn = new ServerNotifications(() => settings, notifier, () => now, { debounceMs: 8000, burstMs: 50 });
    const snap = (status: 'working' | 'waiting' | 'idle', at = now) => sn.handle(sn.detector.onSnapshot({ now: at, limits: null, sessions: [{ sessionId: 's', alive: true, status, project: 'billing-service', contextTokens: null, contextLimit: null, statusCode: status === 'waiting' ? 'waitingPermission' : null, statusArg: status === 'waiting' ? 'Bash' : null }] }));
    return { sent, snap, setNow: (v: number) => { now = v; }, getNow: () => now, setSettings: (p: unknown) => { settings = normalizeSettings(p, settings); }, sn };
  };

  it('only sends for events with the system channel on, once per wait', () => {
    const t = setup({ notifications: { session_waiting: { system: true } } });
    t.snap('working');
    t.snap('waiting');
    t.snap('waiting');
    t.snap('idle'); // waiting → idle is not "done"; done has no system channel anyway
    expect(t.sent).toEqual(['billing-service is waiting for you: permission for Bash']);
  });

  it('honors do not disturb and quiet hours, and the language', () => {
    const t = setup({ notifications: { session_waiting: { system: true } }, dnd: { enabled: true }, interface: { lang: 'uk' } });
    t.snap('working'); t.snap('waiting');
    expect(t.sent).toEqual([]);
    t.setSettings({ dnd: { enabled: false, quietHours: { enabled: true, from: '11:00', to: '13:00' } } });
    t.snap('working'); t.snap('waiting');
    expect(t.sent).toEqual([]);
    t.setSettings({ dnd: { quietHours: { enabled: false } } });
    t.setNow(t.getNow() + 60_000);
    t.snap('working'); t.snap('waiting');
    expect(t.sent).toEqual(['billing-service чекає на тебе: дозвіл на Bash']);
  });

  it('the limit forecast: a system notification once per window', () => {
    const t = setup({ notifications: { limit_forecast: { system: true } } });
    const R = t.getNow() + 3 * 3_600_000;
    const five = (hitsAt: number | null, resetsAt = R) => ({ window: '5h' as const, pct: 64, resetsAt, ratePerHour: 25, hitsAt, pctAtReset: hitsAt ? 100 : 90, confidence: 'medium' as const, basis: 'limits' as const, points: 7 });
    const send = (hitsAt: number | null, resetsAt = R) => t.sn.handle(t.sn.detector.onSnapshot({
      now: t.getNow(), limits: null, sessions: [],
      limitsForecast: { source: 'statusline', now: t.getNow(), updatedAt: t.getNow(), fiveHour: five(hitsAt, resetsAt), sevenDay: { ...five(null), window: '7d' } },
    }));
    send(null); // baseline
    send(R - 3_600_000);
    t.setNow(t.getNow() + 60_000);
    send(R - 2 * 3_600_000);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toMatch(/^The 5 h limit will run out around \d\d:\d\d — 1 h 0 min before the reset \(64% used now\)$/);
    // The next window warns again.
    t.setNow(t.getNow() + 60_000);
    send(R + 4 * 3_600_000, R + 5 * 3_600_000);
    expect(t.sent).toHaveLength(2);
  });

  it('debounces repeated waits of one session', () => {
    const t = setup({ notifications: { session_waiting: { system: true } } });
    t.snap('working'); t.snap('waiting'); t.snap('working'); t.snap('waiting');
    expect(t.sent).toHaveLength(1);
    t.setNow(t.getNow() + 9000);
    t.snap('working'); t.snap('waiting');
    expect(t.sent).toHaveLength(2);
  });

  it('merges a burst of finished subagents', async () => {
    const t = setup({ notifications: { subagent_finished: { system: true } } });
    t.snap('working');
    for (const id of ['a', 'b', 'c']) t.sn.handle(t.sn.detector.onEvent({ kind: 'finish', ts: t.getNow(), sessionId: 's', agentId: id, parentId: 'main', tokens: 0 }));
    await new Promise((r) => setTimeout(r, 80));
    expect(t.sent).toEqual(['billing-service: 3 subagents finished']);
  });
});

describe('SettingsStore', () => {
  it('persists validated settings in SQLite and reloads them', () => {
    const file = path.join(tmp, 's1', 'clorbit.db');
    const db = ClorbitDb.open(file);
    const store = new SettingsStore(db);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    const next = store.update({ sound: { theme: 'retro', volume: 3 }, bogus: true, dnd: { quietHours: { enabled: true, from: '23:30', to: '07:00' } } });
    expect(next.sound).toEqual({ enabled: true, theme: 'retro', volume: 1 });
    expect(next).not.toHaveProperty('bogus');
    db.close();
    const db2 = ClorbitDb.open(file);
    const again = new SettingsStore(db2).get();
    expect(again.sound.theme).toBe('retro');
    expect(again.dnd.quietHours).toEqual({ enabled: true, from: '23:30', to: '07:00' });
    expect((db2.db.prepare('SELECT COUNT(*) AS n FROM settings').get() as { n: number }).n).toBe(1);
    db2.close();
  });

  it('survives a corrupt row and works without a database', () => {
    const file = path.join(tmp, 's2', 'clorbit.db');
    const db = ClorbitDb.open(file);
    db.setSetting('app', '{not json');
    expect(new SettingsStore(db).get()).toEqual(DEFAULT_SETTINGS);
    db.close();
    const mem = new SettingsStore(null);
    expect(mem.update({ interface: { reduceMotion: true } }).interface.reduceMotion).toBe(true);
  });
});
