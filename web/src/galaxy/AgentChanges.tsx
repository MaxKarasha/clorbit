// "What did this agent change?": the files an agent edited or wrote (with inline mini-diffs) and its step feed.
// Used in the galaxy's session / agent panels (tabs) and, as a file list, on the Session page.
// Live updates ride on the galaxy's existing snapshot poll and event stream: the panel passes a `rev` that changes
// whenever the agent does something, and the section refetches (throttled, one request in flight).
import { useEffect, useRef, useState } from 'react';
import type { AgentChanges, AgentStep, DiffHunk, FileChange } from '@shared/api';
import { t, tp, useLang } from '../i18n';
import { apiGet } from '../lib/api';
import { fmtAgo } from './format';
import './changes.css';

/** Minimum time between two refetches of the same agent. */
const REFETCH_MS = 1500;
/** Steps shown at first and added by "show more". */
export const STEP_PAGE = 50;

export const changesPath = (sessionId: string, agentId: string) =>
  `/api/session/${encodeURIComponent(sessionId)}/agent/${encodeURIComponent(agentId)}/changes`;

/** Loads an agent's changes and refetches when `rev` changes (throttled; previous data stays on screen). */
export function useAgentChanges(sessionId: string, agentId: string, rev: string | number): { data: AgentChanges | null; error: string | null } {
  const [state, setState] = useState<{ key: string; data: AgentChanges | null; error: string | null }>({ key: '', data: null, error: null });
  const lang = useLang();
  const key = `${sessionId}/${agentId}/${lang}`;
  const trigger = useRef<() => void>(() => {});

  // One fetcher per agent: at most one request in flight, at most one every REFETCH_MS; a change that arrives
  // meanwhile is fetched right after. A new `rev` never aborts a running request.
  useEffect(() => {
    let stop = false;
    let busy = false;
    let dirty = false;
    let last = 0;
    let timer: number | undefined;
    const ctrl = new AbortController();
    const run = async () => {
      if (stop) return;
      if (busy) { dirty = true; return; }
      const wait = last + REFETCH_MS - Date.now();
      if (wait > 0) { if (timer === undefined) timer = window.setTimeout(() => { timer = undefined; run(); }, wait); return; }
      busy = true;
      dirty = false;
      last = Date.now();
      try {
        const { data } = await apiGet<AgentChanges>(changesPath(sessionId, agentId), ctrl.signal);
        if (!stop) setState({ key, data, error: null });
      } catch (e) {
        if (!stop && (e as Error).name !== 'AbortError') setState((s) => ({ key, data: s.key === key ? s.data : null, error: (e as Error).message }));
      } finally {
        busy = false;
        if (!stop && dirty) run();
      }
    };
    trigger.current = run;
    run();
    return () => { stop = true; ctrl.abort(); window.clearTimeout(timer); };
  }, [key]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    trigger.current();
  }, [rev]);

  // A different agent: never show the previous one's data.
  return state.key === key ? { data: state.data, error: state.error } : { data: null, error: null };
}

/* ---------------- pieces ---------------- */

function Delta({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="chg-delta">
      <b className="chg-add">+{added}</b>
      <b className="chg-del">−{removed}</b>
    </span>
  );
}

function Hunk({ h }: { h: DiffHunk }) {
  return (
    <div className="chg-hunk">
      <div className="chg-hunk__meta">
        <span>{h.tool}{h.replaceAll && <> · {t('ch.diff.replaceAll')}</>}{h.mode && <> · {t('ch.diff.notebook', { mode: h.mode })}</>}</span>
        <span>{fmtAgo(h.ts)}</span>
      </div>
      {h.lines.length ? (
        <pre className="chg-diff">
          {h.lines.map((l, i) => (
            <span key={i} className={l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : 'ctx'}>
              <i aria-hidden>{l[0] === ' ' ? ' ' : l[0] === '-' ? '−' : '+'}</i>{l.slice(1) || ' '}{'\n'}
            </span>
          ))}
          {h.more > 0 && <span className="more">{tp('ch.diff.more', h.more)}</span>}
        </pre>
      ) : (
        <p className="chg-note">{t('ch.diff.empty')}</p>
      )}
    </div>
  );
}

