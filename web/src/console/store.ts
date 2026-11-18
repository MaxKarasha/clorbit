// Console history of this page (the galaxy tab or the console window), its colors, and the
// BroadcastChannel bridge that lets a console window drive the galaxy in the main tab.
import { useSyncExternalStore } from 'react';
import type { LiveSnapshot, RecentEvent } from '@shared/api';
import { withLang } from '../i18n';
import { branchCol, cssCol, hashStr, projectHue } from '../galaxy/engine';
import { focusSession } from '../notify/feed';
import { mergeLines, toLine, type ConsoleLine } from './model';

// ---------- lines ----------

let lines: ConsoleLine[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const consoleStore = {
  add(e: RecentEvent, snap: LiveSnapshot | null) {
    const l = toLine(e, snap);
    if (!l) return;
    const next = mergeLines(lines, [l]);
    if (next !== lines) {
      lines = next;
      emit();
    }
  },
  addMany(list: RecentEvent[], snap: LiveSnapshot | null) {
    const ls = list.map((e) => toLine(e, snap)).filter((l): l is ConsoleLine => !!l);
    const next = mergeLines(lines, ls);
    if (next !== lines) {
      lines = next;
      emit();
    }
  },
  reset() {
    lines = [];
    emit();
  },
  get lines() {
    return lines;
  },
};

export function useConsoleLines(): ConsoleLine[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => lines,
    () => lines,
  );
}

/** Loads the server's recent history into the console (no-op in demo mode). */
export async function loadRecent(): Promise<void> {
  try {
    const r = await fetch(withLang('/api/events/recent?limit=500'), { headers: { accept: 'application/json' } });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return;
    consoleStore.addMany((await r.json()) as RecentEvent[], null);
  } catch {
    /* offline: the live stream fills the console once the server is back */
  }
}

// ---------- colors: the galaxy's own, remembered so finished agents keep theirs ----------

const colorCache = new Map<string, string>();
let provider: ((sessionId: string, agentId: string) => string | null) | null = null;
const colorListeners = new Set<() => void>();
let colorVersion = 0;

/** The galaxy registers its engine as the source of truth for colors. */
export function setColorProvider(fn: typeof provider) {
  provider = fn;
}

export function rememberColors(map: Record<string, string>) {
  let changed = false;
  for (const [k, v] of Object.entries(map)) if (colorCache.get(k) !== v) (colorCache.set(k, v), (changed = true));
  if (changed) {
    colorVersion++;
    colorListeners.forEach((l) => l());
  }
}

/** Re-renders when colors arrive from the main tab. */
export function useColorVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      colorListeners.add(cb);
      return () => void colorListeners.delete(cb);
    },
    () => colorVersion,
    () => colorVersion,
  );
}

/** A star's color is its project's hue, exactly as the engine computes it. */
export const projectColor = (project: string) => cssCol(branchCol(projectHue(project), 0, 0, 0));

export function lineColor(sessionId: string, agentId: string, project: string): string {
  const key = `${sessionId}:${agentId}`;
  const live = provider?.(sessionId, agentId);
  if (live) {
    colorCache.set(key, live);
    return live;
  }
  const known = colorCache.get(key);
  if (known) return known;
  const hue = projectHue(project);
  // Unknown planet (seen only in history): a stable color from the same branch palette.
  return agentId === 'main' ? projectColor(project) : cssCol(branchCol(hue, 1, Math.floor(hashStr(agentId) * 6), 0));
}

// ---------- the bridge between the console window and the main tab ----------

export const MAIN_WINDOW = 'clorbit-main';
type Msg =
  | { type: 'focus'; id: string; sessionId: string; agentId?: string }
  | { type: 'ack'; id: string }
  | { type: 'hello' }
  | { type: 'colors'; map: Record<string, string> };

function channel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('clorbit');
  } catch {
    return null;
  }
}

let lastHello = 0;

/** Main tab: answers focus requests from console windows and shares the galaxy's colors. */
export function startMainBridge(): () => void {
  // Lets a console window find this tab by name.
  if (!window.name) window.name = MAIN_WINDOW;
  const ch = channel();
  if (!ch) return () => {};
  ch.onmessage = (m: MessageEvent<Msg>) => {
    const d = m.data;
    if (d?.type === 'focus') {
      focusSession(d.sessionId, d.agentId);
      ch.postMessage({ type: 'ack', id: d.id } satisfies Msg);
      try {
        window.focus();
      } catch {
        /* browsers may ignore it */
      }
    } else if (d?.type === 'hello') {
      lastHello = Date.now();
      postColorsNow();
    }
  };
  bridge = ch;
  return () => {
    ch.close();
    if (bridge === ch) bridge = null;
  };
}

let bridge: BroadcastChannel | null = null;
let colorSource: (() => Record<string, string>) | null = null;
export function setColorSource(fn: typeof colorSource) {
  colorSource = fn;
}
function postColorsNow() {
  if (bridge && colorSource) bridge.postMessage({ type: 'colors', map: colorSource() } satisfies Msg);
}
/** Called on every snapshot in the galaxy: shares colors while a console window is around. */
export function shareColors() {
  if (Date.now() - lastHello < 60_000) postColorsNow();
}

/** Console window: listens for colors and says hello now and then (so the main tab keeps sharing). */
export function startWindowBridge(): () => void {
  const ch = channel();
  if (!ch) return () => {};
  ch.onmessage = (m: MessageEvent<Msg>) => {
    if (m.data?.type === 'colors') rememberColors(m.data.map);
    else if (m.data?.type === 'ack') acks.get(m.data.id)?.();
  };
  const hello = () => ch.postMessage({ type: 'hello' } satisfies Msg);
  hello();
  const iv = window.setInterval(hello, 20_000);
  winBridge = ch;
  return () => {
    window.clearInterval(iv);
    ch.close();
    if (winBridge === ch) winBridge = null;
  };
}

let winBridge: BroadcastChannel | null = null;
const acks = new Map<string, () => void>();

/**
 * Console window: focuses a session/agent in the main tab. If no main tab answers, opens one
 * (window name 'clorbit-main') and keeps asking until it is up.
 */
export function focusInMain(sessionId: string, agentId?: string) {
  const ch = winBridge;
  const id = Math.random().toString(36).slice(2);
  const send = () => ch?.postMessage({ type: 'focus', id, sessionId, agentId } satisfies Msg);
  let done = false;
  acks.set(id, () => {
    if (done) return;
    done = true;
    acks.delete(id);
    // Bring the main tab forward when it opened this window (window names do not cross unrelated tabs,
    // so an empty-URL open by name would create a blank tab instead).
    try {
      if (window.opener && !window.opener.closed) (window.opener as Window).focus();
    } catch {
      /* not allowed */
    }
  });
  send();
  window.setTimeout(() => {
    if (done) return;
    const demo = /[?&](demo|mock)=/.test(window.location.hash) ? '?demo=1' : '';
    window.open(`${window.location.pathname}${window.location.search}#/${demo}`, MAIN_WINDOW)?.focus();
    let tries = 0;
    const iv = window.setInterval(() => {
      if (done || ++tries > 20) {
        window.clearInterval(iv);
        acks.delete(id);
        return;
      }
      send();
    }, 500);
  }, 400);
}
