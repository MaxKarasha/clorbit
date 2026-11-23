// Web notification rules: channel selection, sound throttling, toast stacking, texts.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/api';
import type { NotifyEvent } from '@shared/notify';
import { normalizeSettings } from '@shared/settings';
import { setLang } from '../i18n';
import { channelsFor, notifyBody, pruneToasts, pushToast, TOAST_MS, type ChannelContext } from './rules';
import { shouldPlay, THEMES } from './sound';
import { tabBadge, tabTitle } from './tabBadge';

const ctx: ChannelContext = { now: new Date(2026, 10, 17, 12).getTime(), demo: false, hidden: false, permission: 'granted', systemAvailable: true };
const ev = (type: NotifyEvent['type'], extra: Partial<NotifyEvent> = {}): NotifyEvent => ({ type, ts: 0, sessionId: 's1', project: 'billing-service', ...extra });

describe('channelsFor', () => {
  it('defaults: waiting → sound + browser + toast; done → browser only when hidden', () => {
    expect(channelsFor('session_waiting', DEFAULT_SETTINGS, ctx)).toEqual({ sound: true, browser: true, toast: true });
    expect(channelsFor('session_done', DEFAULT_SETTINGS, ctx)).toEqual({ sound: true, browser: false, toast: true });
    expect(channelsFor('session_done', DEFAULT_SETTINGS, { ...ctx, hidden: true }).browser).toBe(true);
    expect(channelsFor('subagent_finished', DEFAULT_SETTINGS, ctx)).toEqual({ sound: true, browser: false, toast: false });
    expect(channelsFor('compaction', DEFAULT_SETTINGS, ctx)).toEqual({ sound: false, browser: false, toast: false });
  });

  it('demo mode and a missing permission never show browser notifications', () => {
    expect(channelsFor('session_waiting', DEFAULT_SETTINGS, { ...ctx, demo: true })).toEqual({ sound: true, browser: false, toast: true });
    expect(channelsFor('session_waiting', DEFAULT_SETTINGS, { ...ctx, permission: 'default' }).browser).toBe(false);
    expect(channelsFor('session_waiting', DEFAULT_SETTINGS, { ...ctx, permission: 'unsupported' }).browser).toBe(false);
  });

  it('system on suppresses the browser notification, but only when the server can show it', () => {
    const s = normalizeSettings({ notifications: { session_waiting: { system: true } } });
    expect(channelsFor('session_waiting', s, ctx).browser).toBe(false);
    expect(channelsFor('session_waiting', s, { ...ctx, systemAvailable: false }).browser).toBe(true);
  });

  it('do not disturb silences sound and browser, toasts stay', () => {
    const s = normalizeSettings({ dnd: { enabled: true } });
    expect(channelsFor('session_waiting', s, ctx)).toEqual({ sound: false, browser: false, toast: true });
    const quiet = normalizeSettings({ dnd: { quietHours: { enabled: true, from: '11:00', to: '13:00' } } });
    expect(channelsFor('session_waiting', quiet, ctx).sound).toBe(false);
    const masterOff = normalizeSettings({ sound: { enabled: false } });
    expect(channelsFor('session_waiting', masterOff, ctx)).toEqual({ sound: false, browser: true, toast: true });
  });
});

describe('sound throttle', () => {
  it('at most one sound per event type per 1.2 s', () => {
    const last = new Map();
    expect(shouldPlay(last, 'subagent_finished', 1000)).toBe(true);
    expect(shouldPlay(last, 'subagent_finished', 1500)).toBe(false);
    expect(shouldPlay(last, 'session_done', 1500)).toBe(true);
    expect(shouldPlay(last, 'subagent_finished', 2200)).toBe(true);
  });

  it('every theme has a distinct sound for every event, waiting is the longest', () => {
    for (const theme of Object.values(THEMES)) {
      const sigs = Object.values(theme).map((v) => JSON.stringify(v));
      expect(new Set(sigs).size).toBe(sigs.length);
      const len = (vs: { at: number; dur: number }[]) => Math.max(...vs.map((v) => v.at + v.dur)) * vs.length;
      const waiting = len(theme.session_waiting);
      for (const [k, v] of Object.entries(theme)) if (k !== 'session_waiting') expect(len(v)).toBeLessThan(waiting);
      for (const vs of Object.values(theme)) for (const v of vs) expect(v.gain).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('toasts', () => {
  it('merges a burst of finished subagents of one session', () => {
    let l = pushToast([], ev('subagent_finished', { agentType: 'Explore' }), 1, 1000);
    l = pushToast(l, ev('subagent_finished'), 2, 1500);
    l = pushToast(l, ev('subagent_finished', { sessionId: 's2' }), 3, 1600);
    expect(l).toHaveLength(2);
    expect(l.find((x) => x.sessionId === 's1')!.ev.count).toBe(2);
  });

  it('waiting toasts stay until resolved; others expire', () => {
    let l = pushToast([], ev('session_waiting'), 1, 0);
    l = pushToast(l, ev('session_done', { sessionId: 's2' }), 2, 0);
    l = pruneToasts(l, TOAST_MS + 1);
    expect(l.map((x) => x.type)).toEqual(['session_waiting']);
    expect(pruneToasts(l, TOAST_MS + 2, ['s1'])).toEqual([]);
  });

  it('a new wait of the same session replaces the old toast; the stack is capped', () => {
    let l = pushToast([], ev('session_waiting'), 1, 0);
    l = pushToast(l, ev('session_waiting'), 2, 10);
    expect(l.map((x) => x.id)).toEqual([2]);
    for (let i = 0; i < 6; i++) l = pushToast(l, ev('session_done', { sessionId: `d${i}` }), 10 + i, 20 + i);
    expect(l).toHaveLength(4);
    expect(l.some((x) => x.type === 'session_waiting')).toBe(true);
  });
});

describe('texts', () => {
  it('follow the UI language', () => {
    const e = ev('session_waiting', { wait: 'permission', tool: 'Bash' });
    setLang('en');
    expect(notifyBody(e)).toBe('billing-service is waiting for you: permission for Bash');
    setLang('uk');
    expect(notifyBody(e)).toBe('billing-service чекає на тебе: дозвіл на Bash');
    expect(notifyBody(ev('subagent_finished', { count: 3 }))).toBe('billing-service: завершено субагентів — 3');
    setLang('en');
  });
});

describe('tab badge', () => {
  it('waiting wins over working; more than nine shows as 9+', () => {
    expect(tabBadge({ waiting: 0, working: 0 })).toBeNull();
    expect(tabBadge({ waiting: 0, working: 3 })).toEqual({ kind: 'working' });
    expect(tabBadge({ waiting: 2, working: 3 })).toEqual({ kind: 'waiting', label: '2' });
    expect(tabBadge({ waiting: 12, working: 0 })).toEqual({ kind: 'waiting', label: '9+' });
  });

  it('the title puts the waiting count first, in the UI language', () => {
    setLang('en');
    expect(tabTitle({ waiting: 0, working: 4 })).toBe('Clorbit');
    expect(tabTitle({ waiting: 1, working: 0 })).toBe('(1) Waiting for you · Clorbit');
    setLang('uk');
    expect(tabTitle({ waiting: 1, working: 0 })).toBe('(1) Чекає на тебе · Clorbit');
    expect(tabTitle({ waiting: 3, working: 0 })).toBe('(3) Чекають на тебе · Clorbit');
    expect(tabTitle({ waiting: 5, working: 0 })).toBe('(5) Чекають на тебе · Clorbit');
    setLang('en');
  });
});
