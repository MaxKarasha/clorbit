// Home page: the galaxy of sessions and agents + HUD (status bar, panels, event ticker).
import { useEffect, useRef, useState } from 'react';
import type { AgentNode, AnalyticsOverview, ClorbitEvent, LiveSession, LiveSnapshot, WindowForecast } from '@shared/api';
import LangSwitch from '../components/LangSwitch';
import { ProfileButton } from '../components/SettingsPanel';
import { DemoStrip, ServerOffline } from '../components/ServerState';
import { t, tp, useLang, withLang, type MsgKey } from '../i18n';
import { enterDemo, isDemo } from '../lib/demo';
import { href } from '../lib/router';
import { getSettings, onLayoutReset, openSettings, resetLayout, updateSettings, useSetting } from '../lib/settings';
import { forecastView, SEV_COLOR, whenText, type Severity } from '../lib/forecast';
import { feed, focusSession, onFocusRequest, takePendingFocus, type FocusRequest } from '../notify/feed';
import { ConsoleDrawer, popOutConsole, Ticker } from '../console/Console';
import { consoleStore, loadRecent, projectColor, setColorProvider, setColorSource, shareColors } from '../console/store';
import { GalaxyEngine, prettyModel, short, type Focus } from './engine';
import { MockFeed } from './mock';
import type { ClusterInfo } from './plan';
import { clusterPinKey, prunePins, starPinKey, withoutPin } from './gravity';
import { fmtAgo, fmtDur, fmtPct, fmtTok, tSum } from './format';
import './galaxy.css';

const statusWord = (s: string) => (['working', 'waiting', 'idle', 'stopped', 'done'].includes(s) ? t(`gx.status.${s}` as MsgKey) : '');

function findAgent(root: AgentNode, id: string): { node: AgentNode; chain: AgentNode[] } | null {
  if (root.id === id) return { node: root, chain: [root] };
  for (const c of root.children) {
    const r = findAgent(c, id);
    if (r) return { node: r.node, chain: [root, ...r.chain] };
  }
  return null;
}