function FileRow({ f, open, onToggle, agentColors }: { f: FileChange; open: boolean; onToggle: () => void; agentColors?: (id: string) => string | undefined }) {
  const slash = f.path.lastIndexOf('/');
  const dir = slash >= 0 ? f.path.slice(0, slash + 1) : '';
  const failedOnly = f.edits === 0;
  const badge = f.write === 'created' ? t('ch.created') : f.write === 'overwritten' ? t('ch.overwritten') : f.write === 'written' ? t('ch.written') : null;
  return (
    <li className={`chg-file${failedOnly ? ' chg-file--failed' : ''}${open ? ' open' : ''}`}>
      <button type="button" className="chg-file__row" onClick={onToggle} aria-expanded={open} title={`${f.path}\n${t('ch.lastChange', { ago: fmtAgo(f.lastTs) })}`} aria-label={t('ch.diff.toggle', { file: f.path })}>
        <span className="chg-file__chev" aria-hidden>▸</span>
        <span className="chg-file__path"><span className="chg-file__dir">{dir}</span><b>{f.name}</b></span>
        {failedOnly ? <span className="chg-file__fail">{t('ch.onlyFailed')}</span> : <Delta added={f.added} removed={f.removed} />}
        <span className="chg-file__sub">
          {badge && <span className="chg-badge">{badge}</span>}
          {f.edits > 0 && <span>{tp('ch.edits', f.edits)}</span>}
          {f.failed > 0 && !failedOnly && <span className="chg-dim">{tp('ch.failed', f.failed)}</span>}
          {f.agents && f.agents.length > 0 && (
            <span className="chg-agents" title={tp('ch.session.agents', f.agents.length)}>
              {f.agents.slice(0, 6).map((a) => <i key={a} style={{ background: agentColors?.(a) ?? 'currentColor' }} />)}
            </span>
          )}
          <span className="chg-file__ago">{fmtAgo(f.lastTs)}</span>
        </span>
      </button>
      {open && (
        <div className="chg-file__diff">
          {failedOnly ? <p className="chg-note">{t('ch.diff.failedOnly')}</p> : f.hunks.map((h, i) => <Hunk key={i} h={h} />)}
          {!!f.hunksDropped && <p className="chg-note">{tp('ch.diff.older', f.hunksDropped)}</p>}
        </div>
      )}
    </li>
  );
}

