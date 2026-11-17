import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LiveSnapshot } from '@shared/api';
import { t, useLang, withLang } from '../i18n';
import { mockResolve } from '../mock';
import { isDemo, useDemo } from './demo';

/**
 * Data access.
 * - By default — the real server (`/api/...`, proxied by Vite in dev). Nothing is ever substituted:
 *   if the server is unreachable (network, 502/503/504, HTML instead of JSON), requests fail and
 *   the layout shows the "server isn't running" screen, retrying until the server is back.
 * - Demo data only by explicit choice: `?demo=1` (alias `?mock=1`), see lib/demo.ts.
 * Every request carries `lang=<ui language>` so server-generated text matches the UI.
 */

let offline = false;
const listeners = new Set<() => void>();
function setOffline(v: boolean) {
  if (offline === v) return;
  offline = v;
  listeners.forEach((l) => l());
}

/** How often the app checks whether an unreachable server is back. */
export const OFFLINE_RETRY_MS = 4000;

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

class Unreachable extends Error {}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(withLang(path), { signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Unreachable(t('api.unreachable'));
  }
  const ct = res.headers.get('content-type') ?? '';
  if ([502, 503, 504].includes(res.status) || (!ct.includes('json') && (res.status >= 500 || res.ok))) {
    // proxy without a server, or Vite's SPA fallback
    throw new Unreachable(t('api.unreachableStatus', { status: res.status }));
  }
  if (!res.ok) {
    let msg = t('api.serverError', { status: res.status });
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') msg = body.error;
    } catch {
      /* body is not JSON */
    }
    throw new HttpError(res.status, msg);
  }
  return (await res.json()) as T;
}

/** Returns data from the server, or from the demo set when demo mode is on. */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<{ data: T; mock: boolean }> {
  if (isDemo()) {
    await new Promise((r) => setTimeout(r, 180 + Math.random() * 220));
    return { data: mockResolve(path) as T, mock: true };
  }
  try {
    const data = await fetchJson<T>(path, signal);
    setOffline(false);
    return { data, mock: false };
  } catch (e) {
    if (e instanceof Unreachable) setOffline(true);
    throw e;
  }
}

// ---------- Context: scan state, data version, server reachability ----------

interface DataState {
  live: LiveSnapshot | null;
  version: number; // grows when the server has read another part of the history (or came back)
  demo: boolean;
  /** The server is unreachable (never true in demo mode). */
  offline: boolean;
  /** A manual retry is in flight. */
  checking: boolean;
  retryServer: () => void;
}

const DataCtx = createContext<DataState>({ live: null, version: 0, demo: false, offline: false, checking: false, retryServer: () => {} });

export function DataProvider({ children }: { children: ReactNode }) {
  const demo = useDemo();
  const [live, setLive] = useState<{ demo: boolean; snap: LiveSnapshot } | null>(null);
  const [version, setVersion] = useState(0);
  const [isOffline, setIsOffline] = useState(offline);
  const [checking, setChecking] = useState(false);
  const [nonce, setNonce] = useState(0);
  const lastBump = useRef({ at: Date.now(), done: true, files: 0 });
  const lang = useLang();

  useEffect(() => {
    const l = () => {
      setIsOffline(offline);
      // Back online: let every page reload its data, quietly.
      if (!offline) setVersion((v) => v + 1);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const { data } = await apiGet<LiveSnapshot>('/api/live');
        if (stop) return;
        setLive({ demo, snap: data });
        const s = data.scan;
        const prev = lastBump.current;
        const now = Date.now();
        // While scanning, refresh charts at most every 8 s; right away once the scan finishes.
        if ((s.done && !prev.done) || (!s.done && s.filesDone > prev.files && now - prev.at > 8000)) {
          lastBump.current = { at: now, done: s.done, files: s.filesDone };
          setVersion((v) => v + 1);
        } else if (prev.done !== s.done) {
          lastBump.current = { ...prev, done: s.done };
        }
        timer = window.setTimeout(tick, s.done ? 15000 : 2500);
      } catch {
        // Unreachable: retry every few seconds; the first success clears the offline state.
        if (!stop) timer = window.setTimeout(tick, offline ? OFFLINE_RETRY_MS : 10000);
      } finally {
        if (!stop) setChecking(false);
      }
    };
    tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [demo, lang, nonce]);

  const retryServer = () => {
    setChecking(true);
    setNonce((n) => n + 1);
  };

  const value: DataState = {
    live: live && live.demo === demo ? live.snap : null,
    version,
    demo,
    offline: !demo && isOffline,
    checking,
    retryServer,
  };
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData(): DataState {
  return useContext(DataCtx);
}

// ---------- Request hook ----------

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean; // first load
  refreshing: boolean; // background refresh over existing data
  reload: () => void;
}

export function useApi<T>(path: string | null): ApiState<T> {
  const { version, demo } = useData();
  const lang = useLang();
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean; key: string | null }>({
    data: null,
    error: null,
    loading: !!path,
    key: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    apiGet<T>(path, ctrl.signal)
      .then(({ data }) => setState({ data, error: null, loading: false, key: path }))
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        setState((s) => ({ ...s, error: e.message || t('api.loadFailed'), loading: false }));
      });
    return () => ctrl.abort();
  }, [path, version, demo, nonce, lang]);

  // Previous data stays on screen while new data loads (changing the range does not flicker).
  return {
    data: state.data,
    error: state.error,
    loading: state.loading && state.data == null,
    refreshing: state.loading && state.data != null,
    reload: () => setNonce((n) => n + 1),
  };
}
