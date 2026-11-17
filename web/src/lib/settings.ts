// User settings on the web side: loaded from GET /api/settings on start, cached here, changed
// optimistically and saved with PUT /api/settings (debounced). Offline or in demo mode the
// defaults apply; demo mode never writes.
import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, type AboutInfo, type Settings } from '@shared/api';
import { cloneSettings, normalizeSettings } from '@shared/settings';
import { getLang, hasExplicitLang, onLangChange, setLang, withLang } from '../i18n';
import { isDemo } from './demo';

type Status = 'loading' | 'ready' | 'offline' | 'demo';

interface State {
  settings: Settings;
  status: Status;
  saveError: boolean;
}

let state: State = { settings: cloneSettings(DEFAULT_SETTINGS), status: isDemo() ? 'demo' : 'loading', saveError: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

export function getSettings(): Settings {
  return state.settings;
}

/** Current settings; re-renders on change. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => state.settings, () => state.settings);
}

/** One value of the settings; re-renders only when that value changes (use for primitives). */
export function useSetting<T>(select: (s: Settings) => T): T {
  return useSyncExternalStore(subscribe, () => select(state.settings), () => select(state.settings));
}

export function useSettingsState(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

let saveTimer: number | undefined;
let retryTimer: number | undefined;
let loadedOnce = false;

/** Applies a change right away and saves it shortly after (never in demo mode). */
export function updateSettings(patch: DeepPartial<Settings>): void {
  set({ settings: normalizeSettings(patch, state.settings) });
  if (state.status === 'demo' || isDemo()) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 300);
}

async function save() {
  try {
    const r = await fetch(withLang('/api/settings'), {
      method: 'PUT',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(state.settings),
    });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error(String(r.status));
    // The server's normalized copy wins (it may have clamped something).
    set({ settings: normalizeSettings(await r.json(), state.settings), saveError: false, status: 'ready' });
  } catch {
    set({ saveError: true });
  }
}

/** Loads the saved settings; retries quietly while the server is unreachable. */
export async function loadSettings(): Promise<void> {
  window.clearTimeout(retryTimer);
  if (isDemo()) {
    set({ status: 'demo' });
    return;
  }
  try {
    const r = await fetch(withLang('/api/settings'), { headers: { accept: 'application/json' } });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error(String(r.status));
    const saved = normalizeSettings(await r.json());
    const first = !loadedOnce;
    loadedOnce = true;
    set({ settings: saved, status: 'ready', saveError: false });
    if (first) reconcileLocal(saved);
  } catch {
    if (state.status !== 'ready') set({ status: 'offline' });
    retryTimer = window.setTimeout(loadSettings, 10_000);
  }
}

/** First load: the language chosen in this browser and a tour switched on in 0.1.x move to the server. */
function reconcileLocal(saved: Settings) {
  const patch: DeepPartial<Settings> = {};
  if (hasExplicitLang()) {
    if (saved.interface.lang !== getLang()) patch.interface = { lang: getLang() };
  } else if (saved.interface.lang !== getLang()) setLang(saved.interface.lang);
  try {
    if (localStorage.getItem('clorbit.tour') === '1' && !saved.interface.autoTour) patch.interface = { ...patch.interface, autoTour: true };
    localStorage.removeItem('clorbit.tour');
  } catch {
    /* storage unavailable */
  }
  if (patch.interface) updateSettings(patch);
}

// The language switch anywhere in the UI is a setting too (the server uses it for system notifications).
onLangChange((l) => {
  if (state.settings.interface.lang !== l) updateSettings({ interface: { lang: l } });
});

// ---------- read-only server facts (Connection section, system notification availability) ----------

let about: AboutInfo | null = null;
const aboutListeners = new Set<() => void>();
export async function loadAbout(): Promise<AboutInfo | null> {
  if (isDemo()) return null;
  try {
    const r = await fetch(withLang('/api/about'), { headers: { accept: 'application/json' } });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error(String(r.status));
    about = (await r.json()) as AboutInfo;
  } catch {
    about = null;
  }
  aboutListeners.forEach((l) => l());
  return about;
}
export function getAbout(): AboutInfo | null {
  return isDemo() ? null : about;
}
export function useAbout(): AboutInfo | null {
  return useSyncExternalStore(
    (cb) => {
      aboutListeners.add(cb);
      return () => void aboutListeners.delete(cb);
    },
    getAbout,
    getAbout,
  );
}

/** Asks the server to show one test system notification. */
export async function sendTestNotification(): Promise<'sent' | 'limited' | 'failed'> {
  try {
    const r = await fetch(withLang('/api/notify/test'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const j = (await r.json()) as { ok: boolean; error?: string };
    return j.ok ? 'sent' : j.error === 'rate-limited' ? 'limited' : 'failed';
  } catch {
    return 'failed';
  }
}

// ---------- the panel's open state ----------

let panelOpen = false;
let opener: HTMLElement | null = null;
const panelListeners = new Set<() => void>();
export function openSettings(from?: HTMLElement | null): void {
  opener = from ?? (document.activeElement as HTMLElement | null);
  panelOpen = true;
  panelListeners.forEach((l) => l());
}
export function closeSettings(): void {
  panelOpen = false;
  panelListeners.forEach((l) => l());
  // Focus goes back to the button that opened the panel.
  opener?.focus?.();
  opener = null;
}
export function useSettingsOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      panelListeners.add(cb);
      return () => void panelListeners.delete(cb);
    },
    () => panelOpen,
    () => panelOpen,
  );
}

/** Settings in effect for the current data source: entering/leaving demo mode resets or reloads them. */
export function syncDemoMode(demo: boolean): void {
  if (demo && state.status !== 'demo') {
    window.clearTimeout(retryTimer);
    window.clearTimeout(saveTimer);
    set({ settings: cloneSettings(DEFAULT_SETTINGS), status: 'demo', saveError: false });
  } else if (!demo && state.status === 'demo') {
    loadedOnce = false;
    set({ settings: cloneSettings(DEFAULT_SETTINGS), status: 'loading' });
    void loadSettings();
  }
}
