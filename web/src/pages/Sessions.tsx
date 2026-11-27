import { useMemo, useState } from 'react';
import type { SessionSummary } from '@shared/api';
import { locale, t, tp, useLang, type MsgKey } from '../i18n';
import { branchColor, modelColor } from '../lib/colors';
import { fmtDateTime, fmtDuration, fmtInt, fmtModel, fmtTokens } from '../lib/format';
import { href, setQuery, useRoute } from '../lib/router';
import { CometBar, cx, Empty, PageHeader, Panel } from '../components/ui';
import Recommendations from '../components/Recommendations';
import { Eyebrow, Guard, useRangeApi } from './common';

type Key = 'project' | 'title' | 'startedAt' | 'durationMs' | 'model' | 'total' | 'subagents' | 'toolCalls' | 'compactions';

const COLS: { key: Key; labelKey: MsgKey; num?: boolean }[] = [
  { key: 'project', labelKey: 'sessions.col.project' },
  { key: 'title', labelKey: 'sessions.col.title' },
  { key: 'startedAt', labelKey: 'sessions.col.startedAt' },
  { key: 'durationMs', labelKey: 'sessions.col.duration', num: true },
  { key: 'model', labelKey: 'sessions.col.model' },
  { key: 'total', labelKey: 'sessions.col.total', num: true },
  { key: 'subagents', labelKey: 'sessions.col.subagents', num: true },
  { key: 'toolCalls', labelKey: 'sessions.col.toolCalls', num: true },
  { key: 'compactions', labelKey: 'sessions.col.compactions', num: true },
];

const PAGE = 120;

export default function Sessions() {
  const q = useRangeApi<SessionSummary[]>('/api/analytics/sessions');
  return (
    <>
      <PageHeader eyebrow={<Eyebrow section={t('nav.sessions')} range={q.range} />} title={t('sessions.title')} lede={t('sessions.lede')} />
      <Recommendations page="sessions" />
      <Guard state={q} label={t('sessions.loading')}>
        {(d) => <Body list={d} />}
      </Guard>
    </>
  );
}

function Body({ list }: { list: SessionSummary[] }) {
  const route = useRoute();
  const project = route.query.get('project') ?? '';
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'startedAt', dir: -1 });
  const [limit, setLimit] = useState(PAGE);

  const projects = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((s) => m.set(s.project, (m.get(s.project) ?? 0) + s.total));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [list]);
  const projColor = (p: string) => branchColor(projects.indexOf(p));

  const lang = useLang();
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const f = list.filter((s) => (!project || s.project === project) && (!needle || `${s.title ?? ''} ${s.autoTitle ?? ''} ${s.project} ${s.sessionId} ${s.model ?? ''}`.toLowerCase().includes(needle)));
    const { key, dir } = sort;
    return f.sort((a, b) => {
      const va = a[key] ?? '';
      const vb = b[key] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), locale(lang)) * dir;
    });
  }, [list, project, search, sort, lang]);

  const max = Math.max(...rows.map((r) => r.total), 1);
  const sumTokens = rows.reduce((s, r) => s + r.total, 0);
  const toggleSort = (key: Key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'project' || key === 'title' || key === 'model' ? 1 : -1 }));

  return (
    <Panel flush>
      <div className="toolbar">
        <label className="search">
          <svg viewBox="0 0 20 20" aria-hidden>
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input value={search} onChange={(e) => (setSearch(e.target.value), setLimit(PAGE))} placeholder={t('sessions.searchPh')} aria-label={t('sessions.searchAria')} />
        </label>
        <label className="select">
          <span className="sr-only">{t('sessions.col.project')}</span>
          <select value={project} onChange={(e) => (setQuery({ project: e.target.value || null }), setLimit(PAGE))}>
            <option value="">{t('sessions.allProjects')}</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            {project && !projects.includes(project) && <option value={project}>{project}</option>}
          </select>
        </label>
        {project && (
          <button className="chip chip--filter" onClick={() => setQuery({ project: null })}>
            <span className="dot" style={{ background: projColor(project) }} />
            {project} <span aria-hidden>×</span>
            <span className="sr-only">{t('sessions.clearFilter')}</span>
          </button>
        )}
        <div className="toolbar__sum">
          <span className="mono">{fmtInt(rows.length)}</span> {tp('sessions.count', rows.length)} · <span className="mono">{fmtTokens(sumTokens)}</span> {t('sessions.tokens')}
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty title={t('sessions.emptyTitle')}>{t('sessions.emptyText')}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} className={cx(c.num && 'ta-r', `col-${c.key}`)} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                    <button className={cx('th-btn', sort.key === c.key && 'is-active')} onClick={() => toggleSort(c.key)}>
                      {t(c.labelKey)}
                      <span className="th-arrow" aria-hidden>
                        {sort.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((s, i) => (
                <tr key={s.sessionId} className="trow" style={{ animationDelay: `${Math.min(i, 30) * 14}ms` }} onClick={() => (window.location.hash = href(`/session/${encodeURIComponent(s.sessionId)}`).slice(1))}>
                  <td className="col-project">
                    <span className="proj">
                      <span className="dot" style={{ background: projColor(s.project), boxShadow: `0 0 8px ${projColor(s.project)}` }} />
                      {s.project}
                    </span>
                  </td>
                  <td className="col-title">
                    <a href={href(`/session/${encodeURIComponent(s.sessionId)}`)} className="trow__title" onClick={(e) => e.stopPropagation()}>
                      {s.title ?? <span className="muted">{t('sessions.untitled')}</span>}
                    </a>
                    <span className="trow__id mono">{s.sessionId.slice(0, 8)}</span>
                    <a className="trow__replay" href={href(`/replay/${encodeURIComponent(s.sessionId)}`)} onClick={(e) => e.stopPropagation()} title={t('sessions.replay')} aria-label={t('sessions.replay')}>
                      ▶
                    </a>
                  </td>
                  <td className="col-startedAt mono">{fmtDateTime(s.startedAt)}</td>
                  <td className="ta-r mono">{fmtDuration(s.durationMs)}</td>
                  <td className="col-model">
                    <span style={{ color: s.model ? modelColor(s.model) : undefined }}>{fmtModel(s.model)}</span>
                    {s.effort && <span className="effort mono">{s.effort}</span>}
                  </td>
                  <td className="ta-r col-total">
                    <span className="mono">{fmtTokens(s.total)}</span>
                    <CometBar value={s.total} max={max} color={projColor(s.project)} height={3} delay={0} />
                  </td>
                  <td className="ta-r mono">{s.subagents || <span className="faint">0</span>}</td>
                  <td className="ta-r mono">{fmtInt(s.toolCalls)}</td>
                  <td className={cx('ta-r mono', s.compactions > 1 && 'warn-text')}>{s.compactions || <span className="faint">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limit && (
            <button className="rank__more" onClick={() => setLimit((l) => l + PAGE)}>
              {t('sessions.more', { n: fmtInt(rows.length - limit) })}
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}
