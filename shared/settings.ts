// Settings validation and the "should this be silent now" math, shared by the server and the web app.
import { DEFAULT_SETTINGS, NOTIFY_EVENTS, SOUND_THEMES, type LayoutPin, type NotifyRule, type Settings, type SoundTheme } from './api';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const time = (v: unknown, d: string) => (typeof v === 'string' && HHMM.test(v.trim()) ? v.trim() : d);
/** A "mute for N" can never reach further than a week ahead. */
const MAX_MUTE_MS = 7 * 24 * 3_600_000;

export type { LayoutPin };
/** How many bodies can be pinned in the galaxy (the oldest pins go first). */
export const MAX_PINS = 64;
/** Pin keys: 'star:<project>:<sessionId>' or 'cluster:<project>'. */
const PIN_KEY = /^(star|cluster):[^\u0000-\u001f]{1,240}$/;
const unit = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4 : null);

/** Validates a pins map: known key shapes only, coordinates clamped to 0..1, at most MAX_PINS (the newest win). */
export function normalizePins(v: unknown): Record<string, LayoutPin> | null {
  if (!isObj(v)) return null;
  const ok: [string, LayoutPin][] = [];
  for (const [k, p] of Object.entries(v)) {
    if (!PIN_KEY.test(k) || !isObj(p)) continue;
    const x = unit(p.x), y = unit(p.y);
    if (x !== null && y !== null) ok.push([k, { x, y }]);
  }
  return Object.fromEntries(ok.slice(-MAX_PINS));
}

export function cloneSettings(s: Settings): Settings {
  return JSON.parse(JSON.stringify(s)) as Settings;
}

/**
 * Merges `patch` (any JSON) onto `base` and returns a valid Settings object:
 * unknown keys are dropped, wrong types fall back to the base value, numbers are clamped.
 */
export function normalizeSettings(patch: unknown, base: Settings = DEFAULT_SETTINGS, now = Date.now()): Settings {
  const out = cloneSettings(base);
  if (!isObj(patch)) return out;
  const n = patch.notifications;
  if (isObj(n)) {
    for (const ev of NOTIFY_EVENTS) {
      const r = n[ev];
      if (!isObj(r)) continue;
      const cur: NotifyRule = out.notifications[ev];
      out.notifications[ev] = {
        sound: bool(r.sound, cur.sound),
        browser: bool(r.browser, cur.browser),
        browserHiddenOnly: bool(r.browserHiddenOnly, cur.browserHiddenOnly),
        toast: bool(r.toast, cur.toast),
        system: bool(r.system, cur.system),
      };
    }
  }
  const s = patch.sound;
  if (isObj(s)) {
    out.sound.enabled = bool(s.enabled, out.sound.enabled);
    if (typeof s.volume === 'number' && Number.isFinite(s.volume)) out.sound.volume = Math.round(Math.min(1, Math.max(0, s.volume)) * 100) / 100;
    if (SOUND_THEMES.includes(s.theme as SoundTheme)) out.sound.theme = s.theme as SoundTheme;
  }
  const d = patch.dnd;
  if (isObj(d)) {
    out.dnd.enabled = bool(d.enabled, out.dnd.enabled);
    const q = d.quietHours;
    if (isObj(q)) {
      out.dnd.quietHours = { enabled: bool(q.enabled, out.dnd.quietHours.enabled), from: time(q.from, out.dnd.quietHours.from), to: time(q.to, out.dnd.quietHours.to) };
    }
    if (d.mutedUntil === null) out.dnd.mutedUntil = null;
    else if (typeof d.mutedUntil === 'number' && Number.isFinite(d.mutedUntil)) {
      out.dnd.mutedUntil = d.mutedUntil <= now ? null : Math.round(Math.min(d.mutedUntil, now + MAX_MUTE_MS));
    }
  }
  const i = patch.interface;
  if (isObj(i)) {
    if (i.lang === 'en' || i.lang === 'uk') out.interface.lang = i.lang;
    out.interface.autoTour = bool(i.autoTour, out.interface.autoTour);
    out.interface.reduceMotion = bool(i.reduceMotion, out.interface.reduceMotion);
    out.interface.showAutomated = bool(i.showAutomated, out.interface.showAutomated);
  }
  const l = patch.layout;
  if (isObj(l)) {
    out.layout.gravity = bool(l.gravity, out.layout.gravity);
    // The pins map is replaced as a whole, so removing a pin is just sending the map without it.
    const pins = normalizePins(l.pins);
    if (pins) out.layout.pins = pins;
  }
  return out;
}

/** 'HH:MM' → minutes after midnight (null if malformed). */
export function parseHHMM(s: string): number | null {
  const m = HHMM.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Is the local time `date` inside the [from, to) window? Windows may cross midnight
 * (22:00–08:00). from === to means "never" (an empty window), not "always".
 */
export function inQuietHours(from: string, to: string, date: Date): boolean {
  const a = parseHHMM(from);
  const b = parseHHMM(to);
  if (a === null || b === null || a === b) return false;
  const m = date.getHours() * 60 + date.getMinutes();
  return a < b ? m >= a && m < b : m >= a || m < b;
}

/**
 * Do not disturb is in effect: the manual switch, the quiet-hours window or a temporary mute.
 * It silences sounds, browser and system notifications; in-app toasts still show, silently.
 */
export function isSilenced(s: Settings, now = Date.now()): boolean {
  if (s.dnd.enabled) return true;
  if (s.dnd.mutedUntil && s.dnd.mutedUntil > now) return true;
  const q = s.dnd.quietHours;
  return q.enabled && inQuietHours(q.from, q.to, new Date(now));
}