export default function GalaxyPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GalaxyEngine | null>(null);
  const snapRef = useRef<LiveSnapshot | null>(null);
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [focus, setFocus] = useState<Focus>({ t: 'none' });
  const [consoleOpen, setConsoleOpen] = useState(false);
  // Demo mode is fixed for the lifetime of this component: App remounts the galaxy when it changes.
  const [demo] = useState(isDemo);
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const retryRef = useRef<() => void>(() => {});
  const [legend, setLegend] = useState(false);
  // Auto tour is opt-in; it lives in the settings (the HUD button is a quick switch).
  const tour = useSetting((s) => s.interface.autoTour);
  const setTour = (v: boolean) => updateSettings({ interface: { autoTour: v } });
  const reduceMotion = useSetting((s) => s.interface.reduceMotion);
  const showAutomated = useSetting((s) => s.interface.showAutomated);
  const gravity = useSetting((s) => s.layout.gravity);
  const pins = useSetting((s) => s.layout.pins);
  const lang = useLang();

  /** Focuses a session, or one of its live agents (a finished agent falls back to its session). */
  function focusOn(f: FocusRequest) {
    const eng = engineRef.current;
    const s = snapRef.current?.sessions.find((x) => x.sessionId === f.sessionId);
    if (!eng || !s) return;
    // A session folded into a cluster is taken out of it as a star first.
    eng.reveal(f.sessionId, f.agentId && f.agentId !== 'main' && findAgent(s.root, f.agentId) ? f.agentId : undefined);
  }

  useEffect(() => {
    const eng = new GalaxyEngine(canvasRef.current!, {
      onFocus: setFocus,
      onDistant: (p) => { location.hash = href('/analytics/sessions', { project: p, range: '30d' }); },
      hud: () => {
        const root = rootRef.current;
        if (!root) return [];
        const hard = [...root.querySelectorAll('.gx-status, .gx-crumbs, .gx-demo')].map((el) => ({ el }));
        const soft = [...root.querySelectorAll('.gx-ticker__bar, .gx-tick .cl-line, .gx-zoom-pad, .gx-zoom-hint')].map((el) => ({ el, soft: true }));
        return [...hard, ...soft];
      },
      // Edge chips stay inside what the HUD leaves free and step around the rest.
      edges: () => {
        const root = rootRef.current;
        if (!root) return { cuts: [], avoid: [] };
        const all = (sel: string) => [...root.querySelectorAll(sel)];
        return {
          cuts: [
            ...all('.gx-status, .gx-crumbs, .gx-demo, .gx-banner').map((el) => ({ el, side: 'top' as const })),
            ...all('.gx-panel').map((el) => ({ el, side: 'right' as const })),
            ...all('.gx-console').map((el) => ({ el, side: 'bottom' as const })),
          ],
          avoid: [...all('.gx-ticker__bar, .gx-tick, .gx-zoom-pad, .gx-zoom-hint, .gx-legend'), ...document.querySelectorAll('.toast')],
        };
      },
      // Pins are a setting (saved on the server; only in memory in demo mode).
      onPins: (p) => updateSettings({ layout: { pins: p } }),
    });
    engineRef.current = eng;
    // The console takes its colors from the scene (and shares them with console windows).
    consoleStore.reset();
    setColorProvider(eng.knownColor);
    setColorSource(eng.colorMap);
    if (import.meta.env.DEV) (window as unknown as { __galaxy?: GalaxyEngine }).__galaxy = eng;
    return () => { setColorProvider(null); setColorSource(null); eng.destroy(); };
  }, []);

  useEffect(() => { if (engineRef.current) engineRef.current.tourOn = tour; }, [tour]);
  useEffect(() => { engineRef.current?.setShowAutomated(showAutomated); }, [showAutomated]);
  useEffect(() => { engineRef.current?.setGravity(gravity); }, [gravity]);
  useEffect(() => { engineRef.current?.setPins(pins); }, [pins]);
  useEffect(() => onLayoutReset(() => engineRef.current?.resetLayout()), []);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => { if (engineRef.current) engineRef.current.reduceMotion = reduceMotion || mq.matches; };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [reduceMotion]);

  // Toasts and browser notifications ask to focus a session.
  useEffect(() => onFocusRequest(focusOn), []);
  // Toasts sit above the zoom controls and move left when a side panel is open (styles/settings.css).
  useEffect(() => {
    document.documentElement.dataset.gx = focus.t === 'none' ? 'on' : 'panel';
  }, [focus.t]);
  useEffect(() => () => { delete document.documentElement.dataset.gx; }, []);

  // Data: the real server or the demo feed.
  useEffect(() => {
    // The notification center listens to what this page receives (no second connection).
    const detach = feed.attachSource();
    const onSnap = (s: LiveSnapshot) => {
      snapRef.current = s; setSnap(s); engineRef.current?.sync(s);
      // Pins of sessions that are gone are dropped lazily (never while the history scan may still be incomplete).
      if (s.scan.done) {
        const pruned = prunePins(getSettings().layout.pins, s.sessions);
        if (pruned) updateSettings({ layout: { pins: pruned } });
      }
      feed.snapshot(s);
      shareColors();
      const pending = takePendingFocus();
      if (pending) focusOn(pending);
    };
    const onEvent = (e: ClorbitEvent) => {
      engineRef.current?.pushEvent(e);
      feed.event(e);
      consoleStore.add(e, snapRef.current);
    };
    if (demo) {
      const m = new MockFeed(onSnap, onEvent);
      return () => { m.stop(); detach(); };
    }
    let alive = true;
    let fails = 0;
    let down = false;
    let es: EventSource | null = null;
    const openEvents = () => {
      es?.close();
      es = new EventSource(withLang('/api/events', lang));
      es.onmessage = (m) => { try { onEvent(JSON.parse(m.data) as ClorbitEvent); } catch { /* skip service messages */ } };
    };
    const loadDistant = async () => {
      try {
        const d = (n: number) => { const x = new Date(Date.now() - n * 86400e3); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
        const r = await fetch(withLang(`/api/analytics/overview?from=${d(29)}&to=${d(0)}`, lang));
        if (!r.ok) return;
        const o = (await r.json()) as AnalyticsOverview;
        engineRef.current?.setDistant(o.projects.map((p) => ({ name: p.label, total: p.total, sessions: p.sessions })));
      } catch { /* distant stars are optional */ }
    };
    // No demo substitution: when the server is unreachable the page says so and keeps polling.
    const load = async () => {
      try {
        const r = await fetch(withLang('/api/live', lang));
        if (!r.ok) throw new Error(String(r.status));
        const s = (await r.json()) as LiveSnapshot;
        if (!alive) return;
        fails = 0;
        if (down) {
          // Back online, silently: an EventSource that got an error response does not reconnect by itself.
          down = false;
          if (!es || es.readyState === EventSource.CLOSED) openEvents();
          loadDistant();
        }
        setOffline(false);
        onSnap(s);
      } catch {
        // Before the first snapshot one failure is enough; afterwards ignore a single blip (e.g. a dev restart).
        if (alive && (++fails >= 2 || !snapRef.current)) {
          down = true;
          setOffline(true);
        }
      } finally {
        if (alive) setChecking(false);
      }
    };
    retryRef.current = () => { setChecking(true); load(); };
    load();
    loadDistant();
    openEvents();
    const iv2 = window.setInterval(loadDistant, 120000);
    const iv = window.setInterval(load, 3000);
    return () => { alive = false; clearInterval(iv); clearInterval(iv2); es?.close(); detach(); };
  }, [demo, lang]);

  const openConsole = () => {
    setConsoleOpen(true);
    if (!demo) void loadRecent();
  };
  const eng = engineRef.current;
  const fSession: LiveSession | undefined = focus.t === 'sys' || focus.t === 'agent' ? snap?.sessions.find((s) => s.sessionId === focus.sessionId) : undefined;
  // Read on every render (snapshots re-render the page), so the list follows the cluster.
  const fCluster: ClusterInfo | null = focus.t === 'cluster' ? eng?.cluster(focus.project) ?? null : null;
  const fAgent = focus.t === 'agent' && fSession ? findAgent(fSession.root, focus.agentId) : null;
  const go = (f: Focus) => engineRef.current?.setFocus(f, true);
  /** The panel's "Pinned here · Unpin" row, when the focused body is pinned. */
  const pinOf = (key: string) => (key in pins ? () => updateSettings({ layout: { pins: withoutPin(getSettings().layout.pins, key) } }) : null);

  // Numbers are shown only while they are current: never stale ones under the offline screen.
  const shown = offline ? null : snap;

  return (
    <div ref={rootRef} className={`gx${demo ? ' gx--demo' : ''}`}>
      <canvas ref={canvasRef} className="gx-canvas" />
      <header className="gx-status">
        <div className="gx-brand"><span className="gx-logo" />Clorbit</div>
        <div className={`gx-metrics${shown && !shown.limits ? ' gx-metrics--hint' : ''}`}>{shown && <StatusMetrics snap={shown} />}</div>
        <nav className="gx-nav">
          <a className="gx-btn" href={href('/analytics/overview')}>{t('gx.nav.analytics')}</a>
          <a className="gx-btn" href={href('/analytics/context')}>{t('gx.nav.context')}</a>
          <a className="gx-btn" href={href('/insights')}>{t('gx.nav.insights')}</a>
          <button className={`gx-btn ${tour ? 'on' : ''}`} onClick={() => setTour(!tour)} title={t('gx.nav.tourTitle')}>{t('gx.nav.tour')}</button>
          <button className="gx-btn" onClick={() => setLegend(!legend)} title={t('gx.nav.legendTitle')}>?</button>
          <LangSwitch className="gx-lang" btnClass="gx-btn" />
          <ProfileButton className="prof--gx" />
        </nav>
      </header>
      {demo && <DemoStrip className="gx-demo" />}

      <div className="gx-crumbs">
        <button onClick={() => go({ t: 'none' })}>{t('gx.crumbs.fleet')}</button>
        {fSession && (<><span>▸</span><button onClick={() => go({ t: 'sys', sessionId: fSession.sessionId })}>{fSession.project}</button></>)}
        {fCluster && (<><span>▸</span><button onClick={() => go({ t: 'cluster', project: fCluster.project })}>{t('gx.crumbs.cluster', { project: fCluster.project })}</button></>)}
        {fAgent && fAgent.chain.slice(1).map((n) => (
          <span key={n.id} className="gx-crumb-agent"><span>▸</span><button onClick={() => go({ t: 'agent', sessionId: fSession!.sessionId, agentId: n.id })} style={{ color: eng?.colorOf(fSession!.sessionId, n.id) }}>{n.type}</button></span>
        ))}
        {focus.t !== 'none' && <em>{t('gx.crumbs.hint')}</em>}
        {shown && !demo && !shown.hooksInstalled && <span className="gx-pill" title={t('gx.bar.noHooksTitle')}>{t('gx.bar.noHooks')}</span>}
      </div>

      {shown && !shown.scan.done && !demo && (
        <div className="gx-banner">{t('gx.scanning', { done: shown.scan.filesDone, total: shown.scan.filesTotal })}</div>
      )}
      {shown && shown.sessions.length === 0 && !demo && (
        <div className="gx-empty">
          <h2>{t('gx.empty.title')}</h2>
          <p>{t('gx.empty.text', { cmd: '`claude`' }).split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</p>
          <button type="button" className="gx-btn" onClick={enterDemo}>{t('demo.try')}</button>
        </div>
      )}
      {offline && (
        <div className="gx-offline">
          <ServerOffline onRetry={() => retryRef.current()} checking={checking} />
        </div>
      )}

      {!offline && fSession && focus.t === 'sys' && <SessionPanel s={fSession} eng={eng} onAgent={(id) => go({ t: 'agent', sessionId: fSession.sessionId, agentId: id })} pin={pinOf(starPinKey(fSession.project, fSession.sessionId))} />}
      {!offline && fCluster && <ClusterPanel c={fCluster} onReveal={(id) => engineRef.current?.reveal(id)} pin={pinOf(clusterPinKey(fCluster.project))} />}
      {!offline && fSession && fAgent && <AgentPanel s={fSession} a={fAgent.node} parent={fAgent.chain[fAgent.chain.length - 2] ?? null} eng={eng} onAgent={(id) => go({ t: 'agent', sessionId: fSession.sessionId, agentId: id })} />}

      {!offline && (
        <div className={`gx-zoom${focus.t !== 'none' ? ' gx-zoom--panel' : ''}`}>
          <div className="gx-zoom-pad">
            <button onClick={() => engineRef.current?.zoomBy(1.3)} title={t('gx.zoom.in')} aria-label={t('gx.zoom.in')}>+</button>
            <button onClick={() => engineRef.current?.zoomBy(1 / 1.3)} title={t('gx.zoom.out')} aria-label={t('gx.zoom.out')}>−</button>
            <button onClick={() => engineRef.current?.resetView()} title={t('gx.zoom.reset')} aria-label={t('gx.zoom.reset')}>⟲</button>
            <button className="gx-zoom-layout" onClick={resetLayout} title={t('gx.zoom.layout')} aria-label={t('gx.zoom.layout')}>
              <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="7.5" strokeOpacity=".45" strokeDasharray="2 3" />
                <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
              </svg>
            </button>
          </div>
          <div className="gx-zoom-hint">{t('gx.zoom.hint')}</div>
        </div>
      )}

      {consoleOpen ? (
        <ConsoleDrawer onFocus={(sid, aid) => focusSession(sid, aid)} onClose={() => setConsoleOpen(false)} onPopOut={popOutConsole} />
      ) : (
        <Ticker onFocus={(sid, aid) => focusSession(sid, aid)} onExpand={openConsole} onPopOut={popOutConsole} />
      )}

      {legend && <Legend onClose={() => setLegend(false)} />}
    </div>
  );
}

function quote(t: string, n: number) {
  const s = short(t.trim(), n);
  return /^[«"“]/.test(s) ? s : `«${s}»`;
}

/* ---------------- status bar ---------------- */

function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const w = 96, h = 26;
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - (v / max) * (h - 3) - 1}`).join(' ');
  return (
    <svg className="gx-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7FD6FF" stopOpacity=".55" /><stop offset="1" stopColor="#7FD6FF" stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#sg)" />
      <polyline points={pts} fill="none" stroke="#9FE3FF" strokeWidth="1.4" />
    </svg>
  );
}


/**
 * A subscription ring with a "fuel gauge" feel: the arc is the used %, a faint arc runs on to the
 * projected % at the reset, and a thin tick marks that projection.
 */
function Ring({ pct, tick, sev, label, sub, title }: { pct: number | null; tick: number | null; sev: Severity; label: string; sub: string; title?: string }) {
  const r = 15, c = 2 * Math.PI * r, f = pct == null ? 0 : Math.min(1, Math.max(0, pct / 100));
  const col = pct == null ? '#56607A' : pct > 85 ? '#FF6B8B' : pct > 60 ? '#FFD66B' : '#7FE0C4';
  const tk = tick == null ? null : Math.min(1, Math.max(0, tick / 100));
  const tickCol = sev === 'none' ? '#E6EBF5' : SEV_COLOR[sev];
  return (
    <div className={`gx-ring gx-ring--${sev}`} title={title}>
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r={r} stroke="rgba(150,170,220,.15)" strokeWidth="4" fill="none" />
        {tk != null && tk > f + 0.004 && (
          <circle cx="20" cy="20" r={r} stroke={tickCol} strokeOpacity=".3" strokeWidth="4" fill="none" strokeDasharray={`0 ${c * f} ${c * (tk - f)} ${c}`} transform="rotate(-90 20 20)" />
        )}
        <circle cx="20" cy="20" r={r} stroke={col} strokeWidth="4" fill="none" strokeDasharray={`${c * f} ${c}`} strokeLinecap="round" transform="rotate(-90 20 20)" style={{ filter: `drop-shadow(0 0 4px ${col})` }} />
        {tk != null && (
          <line x1="20" y1={20 - r + 4} x2="20" y2={20 - r - 4} stroke={tickCol} strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${tk * 360} 20 20)`} className="gx-ring-tick" style={{ filter: `drop-shadow(0 0 2px ${tickCol})` }} />
        )}
        <text x="20" y="23.5" textAnchor="middle" className="gx-ring-t">{pct == null ? '—' : Math.round(pct)}</text>
      </svg>
      <div><b>{label}</b><span className={`gx-fc gx-fc--${sev}`}>{sub}</span></div>
    </div>
  );
}

