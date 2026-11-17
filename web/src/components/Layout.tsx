import { useEffect, type ReactNode } from 'react';
import { t, tp, type MsgKey } from '../i18n';
import { useData } from '../lib/api';
import { fmtInt, fmtPct } from '../lib/format';
import { href, presetLabel, RANGE_PRESETS, setQuery, useRange, useRoute } from '../lib/router';
import LangSwitch from './LangSwitch';
import { DemoStrip, ServerOffline } from './ServerState';
import Starfield from './Starfield';
import { cx } from './ui';

/** Analytics sections; labels are dictionary keys resolved at render time. */
export const NAV: { path: string; labelKey: MsgKey }[] = [
  { path: '/analytics/overview', labelKey: 'nav.overview' },
  { path: '/analytics/attribution', labelKey: 'nav.attribution' },
  { path: '/analytics/mcp', labelKey: 'nav.mcp' },
  { path: '/analytics/tools', labelKey: 'nav.tools' },
  { path: '/analytics/subagents', labelKey: 'nav.subagents' },
  { path: '/analytics/context', labelKey: 'nav.context' },
  { path: '/analytics/sessions', labelKey: 'nav.sessions' },
  { path: '/insights', labelKey: 'nav.insights' },
];

function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden>
      <defs>
        <radialGradient id="bm-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="45%" stopColor="#9fe0ff" />
          <stop offset="100%" stopColor="#5cc8ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="16" cy="16" rx="13" ry="5.5" fill="none" stroke="rgba(150,180,245,.45)" strokeWidth="1" transform="rotate(-24 16 16)" />
      <circle cx="16" cy="16" r="6" fill="url(#bm-core)" />
      <circle className="brand__planet" cx="27" cy="11" r="1.8" fill="#a78bfa" />
    </svg>
  );
}

function RangePicker() {
  const range = useRange();
  return (
    <div className="range" role="radiogroup" aria-label={t('nav.period')}>
      {RANGE_PRESETS.map((p) => (
        <button
          key={p.id}
          role="radio"
          aria-checked={range.preset === p.id}
          className={cx('range__btn', range.preset === p.id && 'is-active')}
          onClick={() => setQuery({ range: p.id, from: null, to: null })}
        >
          {presetLabel(p.id)}
        </button>
      ))}
      {!range.preset && <span className="range__custom mono">{range.label}</span>}
    </div>
  );
}

function ScanBanner() {
  const { live } = useData();
  if (!live || live.scan.done) return null;
  const { filesDone, filesTotal } = live.scan;
  const pct = filesTotal ? filesDone / filesTotal : 0;
  return (
    <div className="scan glass" role="status" aria-live="polite">
      <span className="scan__pulse" aria-hidden />
      <span className="scan__text">
        {t('scan.scanning')} <span className="mono">{fmtInt(filesDone)}/{fmtInt(filesTotal)}</span> {tp('scan.files', filesTotal)}
      </span>
      <span className="scan__bar" aria-hidden>
        <span style={{ width: `${pct * 100}%` }} />
      </span>
      <span className="scan__pct mono">{fmtPct(pct, 0)}</span>
      <span className="scan__note">{t('scan.note')}</span>
    </div>
  );
}

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  const route = useRoute();
  const { demo, offline, checking, retryServer } = useData();
  const active = route.path.startsWith('/session/') ? '/analytics/sessions' : route.path;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);
  return (
    <div className="shell">
      <Starfield />
      <nav className="topnav glass" aria-label={t('nav.sections')}>
        <div className="topnav__left">
          <a className="back" href={href('/')}>
            <span aria-hidden>←</span> {t('nav.galaxy')}
          </a>
          <a className="brand" href={href('/analytics/overview')}>
            <BrandMark />
            <span className="brand__name">Clorbit</span>
          </a>
        </div>
        <div className="topnav__tabs">
          {NAV.map((n) => (
            <a key={n.path} href={href(n.path, { project: null })} className={cx('tab', active === n.path && 'is-active')} aria-current={active === n.path ? 'page' : undefined}>
              {t(n.labelKey)}
            </a>
          ))}
        </div>
        <div className="topnav__right">
          <RangePicker />
          <LangSwitch className="segmented lang-switch" btnClass="segmented__btn" />
        </div>
        {demo && <DemoStrip />}
      </nav>
      {!offline && <ScanBanner />}
      <main className="page" key={route.path}>
        {offline ? <ServerOffline onRetry={retryServer} checking={checking} /> : children}
      </main>
    </div>
  );
}
