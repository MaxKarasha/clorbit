// The time machine: one session replayed in the galaxy (#/replay/:sessionId), driven by a replay clock
// instead of live data. The scene, the console and the panels show the session as it was at the playhead.
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { SessionReplay } from '@shared/api';
import LangSwitch from '../components/LangSwitch';
import { ProfileButton } from '../components/SettingsPanel';
import { DemoStrip } from '../components/ServerState';
import { getLang, locale, t, useLang } from '../i18n';
import { apiGet } from '../lib/api';
import { isDemo } from '../lib/demo';
import { href } from '../lib/router';
import { useSetting } from '../lib/settings';
import { ConsoleDrawer, Ticker } from '../console/Console';
import { consoleStore, setColorProvider } from '../console/store';
import { GalaxyEngine, prettyModel, short, type Focus } from './engine';
import { AgentPanel, findAgent, SessionPanel } from './GalaxyPage';
import { ReplayPlayer, type PlayerView } from './replay-player';
import Scrubber from './Scrubber';
import type { Selection } from './export/ExportDialog';
import type { ExportSettings } from './export/plan';
import { fmtTok } from './format';
import './galaxy.css';
import './replay.css';

// The export dialog and its encoders load only when the dialog is opened.
const ExportDialog = lazy(() => import('./export/ExportDialog'));

/** How often a followed live session is rebuilt. */
const FOLLOW_MS = 5000;

const NO_VIEW: PlayerView = { t: 0, playing: false, speed: 'auto', rate: 1, atEnd: false, version: 0 };
const noop = () => () => {};