/** Totals, the changed files (click for the diff) and the files that were only read. */
export function FileList({ c, agentColors }: { c: AgentChanges; agentColors?: (id: string) => string | undefined }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [readsOpen, setReadsOpen] = useState(false);
  const toggle = (p: string) => setOpen((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  if (c.archived) return <p className="chg-note">{t('ch.archived')}</p>;
  const tt = c.totals;
  return (
    <div className="chg">
      {c.files.length ? (
        <>
          <div className="chg-totals" title={t('ch.totalsTitle')}>
            <Delta added={tt.added} removed={tt.removed} />
            <span>{tp('ch.files', tt.files)}</span>
            <span>{tp('ch.edits', tt.edits)}</span>
            {tt.failed > 0 && <span className="chg-dim">{tp('ch.failed', tt.failed)}</span>}
          </div>
          <ul className="chg-files">
            {c.files.map((f) => <FileRow key={f.path} f={f} open={open.has(f.path)} onToggle={() => toggle(f.path)} agentColors={agentColors} />)}
          </ul>
          {c.filesTotal > c.files.length && <p className="chg-note">{tp('ch.moreFiles', c.filesTotal - c.files.length)}</p>}
        </>
      ) : (
        <p className="chg-note">{t('ch.none')}</p>
      )}
      {c.reads.length > 0 && (
        <div className="chg-reads">
          <button type="button" className="chg-reads__head" onClick={() => setReadsOpen(!readsOpen)} aria-expanded={readsOpen}>
            <span className="chg-file__chev" aria-hidden>▸</span>{t('ch.reads')} <em>{c.readsTotal}</em>
          </button>
          {readsOpen && (
            <ul>
              {c.reads.map((r) => (
                <li key={r.path} title={`${r.path} · ${tp('ch.readTimes', r.count)}`}>
                  <span className="chg-file__path"><span className="chg-file__dir">{r.path.slice(0, r.path.length - r.name.length)}</span><span>{r.name}</span></span>
                  <em>×{r.count}</em>
                </li>
              ))}
              {c.readsTotal > c.reads.length && <li className="chg-dim">{t('ch.readsMore', { n: c.readsTotal - c.reads.length })}</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const STEP_ICON: Record<AgentStep['kind'], string> = { tool: '›', spawn: '⤷', text: '“' };

/** The agent's steps, newest first, `STEP_PAGE` at a time. */
export function StepFeed({ c, live }: { c: AgentChanges; live: boolean }) {
  const [shown, setShown] = useState(STEP_PAGE);
  if (c.archived) return <p className="chg-note">{t('ch.archived')}</p>;
  if (!c.steps.length) return <p className="chg-note">{t('ch.steps.none')}</p>;
  const steps = c.steps.slice(-shown).reverse();
  const left = c.steps.length - steps.length;
  const notLoaded = c.stepsTotal - c.steps.length;
  return (
    <div className="chg-steps">
      {live && <div className="chg-live" title={t('ch.steps.liveTitle')}><i />{t('ch.steps.live')}</div>}
      <ol>
        {steps.map((s, i) => (
          <li key={`${s.ts}-${i}-${s.label}`} className={`chg-step chg-step--${s.kind} ${s.status ?? ''}`}>
            <span className="chg-step__ico" aria-hidden>{STEP_ICON[s.kind]}</span>
            <span className="chg-step__label" title={s.label}>{s.label}</span>
            {s.status && <span className={`chg-step__st ${s.status}`} title={t(`ch.st.${s.status}`)}>{s.status === 'error' ? t('ch.st.error') : s.status === 'pending' ? '…' : '✓'}</span>}
            <span className="chg-step__ago">{fmtAgo(s.ts)}</span>
          </li>
        ))}
      </ol>
      {left > 0 && (
        <button type="button" className="chg-more" onClick={() => setShown(shown + STEP_PAGE)}>{t('ch.steps.more', { n: Math.min(STEP_PAGE, left) })}</button>
      )}
      {left === 0 && notLoaded > 0 && <p className="chg-note">{tp('ch.steps.notLoaded', notLoaded)}</p>}
    </div>
  );
}

type Tab = 'changes' | 'steps';
// Remembered while the page is open, so moving between agents keeps the tab.
let lastTab: Tab = 'changes';

/** The galaxy panel section: "Changes" and "Steps" tabs for one agent ('main' = the session's own agent). */
export function ChangesSection({ sessionId, agentId, rev, live }: { sessionId: string; agentId: string; rev: string | number; live: boolean }) {
  const [tab, setTabState] = useState<Tab>(lastTab);
  const setTab = (v: Tab) => { lastTab = v; setTabState(v); };
  const { data, error } = useAgentChanges(sessionId, agentId, rev);
  return (
    <section className="chg-section">
      <div className="chg-tabs" role="tablist" aria-label={t('ch.tabsLabel')}>
        <button type="button" role="tab" aria-selected={tab === 'changes'} className={tab === 'changes' ? 'on' : ''} onClick={() => setTab('changes')}>
          {t('ch.tab.changes')}
          {data && data.totals.files > 0 && <Delta added={data.totals.added} removed={data.totals.removed} />}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'steps'} className={tab === 'steps' ? 'on' : ''} onClick={() => setTab('steps')}>
          {t('ch.tab.steps')}
          {data && data.stepsTotal > 0 && <em>{data.stepsTotal}</em>}
        </button>
      </div>
      <div role="tabpanel">
        {!data ? (
          <p className="chg-note">{error ? t('ch.error', { e: error }) : t('ch.loading')}</p>
        ) : tab === 'changes' ? (
          <FileList key={`${sessionId}/${agentId}`} c={data} />
        ) : (
          <StepFeed key={`${sessionId}/${agentId}`} c={data} live={live} />
        )}
      </div>
    </section>
  );
}
