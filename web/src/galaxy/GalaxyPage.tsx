// Home page: the galaxy of sessions and agents + HUD (status bar, panels, event ticker).
import { useEffect, useRef, useState } from 'react';
import type { AgentNode, AnalyticsOverview, ClorbitEvent, LiveSession, LiveSnapshot } from '@shared/api';
import LangSwitch from '../components/LangSwitch';
import { DemoStrip, ServerOffline } from '../components/ServerState';
import { locale, t, useLang, withLang, type MsgKey } from '../i18n';
import { enterDemo, isDemo } from '../lib/demo';
import { href } from '../lib/router';
import { GalaxyEngine, prettyModel, short, type Focus } from './engine';
import { MockFeed } from './mock';
import { fmtAgo, fmtClock, fmtDur, fmtPct, fmtTok, tSum } from './format';
import './galaxy.css';

type Tick = { id: number; ts: number; text: string; tone: 'tool' | 'spawn' | 'finish' | 'wait' | 'info' };

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GalaxyEngine | null>(null);
  const snapRef = useRef<LiveSnapshot | null>(null);
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [focus, setFocus] = useState<Focus>({ t: 'none' });
  const [ticks, setTicks] = useState<Tick[]>([]);
  // Demo mode is fixed for the lifetime of this component: App remounts the galaxy when it changes.
  const [demo] = useState(isDemo);
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const retryRef = useRef<() => void>(() => {});
  const [legend, setLegend] = useState(false);
  // Auto tour is opt-in and remembered per browser.
  const [tour, setTourState] = useState(() => { try { return localStorage.getItem('clorbit.tour') === '1'; } catch { return false; } });
  const setTour = (v: boolean) => { setTourState(v); try { localStorage.setItem('clorbit.tour', v ? '1' : '0'); } catch { /* storage unavailable */ } };
  const tickId = useRef(0);
  const lang = useLang();

  useEffect(() => {
    const eng = new GalaxyEngine(canvasRef.current!, {
      onFocus: setFocus,
      onDistant: (p) => { location.hash = href('/analytics/sessions', { project: p, range: '30d' }); },
    });
    engineRef.current = eng;
    if (import.meta.env.DEV) (window as unknown as { __galaxy?: GalaxyEngine }).__galaxy = eng;
    return () => eng.destroy();
  }, []);

  useEffect(() => { if (engineRef.current) engineRef.current.tourOn = tour; }, [tour]);

  // Data: the real server or the demo feed.
  useEffect(() => {
    const onSnap = (s: LiveSnapshot) => { snapRef.current = s; setSnap(s); engineRef.current?.sync(s); };
    const onEvent = (e: ClorbitEvent) => {
      engineRef.current?.pushEvent(e);
      const t = describe(e, snapRef.current);
      if (t) setTicks((prev) => [{ id: ++tickId.current, ts: e.ts, ...t }, ...prev].slice(0, 8));
    };
    if (demo) {
      const m = new MockFeed(onSnap, onEvent);
      return () => m.stop();
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
    return () => { alive = false; clearInterval(iv); clearInterval(iv2); es?.close(); };
  }, [demo, lang]);

  const eng = engineRef.current;
  const fSession: LiveSession | undefined = focus.t === 'none' ? undefined : snap?.sessions.find((s) => s.sessionId === focus.sessionId);
  const fAgent = focus.t === 'agent' && fSession ? findAgent(fSession.root, focus.agentId) : null;
  const go = (f: Focus) => engineRef.current?.setFocus(f, true);

  // Numbers are shown only while they are current: never stale ones under the offline screen.
  const shown = offline ? null : snap;

  return (
    <div className={`gx${demo ? ' gx--demo' : ''}`}>
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
        </nav>
        {shown && !demo && !shown.hooksInstalled && <div className="gx-pill" title={t('gx.bar.noHooksTitle')}>{t('gx.bar.noHooks')}</div>}
      </header>
      {demo && <DemoStrip className="gx-demo" />}

      <div className="gx-crumbs">
        <button onClick={() => go({ t: 'none' })}>{t('gx.crumbs.fleet')}</button>
        {fSession && (<><span>▸</span><button onClick={() => go({ t: 'sys', sessionId: fSession.sessionId })}>{fSession.project}</button></>)}
        {fAgent && fAgent.chain.slice(1).map((n) => (
          <span key={n.id} className="gx-crumb-agent"><span>▸</span><button onClick={() => go({ t: 'agent', sessionId: fSession!.sessionId, agentId: n.id })} style={{ color: eng?.colorOf(fSession!.sessionId, n.id) }}>{n.type}</button></span>
        ))}
        {focus.t !== 'none' && <em>{t('gx.crumbs.hint')}</em>}
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

      {!offline && fSession && focus.t === 'sys' && <SessionPanel s={fSession} eng={eng} onAgent={(id) => go({ t: 'agent', sessionId: fSession.sessionId, agentId: id })} />}
      {!offline && fSession && fAgent && <AgentPanel s={fSession} a={fAgent.node} parent={fAgent.chain[fAgent.chain.length - 2] ?? null} eng={eng} onAgent={(id) => go({ t: 'agent', sessionId: fSession.sessionId, agentId: id })} />}

      {!offline && (
        <div className={`gx-zoom ${focus.t !== 'none' ? 'panel' : ''}`}>
          <div className="gx-zoom-pad">
            <button onClick={() => engineRef.current?.zoomBy(1.3)} title={t('gx.zoom.in')} aria-label={t('gx.zoom.in')}>+</button>
            <button onClick={() => engineRef.current?.zoomBy(1 / 1.3)} title={t('gx.zoom.out')} aria-label={t('gx.zoom.out')}>−</button>
            <button onClick={() => engineRef.current?.resetView()} title={t('gx.zoom.reset')} aria-label={t('gx.zoom.reset')}>⟲</button>
          </div>
          <div className="gx-zoom-hint">{t('gx.zoom.hint')}</div>
        </div>
      )}

      <div className="gx-ticker">
        {ticks.map((t, i) => (
          <div key={t.id} className={`gx-tick ${t.tone}`} style={{ opacity: Math.max(0.15, 1 - i * 0.12) }}>
            <span className="gx-tick-time">{fmtClock(t.ts)}</span>{t.text}
          </div>
        ))}
      </div>

      {legend && <Legend onClose={() => setLegend(false)} />}
    </div>
  );
}