export default function ReplayPage({ id }: { id: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GalaxyEngine | null>(null);
  const [player, setPlayer] = useState<ReplayPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>({ t: 'none' });
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [follow, setFollow] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [demo] = useState(isDemo);
  const [exportOpen, setExportOpen] = useState(false);
  /** The export range (I / O keys, or the dialog's buttons). */
  const [sel, setSel] = useState<Selection | null>(null);
  const lang = useLang();
  const reduceMotion = useSetting((s) => s.interface.reduceMotion);
  const view = useSyncExternalStore(player?.subscribe ?? noop, player?.getView ?? (() => NO_VIEW));

  useEffect(() => {
    const eng = new GalaxyEngine(canvasRef.current!, {
      onFocus: setFocus,
      hud: () => {
        const root = rootRef.current;
        if (!root) return [];
        const hard = [...root.querySelectorAll('.gx-status, .gx-crumbs, .gx-demo, .rp-bar')].map((el) => ({ el }));
        const soft = [...root.querySelectorAll('.gx-ticker__bar, .gx-tick .cl-line, .gx-zoom-pad')].map((el) => ({ el, soft: true }));
        return [...hard, ...soft];
      },
    });
    eng.setReplayMode(true, id);
    engineRef.current = eng;
    consoleStore.reset();
    setColorProvider(eng.knownColor);
    if (import.meta.env.DEV) (window as unknown as { __galaxy?: GalaxyEngine }).__galaxy = eng;
    return () => { setColorProvider(null); eng.destroy(); consoleStore.reset(); };
  }, [id]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => { if (engineRef.current) engineRef.current.reduceMotion = reduceMotion || mq.matches; };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [reduceMotion]);

  useEffect(() => {
    document.documentElement.dataset.gx = focus.t === 'none' ? 'on' : 'panel';
  }, [focus.t]);
  useEffect(() => () => { delete document.documentElement.dataset.gx; }, []);

  // Load (and reload on a language change: status reasons are localized; the position is kept).
  const playerRef = useRef<ReplayPlayer | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    setError(null);
    apiGet<SessionReplay>(`/api/session/${encodeURIComponent(id)}/replay`, ac.signal)
      .then(({ data }) => {
        if (ac.signal.aborted || !engineRef.current) return;
        const cur = playerRef.current;
        if (cur) { cur.update(data); return; }
        const p = new ReplayPlayer(data, engineRef.current, {
          console: (lines, reset) => { if (reset) consoleStore.reset(); consoleStore.addMany(lines, null); },
        });
        playerRef.current = p;
        setPlayer(p);
        if (import.meta.env.DEV) {
          (window as unknown as { __replay?: ReplayPlayer }).__replay = p;
          // Dev-only test hook: render an export without the dialog (headless checks, determinism).
          (window as unknown as { __export?: unknown }).__export = {
            run: async (s: Partial<ExportSettings>) => {
              const m = await import('./export/run');
              const pl = await import('./export/plan');
              return m.runExport(p.replay, { format: 'mp4', size: '16:9-1080', range: null, target: 30, overlays: pl.ALL_OVERLAYS, anonymize: false, ...s });
            },
            hashes: async (s: Partial<ExportSettings>, frames: number[]) => {
              const m = await import('./export/run');
              const pl = await import('./export/plan');
              return m.frameHashes(p.replay, { format: 'mp4', size: '16:9-1080', range: null, target: 30, overlays: pl.ALL_OVERLAYS, anonymize: false, ...s }, frames);
            },
          };
        }
        // Start at once: a replay is meant to be watched.
        p.play();
      })
      .catch((e: Error) => { if (!ac.signal.aborted && !playerRef.current) setError(e.message || String(e)); });
    return () => ac.abort();
  }, [id, lang, nonce]);
  useEffect(() => () => { playerRef.current?.destroy(); playerRef.current = null; }, []);

  // Follow live: rebuild the replay every few seconds and keep playing at its end.
  useEffect(() => {
    const p = player;
    if (!p) return;
    p.follow = follow;
    if (!follow || !p.replay.live || demo) return;
    const iv = window.setInterval(() => {
      apiGet<SessionReplay>(`/api/session/${encodeURIComponent(id)}/replay`).then(({ data }) => p.update(data)).catch(() => {});
    }, FOLLOW_MS);
    return () => window.clearInterval(iv);
  }, [player, follow, id, demo]);

  // Keyboard: space play/pause, ←/→ previous/next event, shift+←/→ previous/next marker.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = playerRef.current;
      const el = e.target as HTMLElement | null;
      if (!p || (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable))) return;
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.setp')) return;
      // Inside the export dialog, space and arrows belong to its buttons.
      if (el?.closest?.('.xp') && e.key !== 'i' && e.key !== 'o') return;
      if (e.key === 'i' || e.key === 'I') setSel((s) => ({ from: p.t, to: s && s.to > p.t ? s.to : p.replay.endedAt }));
      else if (e.key === 'o' || e.key === 'O') setSel((s) => ({ from: s && s.from < p.t ? s.from : p.replay.startedAt, to: p.t }));
      else if (e.key === ' ' || e.code === 'Space') p.toggle();
      else if (e.key === 'ArrowLeft') { if (e.shiftKey) p.jump(-1); else p.step(-1); }
      else if (e.key === 'ArrowRight') { if (e.shiftKey) p.jump(1); else p.step(1); }
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const eng = engineRef.current;
  const r = player?.replay ?? null;
  // The session as it is at the playhead (re-read on every view update, a few times a second).
  const s = player && view.version ? player.snapshot().sessions[0] : null;
  const fAgent = focus.t === 'agent' && s ? findAgent(s.root, focus.agentId) : null;
  const go = (f: Focus) => engineRef.current?.setFocus(f, true);
  const onConsoleFocus = (_sid: string, aid?: string) => {
    const e = engineRef.current;
    if (!e || !r) return;
    if (aid && aid !== 'main' && e.hasBody(r.sessionId, aid)) e.setFocus({ t: 'agent', sessionId: r.sessionId, agentId: aid }, true);
    else e.setFocus({ t: 'sys', sessionId: r.sessionId }, true);
  };
  const exitHref = href('/');

  return (
    <div ref={rootRef} className={`gx gx--replay${demo ? ' gx--demo' : ''}${consoleOpen ? ' gx--console' : ''}`}>
      <canvas ref={canvasRef} className="gx-canvas" />
      <header className="gx-status rp-status">
        <div className="gx-brand"><span className="gx-logo" />Clorbit</div>
        <div className="rp-title">
          <span className="rp-chip">{t('gx.replay.title')}</span>
          {r ? (
            <div className="rp-title__text">
              <b>{r.project}</b>
              <span title={r.title ?? undefined}>{short(r.title ?? r.sessionId.slice(0, 8), 70)}</span>
              <em className="mono">{prettyModel(r.model)}{r.effort ? ` · ${r.effort}` : ''} · {new Date(r.startedAt).toLocaleString(locale(getLang()), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</em>
            </div>
          ) : (
            <div className="rp-title__text"><span>{error ? '' : t('gx.replay.loading')}</span></div>
          )}
        </div>
        {s && (
          <div className="rp-stats">
            <div><label>{t('gx.replay.tokens')}</label><b className="mono">{fmtTok(s.tokens24h)}</b></div>
            <div><label>{t('gx.replay.agents')}</label><b className="mono">{s.subagentsActive}<em> / {s.subagentsTotal}</em></b></div>
            <div><label>{t('gx.replay.context')}</label><b className="mono">{s.contextTokens && s.contextLimit ? `${Math.round((s.contextTokens / s.contextLimit) * 100)}%` : '—'}</b></div>
          </div>
        )}
        <nav className="gx-nav">
          {r && (
            <button type="button" className="gx-btn rp-export" onClick={() => setExportOpen(true)} disabled={!player} title={t('gx.export.openTitle')}>
              <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="5" width="13" height="14" rx="2.5" /><path d="M16 10l5-3v10l-5-3" /></svg>
              {t('gx.export.open')}
            </button>
          )}
          {r && <a className="gx-btn" href={href(`/session/${encodeURIComponent(r.sessionId)}`)}>{t('gx.replay.details')}</a>}
          <a className="gx-btn primary rp-exit" href={exitHref} title={t('gx.replay.exitTitle')}>{t('gx.replay.exit')}</a>
          <LangSwitch className="gx-lang" btnClass="gx-btn" />
          <ProfileButton className="prof--gx" />
        </nav>
      </header>
      {demo && <DemoStrip className="gx-demo" />}

      {r && (
        <div className="gx-crumbs">
          <button onClick={() => go({ t: 'none' })}>{t('gx.replay.crumb')}</button>
          {focus.t !== 'none' && s && (<><span>▸</span><button onClick={() => go({ t: 'sys', sessionId: s.sessionId })}>{s.project}</button></>)}
          {fAgent && fAgent.chain.slice(1).map((n) => (
            <span key={n.id} className="gx-crumb-agent"><span>▸</span><button onClick={() => go({ t: 'agent', sessionId: s!.sessionId, agentId: n.id })} style={{ color: eng?.colorOf(s!.sessionId, n.id) }}>{n.type}</button></span>
          ))}
          {r.archived && <span className="gx-pill" title={t('gx.replay.archivedTitle')}>{t('gx.replay.archived')}</span>}
          {r.sampled && <span className="gx-pill" title={t('gx.replay.sampledTitle')}>{t('gx.replay.sampled', { kept: r.sampled.tool[0], total: r.sampled.tool[1] })}</span>}
          {r.live && <span className="gx-pill rp-live">{t('gx.replay.live')}</span>}
        </div>
      )}

      {!player && (
        <div className="rp-state">
          {error ? (
            <>
              <h2>{t('gx.replay.errorTitle')}</h2>
              <p>{error}</p>
              <div className="rp-state__actions">
                <button type="button" className="gx-btn" onClick={() => setNonce((n) => n + 1)}>{t('gx.replay.retry')}</button>
                <a className="gx-btn primary" href={exitHref}>{t('gx.replay.exit')}</a>
              </div>
            </>
          ) : (
            <><span className="rp-spinner" aria-hidden /><p>{t('gx.replay.loading')}</p></>
          )}
        </div>
      )}
      {player && r && r.events.length === 0 && <div className="rp-state rp-state--soft"><p>{t('gx.replay.empty')}</p></div>}

      {s && focus.t === 'sys' && <SessionPanel s={s} eng={eng} onAgent={(aid) => go({ t: 'agent', sessionId: s.sessionId, agentId: aid })} pin={null} now={view.t} replay />}
      {s && fAgent && <AgentPanel s={s} a={fAgent.node} parent={fAgent.chain[fAgent.chain.length - 2] ?? null} eng={eng} onAgent={(aid) => go({ t: 'agent', sessionId: s.sessionId, agentId: aid })} now={view.t} />}

      {player && (
        <div className={`gx-zoom rp-zoom${focus.t !== 'none' ? ' gx-zoom--panel' : ''}`}>
          <div className="gx-zoom-pad">
            <button onClick={() => engineRef.current?.zoomBy(1.3)} title={t('gx.zoom.in')} aria-label={t('gx.zoom.in')}>+</button>
            <button onClick={() => engineRef.current?.zoomBy(1 / 1.3)} title={t('gx.zoom.out')} aria-label={t('gx.zoom.out')}>−</button>
            <button onClick={() => engineRef.current?.resetView()} title={t('gx.zoom.reset')} aria-label={t('gx.zoom.reset')}>⟲</button>
          </div>
        </div>
      )}

      {player && (consoleOpen ? (
        <ConsoleDrawer onFocus={onConsoleFocus} onClose={() => setConsoleOpen(false)} />
      ) : (
        <Ticker onFocus={onConsoleFocus} onExpand={() => setConsoleOpen(true)} />
      ))}

      {player && <Scrubber player={player} view={view} follow={r?.live && !demo ? follow : null} onFollow={setFollow} sel={sel} />}

      {player && exportOpen && (
        <Suspense fallback={null}>
          <ExportDialog
            player={player} view={view} demo={demo} sel={sel} onSel={setSel}
            onBusy={(b) => { if (engineRef.current) engineRef.current.frozen = b; }}
            onClose={() => { if (engineRef.current) engineRef.current.frozen = false; setExportOpen(false); }}
          />
        </Suspense>
      )}
    </div>
  );
}
