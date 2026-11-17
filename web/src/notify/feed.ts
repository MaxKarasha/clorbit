// A tiny bus between the data sources and the notification center:
// - the galaxy (real server or demo feed) publishes snapshots and events it already receives;
// - when no page publishes (analytics), the notification center watches the server itself;
// - toasts and browser notifications ask the galaxy to focus a session.
import type { ClorbitEvent, LiveSnapshot } from '@shared/api';
import { href } from '../lib/router';

type Listener = { snapshot: (s: LiveSnapshot) => void; event: (e: ClorbitEvent) => void };

const listeners = new Set<Listener>();
let sources = 0;
const sourceListeners = new Set<() => void>();

export const feed = {
  listen(l: Listener): () => void {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  snapshot(s: LiveSnapshot) {
    listeners.forEach((l) => l.snapshot(s));
  },
  event(e: ClorbitEvent) {
    listeners.forEach((l) => l.event(e));
  },
  /** A page that publishes snapshots and events registers itself; returns the detach function. */
  attachSource(): () => void {
    sources++;
    sourceListeners.forEach((l) => l());
    return () => {
      sources--;
      sourceListeners.forEach((l) => l());
    };
  },
  get sources() {
    return sources;
  },
  onSources(cb: () => void): () => void {
    sourceListeners.add(cb);
    return () => void sourceListeners.delete(cb);
  },
};

// ---------- focus requests ----------

export interface FocusRequest { sessionId: string; agentId?: string }
let pendingFocus: FocusRequest | null = null;
const focusListeners = new Set<(f: FocusRequest) => void>();

/** Asks the galaxy to focus a session or an agent (it may not be mounted yet: the request waits for it). */
export function requestFocus(sessionId: string, agentId?: string) {
  const f = { sessionId, agentId };
  if (focusListeners.size) focusListeners.forEach((l) => l(f));
  else pendingFocus = f;
}

/** The galaxy subscribes; a request made before it mounted is delivered by takePendingFocus(). */
export function onFocusRequest(cb: (f: FocusRequest) => void): () => void {
  focusListeners.add(cb);
  return () => void focusListeners.delete(cb);
}

export function takePendingFocus(): FocusRequest | null {
  const v = pendingFocus;
  pendingFocus = null;
  return v;
}

/** Focuses a session (or one of its agents) in the galaxy, navigating there first if needed. */
export function focusSession(sessionId: string | null, agentId?: string) {
  if (!sessionId) return;
  const onGalaxy = (window.location.hash.replace(/^#/, '').split('?')[0] || '/') === '/';
  if (!onGalaxy) window.location.hash = href('/').slice(1);
  requestFocus(sessionId, agentId);
}