function quote(t: string, n: number) {
  const s = short(t.trim(), n);
  return /^[«"“]/.test(s) ? s : `«${s}»`;
}

function describe(e: ClorbitEvent, s: LiveSnapshot | null): Omit<Tick, 'id' | 'ts'> | null {
  const sess = s?.sessions.find((x) => x.sessionId === e.sessionId);
  const proj = sess?.project ?? e.sessionId.slice(0, 8);
  const name = (id: string) => (id === 'main' ? t('gx.manager') : (sess && findAgent(sess.root, id)?.node.type) || t('gx.agent'));
  switch (e.kind) {
    case 'tool': return { text: `${proj} › ${name(e.agentId)} · ${short(e.label, 60)}`, tone: 'tool' };
    case 'spawn': return { text: `${t('gx.tick.spawn', { proj, parent: name(e.parentId), type: e.agentType })}${e.description ? ': ' + short(e.description, 50) : ''}`, tone: 'spawn' };
    case 'finish': return { text: t('gx.tick.finish', { proj, agent: name(e.agentId), tokens: fmtTok(e.tokens) }), tone: 'finish' };
    case 'status': return e.status === 'waiting' ? { text: `${t('gx.tick.wait', { proj })}${e.reason ? ': ' + e.reason : ''}`, tone: 'wait' } : null;
    case 'prompt': return { text: t('gx.tick.prompt', { proj }), tone: 'info' };
    case 'compact': return { text: t('gx.tick.compact', { proj }), tone: 'info' };
    default: return null;
  }
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

function Ring({ pct, label, sub }: { pct: number | null; label: string; sub: string }) {
  const r = 15, c = 2 * Math.PI * r, f = pct == null ? 0 : Math.min(1, pct / 100);
  const col = pct == null ? '#56607A' : pct > 85 ? '#FF6B8B' : pct > 60 ? '#FFD66B' : '#7FE0C4';
  return (
    <div className="gx-ring">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} stroke="rgba(150,170,220,.15)" strokeWidth="4" fill="none" />
        <circle cx="20" cy="20" r={r} stroke={col} strokeWidth="4" fill="none" strokeDasharray={`${c * f} ${c}`} strokeLinecap="round" transform="rotate(-90 20 20)" style={{ filter: `drop-shadow(0 0 4px ${col})` }} />
        <text x="20" y="23.5" textAnchor="middle" className="gx-ring-t">{pct == null ? '—' : Math.round(pct)}</text>
      </svg>
      <div><b>{label}</b><span>{sub}</span></div>
    </div>
  );
}

/** The metrics of the HUD bar, in priority order; lower-priority ones give way on narrow screens (galaxy.css). */
function StatusMetrics({ snap }: { snap: LiveSnapshot }) {
  const tt = snap.totals;
  const L = snap.limits;
  const resets = (ts: number | null) => (ts ? t('gx.bar.resets', { at: new Date(ts).toLocaleString(locale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }) }) : '');
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
            <Ring pct={L.fiveHourPct} label={t('gx.bar.5h')} sub={resets(L.fiveHourResetsAt)} />
            <Ring pct={L.sevenDayPct} label={t('gx.bar.7d')} sub={resets(L.sevenDayResetsAt)} />
          </div>
        ) : (
          <span className="gx-hint" title={t('gx.bar.noSourceTitle')}>{t('gx.bar.noSource')} · <a href="https://github.com/MaxKarasha/clorbit#subscription-limits-optional" target="_blank" rel="noreferrer">{t('gx.bar.howTo')}</a></span>
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

function SessionPanel({ s, eng, onAgent }: { s: LiveSession; eng: GalaxyEngine | null; onAgent: (id: string) => void }) {
  const ctx = s.contextTokens && s.contextLimit ? s.contextTokens / s.contextLimit : null;
  const col = eng?.colorOf(s.sessionId, 'main');
  return (
    <aside className="gx-panel" style={{ ['--acc' as string]: col }}>
      <div className="gx-panel-head">
        <span className={`gx-status-chip ${s.status}`}>{statusWord(s.status)}</span>
        <h3>{s.project}</h3>
        <p>{s.title ?? s.name ?? s.sessionId.slice(0, 8)}</p>
        <div className="gx-meta">{prettyModel(s.model)}{s.effort && <> · {t('gx.panel.effort')} <b>{s.effort}</b></>}{s.gitBranch && <> · {s.gitBranch}</>}</div>
      </div>
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

const LEGEND_ITEMS: MsgKey[] = ['gx.legend.star', 'gx.legend.planets', 'gx.legend.belt', 'gx.legend.events', 'gx.legend.waves', 'gx.legend.dim'];

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