function LimitRing({ f, pct, resetsAt, label, now }: { f: WindowForecast | null | undefined; pct: number | null; resetsAt: number | null; label: string; now: number }) {
  if (!f) {
    // A server without the forecast (older than 0.3): the plain ring with the reset time.
    const sub = resetsAt ? t('gx.bar.resets', { at: whenText(resetsAt, now) }) : '';
    return <Ring pct={pct} tick={null} sev="none" label={label} sub={sub} />;
  }
  const v = forecastView(f, label, now);
  return <Ring pct={f.pct ?? pct} tick={v.tick} sev={v.sev} label={label} sub={v.sub} title={v.title} />;
}

/** The metrics of the HUD bar, in priority order; lower-priority ones give way on narrow screens (galaxy.css). */
function StatusMetrics({ snap }: { snap: LiveSnapshot }) {
  const tt = snap.totals;
  const L = snap.limits;
  const F = snap.limitsForecast?.source === 'statusline' ? snap.limitsForecast : null;
  return (
    <>
      <div className="gx-metric tokens">
        <label>{t('gx.bar.tokens24h')}</label>
        <div className="gx-row"><strong>{fmtTok(tSum(tt.tokens24h))}</strong><Spark data={tt.burnSeries} /></div>
        <span>{t('gx.bar.todayOut', { today: fmtTok(tSum(tt.tokensToday)), out: fmtTok(tt.tokens24h.output) })}</span>
      </div>
      <div className="gx-metric speed">
        <label>{t('gx.bar.speed')}</label>
        <strong>{fmtTok(tt.burnPerMin)}<em>{t('gx.bar.perMin')}</em></strong>
        <span>{t('gx.bar.last10')}</span>
      </div>
      <div className="gx-metric limits">
        <label>{t('gx.bar.plan')}</label>
        {L ? (
          <div className="gx-row">
            <LimitRing f={F?.fiveHour} pct={L.fiveHourPct} resetsAt={L.fiveHourResetsAt} label={t('gx.bar.5h')} now={snap.now} />
            <LimitRing f={F?.sevenDay} pct={L.sevenDayPct} resetsAt={L.sevenDayResetsAt} label={t('gx.bar.7d')} now={snap.now} />
          </div>
        ) : (
          <span className="gx-hint" title={t('gx.bar.noSourceTitle')}>
            {t('gx.bar.noSource')} ·{' '}
            <button type="button" className="gx-linkbtn" onClick={(e) => openSettings(e.currentTarget, 'connection')}>{t('gx.bar.howTo')}</button>
          </span>
        )}
      </div>
      <div className="gx-metric sessions">
        <label>{t('gx.bar.sessions')}</label>
        <strong>{tt.activeSessions}<em>{t('gx.bar.live')}</em></strong>
        <span><i className="dot work" />{t('gx.bar.working', { n: tt.workingSessions })} {tt.waitingSessions > 0 && <b className="wait"><i className="dot wait" />{t('gx.bar.waiting', { n: tt.waitingSessions })}</b>}</span>
      </div>
      <div className="gx-metric subagents">
        <label>{t('gx.bar.subagents')}</label>
        <strong>{tt.workingSubagents}<em>{t('gx.bar.now')}</em></strong>
        <span>{t('gx.bar.finished24h', { n: tt.finishedSubagents24h })}</span>
      </div>
      <div className="gx-metric cache">
        <label>{t('gx.bar.cache')}</label>
        <strong>{fmtPct(tt.cacheHitRate24h)}</strong>
        <span>{t('gx.bar.projects24h', { n: tt.projects24h })}</span>
      </div>
    </>
  );
}

