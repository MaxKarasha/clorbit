// Settings validation/clamping and quiet-hours math.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../api';
import { inQuietHours, isSilenced, normalizeSettings, parseHHMM } from '../settings';

const at = (h: number, m = 0) => new Date(2026, 10, 17, h, m);

describe('normalizeSettings', () => {
  it('returns defaults for garbage', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults match the documented matrix', () => {
    const n = DEFAULT_SETTINGS.notifications;
    expect(n.session_waiting).toEqual({ sound: true, browser: true, browserHiddenOnly: false, toast: true, system: false });
    expect(n.session_done).toEqual({ sound: true, browser: true, browserHiddenOnly: true, toast: true, system: false });
    expect(n.subagent_finished).toEqual({ sound: true, browser: false, browserHiddenOnly: false, toast: false, system: false });
    for (const k of ['subagent_spawned', 'compaction', 'context_high', 'limit_high'] as const) {
      expect(Object.values(n[k]).some(Boolean)).toBe(false);
    }
  });

  it('drops unknown keys and keeps types', () => {
    const s = normalizeSettings({
      evil: 1,
      notifications: { session_waiting: { sound: false, browser: 'yes', hack: true }, unknown_event: { sound: true } },
      sound: { volume: 0.33333, theme: 'disco', extra: 1 },
      interface: { lang: 'ru', autoTour: true, reduceMotion: 1 },
    });
    expect(s).not.toHaveProperty('evil');
    expect(s.notifications).not.toHaveProperty('unknown_event');
    expect(s.notifications.session_waiting).toEqual({ ...DEFAULT_SETTINGS.notifications.session_waiting, sound: false });
    expect(s.notifications.session_waiting).not.toHaveProperty('hack');
    expect(s.sound).toEqual({ enabled: true, volume: 0.33, theme: 'orbit' });
    expect(s.interface).toEqual({ lang: 'en', autoTour: true, reduceMotion: false, showAutomated: false });
  });

  it('showAutomated: off by default, boolean only, kept from the base', () => {
    expect(DEFAULT_SETTINGS.interface.showAutomated).toBe(false);
    expect(normalizeSettings({ interface: { showAutomated: true } }).interface.showAutomated).toBe(true);
    expect(normalizeSettings({ interface: { showAutomated: 'yes' } }).interface.showAutomated).toBe(false);
    const on = normalizeSettings({ interface: { showAutomated: true } });
    expect(normalizeSettings({ interface: { showAutomated: 1 } }, on).interface.showAutomated).toBe(true);
    // A settings row saved by 0.2.0 (no such key) gets the default.
    expect(normalizeSettings({ interface: { lang: 'uk', autoTour: false, reduceMotion: false } }).interface).toEqual({ lang: 'uk', autoTour: false, reduceMotion: false, showAutomated: false });
  });

  it('clamps numbers and validates times', () => {
    expect(normalizeSettings({ sound: { volume: 7 } }).sound.volume).toBe(1);
    expect(normalizeSettings({ sound: { volume: -1 } }).sound.volume).toBe(0);
    expect(normalizeSettings({ sound: { volume: Number.NaN } }).sound.volume).toBe(DEFAULT_SETTINGS.sound.volume);
    const q = normalizeSettings({ dnd: { quietHours: { enabled: true, from: '25:00', to: ' 07:30 ' } } }).dnd.quietHours;
    expect(q).toEqual({ enabled: true, from: '22:00', to: '07:30' });
    const now = 1_000_000_000_000;
    expect(normalizeSettings({ dnd: { mutedUntil: now + 3_600_000 } }, DEFAULT_SETTINGS, now).dnd.mutedUntil).toBe(now + 3_600_000);
    expect(normalizeSettings({ dnd: { mutedUntil: now + 30 * 86_400_000 } }, DEFAULT_SETTINGS, now).dnd.mutedUntil).toBe(now + 7 * 86_400_000);
    expect(normalizeSettings({ dnd: { mutedUntil: now - 1 } }, DEFAULT_SETTINGS, now).dnd.mutedUntil).toBeNull();
  });

  it('merges onto a base without mutating it', () => {
    const base = normalizeSettings({ sound: { theme: 'retro' } });
    const next = normalizeSettings({ sound: { volume: 0.2 } }, base);
    expect(next.sound).toEqual({ enabled: true, volume: 0.2, theme: 'retro' });
    expect(base.sound.volume).toBe(DEFAULT_SETTINGS.sound.volume);
    expect(DEFAULT_SETTINGS.sound.theme).toBe('orbit');
  });
});

describe('quiet hours', () => {
  it('parses HH:MM', () => {
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('23:59')).toBe(1439);
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('7:00')).toBeNull();
  });

  it('a same-day window', () => {
    expect(inQuietHours('13:00', '14:30', at(12, 59))).toBe(false);
    expect(inQuietHours('13:00', '14:30', at(13, 0))).toBe(true);
    expect(inQuietHours('13:00', '14:30', at(14, 29))).toBe(true);
    expect(inQuietHours('13:00', '14:30', at(14, 30))).toBe(false);
  });

  it('a window crossing midnight', () => {
    expect(inQuietHours('22:00', '08:00', at(21, 59))).toBe(false);
    expect(inQuietHours('22:00', '08:00', at(22, 0))).toBe(true);
    expect(inQuietHours('22:00', '08:00', at(0, 0))).toBe(true);
    expect(inQuietHours('22:00', '08:00', at(7, 59))).toBe(true);
    expect(inQuietHours('22:00', '08:00', at(8, 0))).toBe(false);
    expect(inQuietHours('22:00', '08:00', at(12, 0))).toBe(false);
  });

  it('an empty or broken window is never quiet', () => {
    expect(inQuietHours('09:00', '09:00', at(9, 0))).toBe(false);
    expect(inQuietHours('xx', '09:00', at(9, 0))).toBe(false);
  });

  it('isSilenced combines the switch, the window and a temporary mute', () => {
    const now = at(23).getTime();
    expect(isSilenced(DEFAULT_SETTINGS, now)).toBe(false);
    expect(isSilenced(normalizeSettings({ dnd: { enabled: true } }), now)).toBe(true);
    expect(isSilenced(normalizeSettings({ dnd: { quietHours: { enabled: true } } }), now)).toBe(true);
    expect(isSilenced(normalizeSettings({ dnd: { quietHours: { enabled: false } } }), now)).toBe(false);
    const muted = normalizeSettings({ dnd: { mutedUntil: now + 60_000 } }, DEFAULT_SETTINGS, now);
    expect(isSilenced(muted, now)).toBe(true);
    expect(isSilenced(muted, now + 60_001)).toBe(false);
  });
});
