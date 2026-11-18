import { lazy, Suspense, useEffect } from 'react';
import GalaxyPage from './galaxy/GalaxyPage';
import { t, useLang } from './i18n';
import { DataProvider } from './lib/api';
import { useDemo } from './lib/demo';
import { href, useRoute } from './lib/router';
import AnalyticsLayout from './components/Layout';
import SettingsPanel from './components/SettingsPanel';
import { loadSettings, syncDemoMode, useSetting } from './lib/settings';
import NotificationCenter from './notify/NotificationCenter';
import { startMainBridge } from './console/store';

const ConsolePage = lazy(() => import('./console/ConsolePage'));
const ReplayPage = lazy(() => import('./galaxy/ReplayPage'));
import { Empty, Loading } from './components/ui';
import Overview from './pages/Overview';

const Attribution = lazy(() => import('./pages/Attribution'));
const Mcp = lazy(() => import('./pages/Mcp'));
const Tools = lazy(() => import('./pages/Tools'));
const Subagents = lazy(() => import('./pages/Subagents'));
const StartupContext = lazy(() => import('./pages/StartupContext'));
const Sessions = lazy(() => import('./pages/Sessions'));
const SessionPage = lazy(() => import('./pages/SessionPage'));
const Insights = lazy(() => import('./pages/Insights'));

function AnalyticsRoute() {
  const { parts } = useRoute();
  let page;
  if (parts[0] === 'session' && parts[1]) page = <SessionPage key={parts[1]} id={parts[1]} />;
  else if (parts[0] === 'insights') page = <Insights />;
  else if (parts[0] === 'analytics') {
    switch (parts[1] ?? 'overview') {
      case 'overview':
        page = <Overview />;
        break;
      case 'attribution':
        page = <Attribution />;
        break;
      case 'mcp':
        page = <Mcp />;
        break;
      case 'tools':
        page = <Tools />;
        break;
      case 'subagents':
        page = <Subagents />;
        break;
      case 'context':
        page = <StartupContext />;
        break;
      case 'sessions':
        page = <Sessions />;
        break;
    }
  }
  return (
    <AnalyticsLayout>
      <Suspense fallback={<Loading label={t('app.openingSection')} />}>
        {page ?? (
          <Empty title={t('app.noSection')}>
            <a className="btn" href={href('/analytics/overview')}>
              {t('app.toOverview')}
            </a>
          </Empty>
        )}
      </Suspense>
    </AnalyticsLayout>
  );
}

export default function App() {
  const { parts } = useRoute();
  // Subscribing here re-renders the whole tree when the language changes.
  useLang();
  // Entering or leaving demo mode remounts the galaxy, so no star of one data source lingers in the other.
  const demo = useDemo();
  const isConsole = parts[0] === 'console';
  useEffect(() => {
    void loadSettings();
  }, []);
  // The main tab answers console windows (focus requests, colors); a console window does not.
  useEffect(() => (isConsole ? undefined : startMainBridge()), [isConsole]);
  useEffect(() => syncDemoMode(demo), [demo]);
  // "Reduce motion" from the settings: CSS animations stop (see theme.css), canvases read the flag.
  const reduce = useSetting((s) => s.interface.reduceMotion);
  useEffect(() => {
    if (reduce) document.documentElement.dataset.reduceMotion = '1';
    else delete document.documentElement.dataset.reduceMotion;
  }, [reduce]);
  if (isConsole) {
    // A console window: no notifications or settings here (the main tab has them).
    return (
      <Suspense fallback={<Loading label={t('app.openingSection')} />}>
        <ConsolePage />
      </Suspense>
    );
  }
  return (
    <DataProvider>
      {parts.length === 0 ? (
        <GalaxyPage key={demo ? 'demo' : 'live'} />
      ) : parts[0] === 'replay' && parts[1] ? (
        // The time machine: one session replayed in the galaxy.
        <Suspense fallback={<Loading label={t('gx.replay.loading')} />}>
          <ReplayPage key={`${parts[1]}:${demo ? 'demo' : 'live'}`} id={parts[1]} />
        </Suspense>
      ) : (
        <AnalyticsRoute />
      )}
      <NotificationCenter />
      <SettingsPanel />
    </DataProvider>
  );
}