/* ---------------- panels ---------------- */

function TokBars({ t: tk }: { t: { input: number; output: number; cacheRead: number; cacheWrite: number } }) {
  const total = Math.max(1, tSum(tk));
  const parts: [string, number, string][] = [[t('gx.tok.cacheRead'), tk.cacheRead, '#6E8BFF'], [t('gx.tok.cacheWrite'), tk.cacheWrite, '#B58CFF'], [t('gx.tok.input'), tk.input, '#5CC8FF'], [t('gx.tok.output'), tk.output, '#7FE0C4']];
  return (
    <div className="gx-tokbars">
      <div className="gx-stack">{parts.map(([k, v, c]) => <i key={k} style={{ width: `${(v / total) * 100}%`, background: c }} />)}</div>
      <div className="gx-legend-row">{parts.map(([k, v, c]) => <span key={k}><i style={{ background: c }} />{k} {fmtTok(v)}</span>)}</div>
    </div>
  );
}

function Tree({ s, node, eng, onAgent, depth = 0 }: { s: LiveSession; node: AgentNode; eng: GalaxyEngine | null; onAgent: (id: string) => void; depth?: number }) {
  return (
    <>
      <button className="gx-tree-row" style={{ paddingLeft: 10 + depth * 16 }} onClick={() => node.depth && onAgent(node.id)} disabled={!node.depth}>
        <i className="dot" style={{ background: eng?.colorOf(s.sessionId, node.id), boxShadow: `0 0 8px ${eng?.colorOf(s.sessionId, node.id)}` }} />
        <b>{node.depth ? node.type : t('gx.manager')}</b>
        <span>{short(node.currentTool ?? statusWord(node.status), 34)}</span>
        <em>{fmtTok(tSum(node.tokens))}</em>
      </button>
      {node.children.map((c) => <Tree key={c.id} s={s} node={c} eng={eng} onAgent={onAgent} depth={depth + 1} />)}
    </>
  );
}

