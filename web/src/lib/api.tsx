import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LiveSnapshot } from '@shared/api';
import { t, useLang, withLang } from '../i18n';
import { mockResolve } from '../mock';
import { useRoute } from './router';

/**
 * Data access.
 * - By default — the real server (`/api/...`, proxied by Vite in dev).
 * - `?mock=1` in the hash or the URL — demo data only.
 * - If the server is unreachable (network, 502/503/504, HTML instead of JSON) — demo data
 *   automatically, with a badge in the navigation.
 * Every request carries `lang=<ui language>` so server-generated text matches the UI.
 */

export type MockReason = 'forced' | 'offline' | null;

let offline = false;
const listeners = new Set<() => void>();
function setOffline(v: boolean) {
  if (offline === v) return;
  offline = v;
  listeners.forEach((l) => l());
}

export function isMockForced(): boolean {
  const hashQ = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const searchQ = new URLSearchParams(window.location.search);
  const v = hashQ.get('mock') ?? searchQ.get('mock');
  return v != null && v !== '0';
}

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

/** Returns data from the server or from the demo set. */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<{ data: T; mock: boolean }> {
  if (isMockForced() || offline) {
    await new Promise((r) => setTimeout(r, 180 + Math.random() * 220));
    return { data: mockResolve(path) as T, mock: true };
  }
  try {
    const data = await fetchJson<T>(path, signal);
    return { data, mock: false };
  } catch (e) {
    if (e instanceof Unreachable) {
      setOffline(true);
      return { data: mockResolve(path) as T, mock: true };
    }
    throw e;
  }
}

// ---------- Context: scan state and data version ----------

interface DataState {
  live: LiveSnapshot | null;
  version: number; // grows when the server has read another part of the history
  mockReason: MockReason;
  retryServer: () => void;
}

const DataCtx = createContext<DataState>({ live: null, version: 0, mockReason: null, retryServer: () => {} });

export function DataProvider({ children }: { children: ReactNode }) {
  const route = useRoute();
  const forced = route.query.get('mock') != null && route.query.get('mock') !== '0' ? true : isMockForced();
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [version, setVersion] = useState(0);
  const [isOffline, setIsOffline] = useState(offline);
  const lastBump = useRef({ at: Date.now(), done: true, files: 0 });
  const lang = useLang();

  useEffect(() => {
    const l = () => setIsOffline(offline);
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
        setLive(data);
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
        if (!stop) timer = window.setTimeout(tick, 10000);
      }
    };
    tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [forced, isOffline, lang]);

  const retryServer = () => {
    setOffline(false);
    setVersion((v) => v + 1);
  };

  const mockReason: MockReason = forced ? 'forced' : isOffline ? 'offline' : null;
  return <DataCtx.Provider value={{ live, version, mockReason, retryServer }}>{children}</DataCtx.Provider>;
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
  const { version, mockReason } = useData();
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
  }, [path, version, mockReason, nonce, lang]);

  // Previous data stays on screen while new data loads (changing the range does not flicker).
  return {
    data: state.data,
    error: state.error,
    loading: state.loading && state.data == null,
    refreshing: state.loading && state.data != null,
    reload: () => setNonce((n) => n + 1),
  };
}
