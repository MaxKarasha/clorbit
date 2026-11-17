// `#/console`: the event console alone, for a separate window. Live: recent history + the event
// stream; demo: its own seeded demo feed. Clicks focus the galaxy in the main tab (store.ts bridge).
import { useEffect } from 'react';
import type { LiveSnapshot, RecentEvent } from '@shared/api';
import Starfield from '../components/Starfield';
import { DemoStrip } from '../components/ServerState';
import { t, useLang, withLang } from '../i18n';
import { useDemo } from '../lib/demo';
import { MockFeed } from '../galaxy/mock';
import { ConsolePanel } from './Console';
import { consoleStore, focusInMain, loadRecent, startWindowBridge } from './store';

export default function ConsolePage() {
  const demo = useDemo();
  const lang = useLang();

  useEffect(() => {
    document.title = `${t('cl.title')} · Clorbit`;
  }, [lang]);

  useEffect(() => startWindowBridge(), []);

  useEffect(() => {
    consoleStore.reset();
    let snap: LiveSnapshot | null = null;
    if (demo) {
      const m = new MockFeed((s) => { snap = s; }, (e) => consoleStore.add(e, snap));
      return () => m.stop();
    }
    let es: EventSource | null = null;
    let stop = false;
    const open = () => {
      es?.close();
      es = new EventSource(withLang('/api/events'));
      es.onmessage = (m) => {
        try {
          consoleStore.add(JSON.parse(m.data) as RecentEvent, null);
        } catch {
          /* service message */
        }
      };
      // An EventSource that got an error response does not reconnect by itself.
      es.onerror = () => {
        if (es?.readyState === EventSource.CLOSED && !stop) window.setTimeout(() => !stop && (loadRecent(), open()), 4000);
      };
    };
    void loadRecent();
    open();
    return () => {
      stop = true;
      es?.close();
    };
  }, [demo, lang]);

  return (
    <div className="cl-page">
      <Starfield />
      {demo && <DemoStrip className="cl-page__demo" />}
      <ConsolePanel variant="window" onFocus={(sid, aid) => focusInMain(sid, aid)} />
    </div>
  );
}