/** "Pinned here · Unpin" under a pinned body's panel header. */
function PinRow({ onUnpin }: { onUnpin: () => void }) {
  return (
    <div className="gx-pinrow">
      <span><i aria-hidden className="gx-pinrow__glyph" />{t('gx.panel.pinned')}</span>
      <button type="button" className="gx-btn" onClick={onUnpin} title={t('gx.panel.unpinTitle')}>{t('gx.panel.unpin')}</button>
    </div>
  );
}

function SessionPanel({ s, eng, onAgent, pin }: { s: LiveSession; eng: GalaxyEngine | null; onAgent: (id: string) => void; pin: (() => void) | null }) {
  const ctx = s.contextTokens && s.contextLimit ? s.contextTokens / s.contextLimit : null;
  const col = eng?.colorOf(s.sessionId, 'main');
  return (
    <aside className="gx-panel" style={{ ['--acc' as string]: col }}>
      <div className="gx-panel-head">
        <span className={`gx-status-chip ${s.status}`}>{statusWord(s.status)}</span>
        <h3>{s.project}</h3>
        <p>{s.title ?? s.name ?? s.sessionId.slice(0, 8)}</p>
        <div className="gx-meta">{prettyModel(s.model)}{s.effort && <> · {t('gx.panel.effort')} <b>{s.effort}</b></>}{s.gitBranch && <> · {s.gitBranch}</>}{s.kind === 'automated' && <> · <span className="gx-kind">{t('gx.panel.automatedRun')}</span></>}</div>
      </div>
      {pin && <PinRow onUnpin={pin} />}
      {s.statusReason && <div className={`gx-reason ${s.status}`}>{s.statusReason}</div>}
      {s.root.lastText && <blockquote className="gx-quote">{quote(s.root.lastText, 220)}</blockquote>}
      <div className="gx-grid">
        <div><label>{t('gx.panel.sessionTokens')}</label><b>{fmtTok(tSum(s.tokens))}</b></div>
        <div><label>{t('gx.panel.24h')}</label><b>{fmtTok(s.tokens24h)}</b></div>
        <div><label>{t('gx.panel.subagents')}</label><b>{s.subagentsActive}<em> / {s.subagentsTotal}</em></b></div>
        <div><label>{t('gx.panel.compactions')}</label><b>{s.compactions}</b></div>
        <div><label>{t('gx.panel.running')}</label><b>{fmtDur(Date.now() - s.startedAt)}</b></div>
        <div><label>{t('gx.panel.activity')}</label><b>{fmtAgo(s.lastActivity)}</b></div>
      </div>
      {ctx != null && (
        <div className="gx-ctx">
          <label>{t('gx.panel.context', { used: fmtTok(s.contextTokens!), limit: fmtTok(s.contextLimit!) })}</label>
          <div className="gx-bar"><i style={{ width: `${Math.min(100, ctx * 100)}%`, background: ctx > 0.85 ? '#FF6B8B' : col }} /></div>
        </div>
      )}
      <TokBars t={s.tokens} />
      <h4>{t('gx.panel.hierarchy')}</h4>
      <div className="gx-tree"><Tree s={s} node={s.root} eng={eng} onAgent={onAgent} /></div>
      <div className="gx-actions">
        <a className="gx-btn primary" href={href(`/session/${encodeURIComponent(s.sessionId)}`)}>{t('gx.panel.details')}</a>
        <a className="gx-btn" href={href('/analytics/sessions', { project: s.project })}>{t('gx.panel.allSessions', { project: s.project })}</a>
      </div>
    </aside>
  );
}

