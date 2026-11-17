// Notification center: detects events in live data (shared detector) and delivers them as sounds,
// browser notifications and in-app toasts according to the settings. Mounted once at the app root.
import { useEffect, useRef, useState } from 'react';
import type { ClorbitEvent, LiveSnapshot } from '@shared/api';
import { NotifyDetector, type DetectResult, type NotifyEvent } from '@shared/notify';
import { locale, t, withLang } from '../i18n';
import { useDemo } from '../lib/demo';
import { getAbout, getSettings, loadAbout, updateSettings, useSettings } from '../lib/settings';
import { feed, focusSession } from './feed';
import { channelsFor, EVENT_COLOR, eventLabel, notifyBody, pruneToasts, pushToast, type Toast } from './rules';
import { playSound, unlockAudioOnGesture } from './sound';

function permission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

function browserNotify(ev: NotifyEvent, body: string) {
  try {
    const n = new Notification('Clorbit', { body, tag: `clorbit:${ev.type}:${ev.sessionId ?? ev.window ?? ''}`, silent: true });
    n.onclick = () => {
      window.focus();
      focusSession(ev.sessionId);
      n.close();
    };
  } catch {
    /* some platforms only allow notifications from a service worker */
  }
}

/** Watches the server directly while no page publishes live data (analytics pages). */
function useOwnWatcher(active: boolean, onSnap: (s: LiveSnapshot) => void, onEvent: (e: ClorbitEvent) => void) {
  const cb = useRef({ onSnap, onEvent });
  cb.current = { onSnap, onEvent };
  useEffect(() => {
    if (!active) return;
    let stop = false;
    let es: EventSource | null = null;
    const open = () => {
      es?.close();
      es = new EventSource(withLang('/api/events'));
      es.onmessage = (m) => {
        try {
          cb.current.onEvent(JSON.parse(m.data) as ClorbitEvent);
        } catch {
          /* service message */
        }
      };
    };
    const poll = async () => {
      try {
        const r = await fetch(withLang('/api/live'), { headers: { accept: 'application/json' } });
        if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error(String(r.status));
        const s = (await r.json()) as LiveSnapshot;
        if (stop) return;
        if (!es || es.readyState === EventSource.CLOSED) open();
        cb.current.onSnap(s);
      } catch {
        /* offline: the layout says so; keep trying */
      }
    };
    poll();
    const iv = window.setInterval(poll, 5000);
    return () => {
      stop = true;
      window.clearInterval(iv);
      es?.close();
    };
  }, [active]);
}

/** Automated runs notify only when they are shown as separate stars (Settings → Interface). */
const includeAutomated = () => getSettings().interface.showAutomated;

export default function NotificationCenter() {
  const demo = useDemo();
  const settings = useSettings();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sources, setSources] = useState(feed.sources);
  const detector = useRef(new NotifyDetector(includeAutomated));
  const nextId = useRef(0);

  useEffect(() => unlockAudioOnGesture(), []);
  useEffect(() => feed.onSources(() => setSources(feed.sources)), []);
  useEffect(() => {
    if (!demo) void loadAbout();
  }, [demo]);

  // A new data source (demo ↔ live) starts from a fresh baseline.
  useEffect(() => {
    detector.current = new NotifyDetector(includeAutomated);
    setToasts([]);
  }, [demo]);

  const handle = (res: DetectResult) => {
    const now = Date.now();
    const s = getSettings();
    let next: Toast[] | null = null;
    for (const ev of res.events) {
      const ch = channelsFor(ev.type, s, {
        now,
        demo,
        hidden: document.hidden,
        permission: permission(),
        systemAvailable: !!getAbout()?.system.available,
      });
      if (ch.sound) playSound(ev.type, s.sound.theme, s.sound.volume);
      if (ch.browser) browserNotify(ev, notifyBody(ev));
      if (ch.toast) next = pushToast(next ?? [], ev, ++nextId.current, now);
    }
    if (next || res.resolved.length) {
      const added = next ?? [];
      setToasts((cur) => {
        let l = pruneToasts(cur, now, res.resolved);
        // Re-run the merge rules against what is already on screen.
        for (const x of [...added].reverse()) l = pushToast(l, x.ev, x.id, now);
        return l;
      });
    }
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(
    () =>
      feed.listen({
        snapshot: (s) => handleRef.current(detector.current.onSnapshot(s)),
        event: (e) => handleRef.current(detector.current.onEvent(e)),
      }),
    [],
  );
  useOwnWatcher(
    sources === 0 && !demo,
    (s) => handleRef.current(detector.current.onSnapshot(s)),
    (e) => handleRef.current(detector.current.onEvent(e)),
  );

  // Expiry of non-sticky toasts.
  useEffect(() => {
    if (!toasts.some((x) => !x.sticky)) return;
    const iv = window.setInterval(() => setToasts((cur) => pruneToasts(cur, Date.now())), 1000);
    return () => window.clearInterval(iv);
  }, [toasts]);

  const dismiss = (id: number) => setToasts((cur) => cur.filter((x) => x.id !== id));
  const mutedUntil = settings.dnd.mutedUntil && settings.dnd.mutedUntil > Date.now() ? settings.dnd.mutedUntil : null;
  const clock = (ts: number) => new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

  return (
    <section className="toasts" aria-label={t('toast.region')} aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={`toast toast--${x.type}`} style={{ ['--acc' as string]: EVENT_COLOR[x.type] }} role={x.type === 'session_waiting' ? 'alert' : 'status'}>
          <button
            type="button"
            className="toast__main"
            onClick={() => {
              focusSession(x.sessionId);
              if (x.type !== 'session_waiting') dismiss(x.id);
            }}
            disabled={!x.sessionId}
            title={x.sessionId ? t('toast.open') : undefined}
          >
            <span className="toast__sig" aria-hidden />
            <span className="toast__text">
              <span className="toast__kind">{eventLabel(x.type)}</span>
              <span className="toast__body">{notifyBody(x.ev)}</span>
            </span>
          </button>
          <div className="toast__actions">
            {mutedUntil ? (
              <span className="toast__muted">{t('toast.muted', { time: clock(mutedUntil) })}</span>
            ) : (
              <button type="button" className="toast__act" onClick={() => updateSettings({ dnd: { mutedUntil: Date.now() + 3_600_000 } })}>
                {t('toast.mute')}
              </button>
            )}
            <button type="button" className="toast__close" onClick={() => dismiss(x.id)} aria-label={t('toast.close')} title={t('toast.close')}>
              ×
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
