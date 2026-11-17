// The event console: the compact ticker over the galaxy, the docked drawer and the standalone window.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { t, type MsgKey } from '../i18n';
import { fmtTok, fmtClock } from '../galaxy/format';
import { filterLines, KIND_GLYPH, LINE_KINDS, NO_FILTER, projectsOf, type ConsoleLine, type LineFilter, type LineKind } from './model';
import { lineColor, projectColor, useColorVersion, useConsoleLines } from './store';

export type FocusFn = (sessionId: string, agentId?: string) => void;

const agentLabel = (id: string, name: string | null | undefined) => name || (id === 'main' ? t('gx.manager') : t('gx.agent'));

function short(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function AgentLink({ line, id, name, onFocus }: { line: ConsoleLine; id: string; name: string | null | undefined; onFocus: FocusFn }) {
  const label = agentLabel(id, name);
  return (
    <button
      type="button"
      className="cl-agent"
      style={{ color: lineColor(line.sessionId, id, line.project) }}
      onClick={() => onFocus(line.sessionId, id === 'main' ? undefined : id)}
      title={t('cl.focusAgent', { agent: label })}
    >
      {label}
    </button>
  );
}

/** One line: time, glyph, project (star color), agent (planet color), what happened. */
export function LineView({ line, onFocus, compact = false }: { line: ConsoleLine; onFocus: FocusFn; compact?: boolean }) {
  const n = compact ? 60 : 400;
  let rest: ReactNode = null;
  switch (line.kind) {
    case 'tool':
      rest = (
        <>
          <AgentLink line={line} id={line.agentId} name={line.agentName} onFocus={onFocus} />
          <span className="cl-text"> · {short(line.text, n)}</span>
        </>
      );
      break;
    case 'spawn':
      rest = (
        <>
          <AgentLink line={line} id={line.parentId ?? 'main'} name={line.parentName} onFocus={onFocus} />
          <span className="cl-text"> {t('cl.spawned')} </span>
          <AgentLink line={line} id={line.agentId} name={line.agentName} onFocus={onFocus} />
          {line.text && <span className="cl-text">: {short(line.text, compact ? 50 : 300)}</span>}
        </>
      );
      break;
    case 'finish':
      rest = (
        <>
          <AgentLink line={line} id={line.agentId} name={line.agentName} onFocus={onFocus} />
          <span className="cl-text"> {t('cl.returned', { tokens: fmtTok(line.tokens ?? 0) })}</span>
        </>
      );
      break;
    case 'wait':
      // The server's reason already says what it waits for ("Waiting for permission: Bash").
      rest = <span className="cl-text cl-text--wait">{line.text ? short(line.text, n) : t('cl.waiting')}</span>;
      break;
    case 'prompt':
      rest = <span className="cl-text">{t('cl.prompt')}</span>;
      break;
    case 'compact':
      rest = <span className="cl-text">{t('cl.compact')}</span>;
      break;
  }
  return (
    <div className={`cl-line cl-line--${line.kind}`}>
      <span className="cl-time">{fmtClock(line.ts)}</span>
      <span className="cl-glyph" aria-hidden>{KIND_GLYPH[line.kind]}</span>
      <span className="cl-body">
        <button
          type="button"
          className="cl-proj"
          style={{ color: projectColor(line.project) }}
          onClick={() => onFocus(line.sessionId)}
          title={t('cl.focusProject', { project: line.project })}
        >
          {line.project}
        </button>
        <span className="cl-sep"> › </span>
        {rest}
      </span>
    </div>
  );
}

/* ---------------- icons ---------------- */

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
export const ICON_EXPAND = 'M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7';
export const ICON_POPOUT = 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5';
const ICON_CLOSE = 'M6 6l12 12M18 6 6 18';
const ICON_PAUSE = 'M8 5v14M16 5v14';
const ICON_PLAY = 'M7 5l12 7-12 7z';
const ICON_CLEAR = 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3';

/* ---------------- the ticker over the galaxy ---------------- */

export function Ticker({ onFocus, onExpand, onPopOut }: { onFocus: FocusFn; onExpand: () => void; onPopOut: () => void }) {
  const lines = useConsoleLines();
  useColorVersion();
  const last = lines.slice(-8);
  return (
    <div className="gx-ticker">
      <div className="gx-ticker__bar">
        <button type="button" className="gx-ticker__btn" onClick={onExpand} title={t('cl.expand')} aria-label={t('cl.expand')}>
          <Icon d={ICON_EXPAND} />
          <span>{t('cl.title')}</span>
        </button>
        <button type="button" className="gx-ticker__btn" onClick={onPopOut} title={t('cl.popout')} aria-label={t('cl.popout')}>
          <Icon d={ICON_POPOUT} />
        </button>
      </div>
      {last.map((l, i) => (
        <div key={l.key} className="gx-tick" style={{ opacity: Math.max(0.22, 1 - (last.length - 1 - i) * 0.11) }}>
          <LineView line={l} onFocus={onFocus} compact />
        </div>
      ))}
    </div>
  );
}

/* ---------------- the full console (drawer and window) ---------------- */

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function ConsolePanel({
  variant,
  onFocus,
  onClose,
  onPopOut,
}: {
  variant: 'drawer' | 'window';
  onFocus: FocusFn;
  onClose?: () => void;
  onPopOut?: () => void;
}) {
  const live = useConsoleLines();
  useColorVersion();
  const [filter, setFilter] = useState<LineFilter>(NO_FILTER);
  const [paused, setPaused] = useState<ConsoleLine[] | null>(null);
  const lines = paused ?? live;
  const shown = useMemo(() => filterLines(lines, filter), [lines, filter]);
  const projects = useMemo(() => projectsOf(live), [live]);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const newWhilePaused = paused ? live.length - paused.length : 0;

  // Autoscroll to the newest line unless the reader scrolled up (or paused).
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current && !paused) el.scrollTop = el.scrollHeight;
  }, [shown, paused]);
  const onScroll = () => {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  useEffect(() => {
    if (variant !== 'drawer' || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      // The settings dialog handles its own Esc; a search with text keeps Esc for clearing it.
      if (document.querySelector('.setp')) return;
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement && e.target.value)) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [variant, onClose]);

  return (
    <div className={`cl cl--${variant}`}>
      <div className="cl-head">
        <h2 className="cl-title">
          <span className="cl-title__dot" aria-hidden />
          {t('cl.title')}
          <span className="cl-count mono">{t('cl.count', { shown: shown.length, total: live.length })}</span>
        </h2>
        <label className="cl-search">
          <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="11" cy="11" r="6" />
            <path d="M20 20l-4.5-4.5" />
          </svg>
          <input type="search" placeholder={t('cl.search')} aria-label={t('cl.search')} value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        </label>
        <div className="cl-actions">
          <button type="button" className={`cl-btn ${paused ? 'is-on' : ''}`} onClick={() => setPaused(paused ? null : live)} aria-pressed={!!paused}>
            <Icon d={paused ? ICON_PLAY : ICON_PAUSE} />
            <span>{paused ? t('cl.resume') : t('cl.pause')}</span>
            {newWhilePaused > 0 && <em className="cl-badge">{t('cl.pausedNew', { n: newWhilePaused })}</em>}
          </button>
          <button type="button" className="cl-btn" onClick={() => setFilter({ ...filter, clearedAt: live.length ? live[live.length - 1].ts : Date.now() })}>
            <Icon d={ICON_CLEAR} />
            <span>{t('cl.clear')}</span>
          </button>
          {onPopOut && (
            <button type="button" className="cl-btn cl-btn--icon" onClick={onPopOut} title={t('cl.popout')} aria-label={t('cl.popout')}>
              <Icon d={ICON_POPOUT} />
            </button>
          )}
          {onClose && (
            <button type="button" className="cl-btn cl-btn--icon" onClick={onClose} title={t('cl.close')} aria-label={t('cl.close')}>
              <Icon d={ICON_CLOSE} />
            </button>
          )}
        </div>
      </div>
      <div className="cl-filters">
        <div className="cl-chips" role="group" aria-label={t('cl.projects')}>
          <span className="cl-chips__label">{t('cl.projects')}</span>
          {projects.map((p) => (
            <button
              key={p.project}
              type="button"
              className="cl-chip"
              aria-pressed={filter.projects.includes(p.project)}
              style={{ ['--acc' as string]: projectColor(p.project) }}
              onClick={() => setFilter({ ...filter, projects: toggle(filter.projects, p.project) })}
            >
              <i aria-hidden />
              {p.project}
            </button>
          ))}
        </div>
        <div className="cl-chips" role="group" aria-label={t('cl.kinds')}>
          <span className="cl-chips__label">{t('cl.kinds')}</span>
          {LINE_KINDS.map((k: LineKind) => (
            <button
              key={k}
              type="button"
              className={`cl-chip cl-chip--kind cl-chip--${k}`}
              aria-pressed={filter.kinds.includes(k)}
              onClick={() => setFilter({ ...filter, kinds: toggle(filter.kinds, k) })}
            >
              <b aria-hidden>{KIND_GLYPH[k]}</b>
              {t(`cl.k.${k}` as MsgKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="cl-list" ref={listRef} onScroll={onScroll} role="log" aria-live={paused ? 'off' : 'polite'}>
        {shown.length ? (
          shown.map((l) => <LineView key={l.key} line={l} onFocus={onFocus} />)
        ) : (
          <p className="cl-empty">{live.length ? t('cl.noMatch') : t('cl.empty')}</p>
        )}
      </div>
      {variant === 'window' && <p className="cl-foot">{t('cl.window.hint')}</p>}
    </div>
  );
}

/** The docked drawer at the bottom of the galaxy, with a resize handle. */
export function ConsoleDrawer({ onFocus, onClose, onPopOut }: { onFocus: FocusFn; onClose: () => void; onPopOut: () => void }) {
  const [h, setH] = useState(() => {
    try {
      const v = Number(localStorage.getItem('clorbit.consoleHeight'));
      if (v > 0) return v;
    } catch {
      /* storage unavailable */
    }
    return 0.45;
  });
  const drag = useRef<{ y: number; h: number } | null>(null);
  // Toasts move above the drawer (styles/settings.css).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.console = '1';
    root.style.setProperty('--console-h', `${Math.round(h * 100)}vh`);
  }, [h]);
  useEffect(
    () => () => {
      delete document.documentElement.dataset.console;
      document.documentElement.style.removeProperty('--console-h');
    },
    [],
  );
  const clampH = (v: number) => Math.min(0.85, Math.max(0.22, v));
  const onDown = (e: ReactPointerEvent) => {
    drag.current = { y: e.clientY, h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setH(clampH(drag.current.h + (drag.current.y - e.clientY) / window.innerHeight));
  };
  const onUp = () => {
    drag.current = null;
    try {
      localStorage.setItem('clorbit.consoleHeight', String(h));
    } catch {
      /* storage unavailable */
    }
  };
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setH((v) => clampH(v + (e.key === 'ArrowUp' ? 0.05 : -0.05)));
    }
  };
  return (
    <section className="gx-console" style={{ height: `${Math.round(h * 100)}vh` }} aria-label={t('cl.title')}>
      <div
        className="gx-console__grip"
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('cl.resize')}
        aria-valuenow={Math.round(h * 100)}
        aria-valuemin={22}
        aria-valuemax={85}
        tabIndex={0}
        title={t('cl.resize')}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onKeyDown={onKey}
      />
      <ConsolePanel variant="drawer" onFocus={onFocus} onClose={onClose} onPopOut={onPopOut} />
    </section>
  );
}

/** Opens the console in its own window (it drives this tab over BroadcastChannel). */
export function popOutConsole() {
  const demo = /[?&](demo|mock)=/.test(window.location.hash + window.location.search) ? '?demo=1' : '';
  window.open(`${window.location.pathname}${window.location.search}#/console${demo}`, 'clorbit-console', 'width=560,height=860');
}