function AgentPanel({ s, a, parent, eng, onAgent }: { s: LiveSession; a: AgentNode; parent: AgentNode | null; eng: GalaxyEngine | null; onAgent: (id: string) => void }) {
  const col = eng?.colorOf(s.sessionId, a.id);
  return (
    <aside className="gx-panel" style={{ ['--acc' as string]: col }}>
      <div className="gx-panel-head">
        <span className={`gx-status-chip ${a.status}`}>{statusWord(a.status)}</span>
        <h3 style={{ color: col }}>{a.type}</h3>
        <p>{t('gx.panel.level', { depth: a.depth, parent: parent ? (parent.depth ? parent.type : t('gx.panel.toManager')) : '—' })}</p>
        <div className="gx-meta">{prettyModel(a.model)}{a.effort && <> · {t('gx.panel.effort')} <b>{a.effort}</b></>}</div>
      </div>
      <h4>{t('gx.panel.task')}</h4>
      <p className="gx-task">{a.description ?? '—'}</p>
      <h4>{t('gx.panel.doingNow')}</h4>
      <p className="gx-now">{a.currentTool ?? '—'}</p>
      <h4>{t('gx.panel.lastThought')}</h4>
      <blockquote className="gx-quote">{a.lastText ? quote(a.lastText, 240) : '—'}</blockquote>
      <div className="gx-grid">
        <div><label>{t('gx.panel.tokens')}</label><b>{fmtTok(tSum(a.tokens))}</b></div>
        <div><label>{t('gx.panel.calls')}</label><b>{a.toolCalls}</b></div>
        <div><label>{t('gx.panel.workingFor')}</label><b>{fmtDur(Date.now() - a.startedAt)}</b></div>
        <div><label>{t('gx.panel.children')}</label><b>{a.children.length}</b></div>
        <div><label>{t('gx.panel.finishedChildren')}</label><b>{a.finishedChildren}</b></div>
        <div><label>{t('gx.panel.activity')}</label><b>{fmtAgo(a.lastActivity)}</b></div>
      </div>
      <TokBars t={a.tokens} />
      {a.children.length > 0 && (<><h4>{t('gx.panel.children')}</h4><div className="gx-tree">{a.children.map((c) => <Tree key={c.id} s={s} node={c} eng={eng} onAgent={onAgent} />)}</div></>)}
      <div className="gx-actions">
        <a className="gx-btn primary" href={href(`/session/${encodeURIComponent(s.sessionId)}`)}>{t('gx.panel.timeline')}</a>
        <a className="gx-btn" href={href('/analytics/subagents')}>{t('gx.panel.subagentAnalytics')}</a>
      </div>
    </aside>
  );
}

