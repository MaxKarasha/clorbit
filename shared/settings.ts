// Settings validation and the "should this be silent now" math, shared by the server and the web app.
import { DEFAULT_SETTINGS, NOTIFY_EVENTS, SOUND_THEMES, TERMINAL_APPS, type LayoutPin, type NotifyRule, type Settings, type SoundTheme, type TerminalApp, type TerminalChoice } from './api';

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
/** "Consider unused after N days": allowed range of Settings.recommendations.unusedDays. */
export const RECOMMEND_DAYS = { min: 7, max: 365 } as const;
/** How many hidden recommendation ids are kept (the oldest go first). */
export const MAX_DISMISSED = 500;
const DISMISS_ID = /^[\w:.@~+\-/]{1,200}$/;
/** How many session names are kept (the newest win), and how long one can be. */
export const MAX_SESSION_NAMES = 2000;
export const MAX_SESSION_NAME = 120;
const SESSION_ID = /^[\w-]{1,100}$/;

/** A session name as stored: control characters dropped, whitespace collapsed, at most MAX_SESSION_NAME; '' = none. */
export function cleanSessionName(v: unknown): string {
  if (typeof v !== 'string') return '';
  return [...v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, MAX_SESSION_NAME).join('').trim();
}

/** Validates a session-names map: session-id keys, cleaned non-empty names, at most MAX_SESSION_NAMES (the newest win). */
export function normalizeSessionNames(v: unknown): Record<string, string> | null {
  if (!isObj(v)) return null;
  const ok: [string, string][] = [];
  for (const [k, n] of Object.entries(v)) {
    const name = cleanSessionName(n);
    if (SESSION_ID.test(k) && name) ok.push([k, name]);
  }
  return Object.fromEntries(ok.slice(-MAX_SESSION_NAMES));
}

/** `names` with one session renamed ('' or null removes its name). */
export function withSessionName(names: Record<string, string>, sessionId: string, name: string | null): Record<string, string> {
  const out = { ...names };
  delete out[sessionId];
  const n = cleanSessionName(name);
  if (n) out[sessionId] = n;
  return out;
}

/** Validates a list of hidden recommendation ids: known shape only, no duplicates, at most MAX_DISMISSED (the newest win). */
export function normalizeDismissed(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const seen = new Set<string>();
  for (const x of v) if (typeof x === 'string' && DISMISS_ID.test(x)) { seen.delete(x); seen.add(x); }
  return [...seen].slice(-MAX_DISMISSED);
}

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

export function isTerminalChoice(v: unknown): v is TerminalChoice {
  return v === 'auto' || v === 'off' || TERMINAL_APPS.includes(v as TerminalApp);
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
  // A base saved by an older build has no recommendations block yet.
  if (!isObj(out.recommendations)) out.recommendations = cloneSettings(DEFAULT_SETTINGS).recommendations;
  if (!isObj(out.terminal)) out.terminal = cloneSettings(DEFAULT_SETTINGS).terminal;
  if (typeof out.interface.showCowork !== 'boolean') out.interface.showCowork = DEFAULT_SETTINGS.interface.showCowork;
  if (!isObj(out.sessionNames)) out.sessionNames = {};
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
    out.interface.showCowork = bool(i.showCowork, out.interface.showCowork ?? true);
  }
  const l = patch.layout;
  if (isObj(l)) {
    out.layout.gravity = bool(l.gravity, out.layout.gravity);
    // The pins map is replaced as a whole, so removing a pin is just sending the map without it.
    const pins = normalizePins(l.pins);
    if (pins) out.layout.pins = pins;
  }
  const r = patch.recommendations;
  if (isObj(r)) {
    if (typeof r.unusedDays === 'number' && Number.isFinite(r.unusedDays)) {
      out.recommendations.unusedDays = Math.round(Math.min(RECOMMEND_DAYS.max, Math.max(RECOMMEND_DAYS.min, r.unusedDays)));
    }
    // Like pins, the list is replaced as a whole: showing a card again is sending the list without it.
    const ids = normalizeDismissed(r.dismissed);
    if (ids) out.recommendations.dismissed = ids;
  }
  // Like pins, the map is replaced as a whole: removing a name is sending the map without it.
  const names = normalizeSessionNames(patch.sessionNames);
  if (names) out.sessionNames = names;
  const tm = patch.terminal;
  if (isObj(tm) && isTerminalChoice(tm.app)) out.terminal.app = tm.app;
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
