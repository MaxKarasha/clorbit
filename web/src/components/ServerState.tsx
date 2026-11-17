// Shared data-source states for the galaxy and analytics: "server is not running" and the demo-mode label.
import { t } from '../i18n';
import { enterDemo, exitDemo } from '../lib/demo';

/** Honest offline screen: no numbers, how to start the server, retry (also automatic), and an explicit demo. */
export function ServerOffline({ onRetry, checking }: { onRetry: () => void; checking: boolean }) {
  return (
    <section className="offline glass" role="alert" aria-live="assertive">
      <div className="offline__orb" aria-hidden />
      <h2 className="offline__title">{t('offline.title')}</h2>
      <p className="offline__text">{t('offline.text')}</p>
      <div className="offline__how">
        <div className="offline__how-label">{t('offline.start')}</div>
        <div className="offline__cmd">
          <code>/clorbit start</code>
          <span>{t('offline.inClaude')}</span>
        </div>
        <div className="offline__cmd">
          <code>pnpm dev</code>
          <span>{t('offline.fromSource')}</span>
        </div>
      </div>
      <div className="offline__actions">
        <button type="button" className="btn offline__retry" onClick={onRetry} disabled={checking}>
          {checking ? t('offline.checking') : t('offline.retry')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={enterDemo}>
          {t('demo.try')}
        </button>
      </div>
      <p className="offline__auto">
        <span className="offline__pulse" aria-hidden />
        {t('offline.auto')}
      </p>
    </section>
  );
}

/** The demo-mode label shown on every screen while demo mode is on, with a way out. */
export function DemoStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`demo-strip ${className}`} role="status">
      <span className="demo-strip__tag">{t('demo.chip')}</span>
      <strong>{t('demo.label')}</strong>
      <span className="demo-strip__text">{t('demo.text')}</span>
      <button type="button" className="demo-strip__exit" onClick={exitDemo}>
        {t('demo.exit')}
      </button>
    </div>
  );
}