const LEGEND_ITEMS: MsgKey[] = ['gx.legend.star', 'gx.legend.planets', 'gx.legend.belt', 'gx.legend.events', 'gx.legend.waves', 'gx.legend.dim', 'gx.legend.cluster', 'gx.legend.gravity'];

/** Rows shown in a cluster's list; the rest is one click away on the sessions page. */
const CLUSTER_ROWS = 150;

function ClusterPanel({ c, onReveal, pin }: { c: ClusterInfo; onReveal: (sessionId: string) => void; pin: (() => void) | null }) {
  const col = projectColor(c.project);
  const rows = c.sessions.slice(0, CLUSTER_ROWS);
  const more = c.sessions.length - rows.length;
  const status = (s: LiveSession) => (s.alive ? statusWord(s.status) : t('gx.status.stopped'));
  return (
    <aside className="gx-panel gx-panel--cluster" style={{ ['--acc' as string]: col }}>
      <div className="gx-panel-head">
        <span className="gx-status-chip cluster">{t('gx.cluster.chip')}</span>
        <h3>{c.project}</h3>
        <p>{tp('gx.cluster.count', c.sessions.length)}</p>
        <div className="gx-meta">{t('gx.cluster.sub')}</div>
      </div>
      {pin && <PinRow onUnpin={pin} />}
      <div className="gx-grid">
        <div><label>{t('gx.cluster.tokens')}</label><b>{fmtTok(c.tokens24h)}</b></div>
        <div><label>{t('gx.cluster.sessions')}</label><b>{c.sessions.length}</b></div>
        <div><label>{t('gx.cluster.live')}</label><b>{c.live}</b></div>
        <div><label>{t('gx.cluster.automatedL')}</label><b>{c.automated}</b></div>
      </div>
      {c.automated > 0 && <p className="gx-cl-hint">{t('gx.cluster.hint')}</p>}
      <h4>{t('gx.cluster.list')}</h4>
      <ul className="gx-cl-list">
        {rows.map((s) => {
          const title = s.title ?? s.name ?? s.sessionId.slice(0, 8);
          const detail = href(`/session/${encodeURIComponent(s.sessionId)}`);
          const body = (
            <>
              <span className="gx-cl-top">
                <b title={title}>{short(title, 46)}</b>
                <em>{fmtTok(s.tokens24h)}</em>
              </span>
              <span className="gx-cl-sub">
                <span>{s.project}</span>
                <span>{fmtAgo(s.lastActivity)}</span>
                <span className={`gx-cl-kind ${s.kind === 'automated' ? 'auto' : ''}`}>{t(s.kind === 'automated' ? 'gx.kind.automated' : 'gx.kind.interactive')}</span>
                <span className={`gx-cl-st ${s.alive ? s.status : 'stopped'}`}>{status(s)}</span>
              </span>
            </>
          );
          return (
            <li key={s.sessionId} className={s.alive ? 'live' : ''}>
              {s.alive ? (
                <button type="button" className="gx-cl-row" onClick={() => onReveal(s.sessionId)} title={t('gx.cluster.show')}>{body}</button>
              ) : (
                <a className="gx-cl-row" href={detail} title={t('gx.cluster.open')}>{body}</a>
              )}
              {s.alive && <a className="gx-cl-go" href={detail} title={t('gx.cluster.open')} aria-label={t('gx.cluster.open')}>↗</a>}
            </li>
          );
        })}
      </ul>
      {more > 0 && <p className="gx-cl-more">{tp('gx.cluster.more', more)}</p>}
      <div className="gx-actions">
        <a className="gx-btn primary" href={href('/analytics/sessions', { project: c.project })}>{t('gx.cluster.all', { project: c.project })}</a>
      </div>
    </aside>
  );
}

function Legend({ onClose }: { onClose: () => void }) {
  return (
    <div className="gx-legend" onClick={onClose}>
      <h4>{t('gx.legend.title')}</h4>
      <ul>
        {/* Static, trusted dictionary markup (<b> only). */}
        {LEGEND_ITEMS.map((k) => <li key={k} dangerouslySetInnerHTML={{ __html: t(k) }} />)}
      </ul>
      <small>{t('gx.legend.click')}</small>
    </div>
  );
}
