import { useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AgentChanges, AgentNode, SessionDetail, TimelineItem } from '@shared/api';
import { t, tp, type MsgKey } from '../i18n';
import { useApi } from '../lib/api';
import { alpha, branchColor, modelColor, shade, STATUS } from '../lib/colors';
import { fmtCompact, fmtDateTime, fmtDuration, fmtInt, fmtModel, fmtPct, fmtTime, fmtTokens, sumTokens } from '../lib/format';
import { href } from '../lib/router';
import TurnsChart from '../components/charts/TurnsChart';
import { Legend } from '../components/charts/small';
import RankList from '../components/RankList';
import { Chip, CometBar, cx, Empty, ErrorState, Loading, Panel, Segmented } from '../components/ui';
import Recommendations from '../components/Recommendations';
import { HEAVY_MAX } from './Tools';
import { changesPath, FileList } from '../galaxy/AgentChanges';

export default function SessionPage({ id }: { id: string }) {
  const q = useApi<SessionDetail>(`/api/session/${encodeURIComponent(id)}`);
  if (q.loading) return <Loading label={t('session.opening')} />;
  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reload} />;
  if (!q.data) return <Loading />;
  return <Body d={q.data} />;
}

interface FlatAgent {
  node: AgentNode;
  color: string;
  guides: string[]; // colors of the ancestors' vertical guides
}

function flatten(root: AgentNode): FlatAgent[] {
  const out: FlatAgent[] = [];
  const walk = (n: AgentNode, color: string, guides: string[]) => {
    out.push({ node: n, color, guides });
    n.children.forEach((c, i) => {
      const cc = n.depth === 0 ? branchColor(i) : shade(color, c.depth);
      walk(c, cc, n.depth === 0 ? [] : [...guides, color]);
    });
  };
  walk(root, '#e6ebf5', []);
  return out;
}

function Body({ d }: { d: SessionDetail }) {
  const s = d.summary;
  const agents = useMemo(() => flatten(d.tree), [d.tree]);
  const colorOf = useMemo(() => new Map(agents.map((a) => [a.node.id, a.color])), [agents]);
  const typeOf = useMemo(() => new Map(agents.map((a) => [a.node.id, a.node.type])), [agents]);
  const compactTs = d.timeline.filter((e) => e.kind === 'compact').map((e) => e.ts);
  const peakCtx = Math.max(0, ...d.tokensSeries.map((p) => p.context));
  // SessionDetail has no window limit: derive it from the model ([1m]) or the actual peak.
  const limit = s.model?.includes('[1m]') || peakCtx > 200_000 ? 1_000_000 : 200_000;
  const ctxTotal = d.context.reduce((a, c) => a + c.tokens, 0);

  return (
    <div className="stack">
      <header className="session-head">
        <a className="crumb" href={href('/analytics/sessions', { project: s.project })}>
          ← {t('session.projectSessions')} <span className="mono">{s.project}</span>
        </a>
        <h1 className="page-title">
          {s.title ?? t('session.untitled')}
          {d.archived && (
            <>
              {' '}
              <Chip tone="muted">{t('session.archived')}</Chip>
            </>
          )}
        </h1>
        <div className="session-meta">
          <a className="btn btn--replay" href={href(`/replay/${encodeURIComponent(s.sessionId)}`)} title={t('session.replayTitle')}>
            {t('session.replay')}
          </a>
          <span className="mono">{fmtDateTime(s.startedAt)}</span>
          <span className="sep">·</span>
          <span>{fmtDuration(s.durationMs)}</span>
          <span className="sep">·</span>
          <span style={{ color: s.model ? modelColor(s.model) : undefined }}>{fmtModel(s.model)}</span>
          {s.effort && <span className="effort mono">{s.effort}</span>}
          <span className="sep">·</span>
          <span className="mono faint" title={s.cwd}>
            {s.sessionId}
          </span>
        </div>
        <div className="facts facts--inline glass">
          <MiniFact label={t('session.tokens')} value={fmtTokens(s.total)} />
          <MiniFact label={t('session.peakCtx')} value={fmtTokens(peakCtx)} note={fmtPct(peakCtx / limit, 0)} tone={peakCtx / limit > 0.8 ? 'warn' : undefined} />
          <MiniFact label={t('session.subagents')} value={fmtInt(s.subagents)} />
          <MiniFact label={t('session.calls')} value={fmtInt(s.toolCalls)} />
          <MiniFact label={t('session.compactions')} value={fmtInt(s.compactions)} tone={s.compactions > 1 ? 'warn' : undefined} />
          <MiniFact label={t('session.cache')} value={fmtPct(s.tokens.cacheRead / Math.max(1, s.tokens.input + s.tokens.cacheRead + s.tokens.cacheWrite))} />
        </div>
        {d.archived && <p className="page-lede">{t('session.archivedNote')}</p>}
      </header>

      <Recommendations page="session" session={s.sessionId} />

      <div className="grid grid--5-7">
        <Panel title={t('session.tree')} hint={t('session.treeHint')}>
          <AgentTree agents={agents} />
        </Panel>
        <Panel
          title={t('session.turns')}
          hint={t('session.turnsHint')}
          actions={
            <Legend
              items={[
                { label: t('chart.context'), color: '#5cc8ff' },
                { label: t('chart.cumulative'), color: '#a78bfa' },
              ]}
            />
          }
        >
          {d.tokensSeries.length > 1 ? <TurnsChart series={d.tokensSeries} limit={limit} compactions={compactTs} /> : <Empty title={d.archived ? t('session.archivedNoData') : t('session.fewTurns')} />}
        </Panel>
      </div>

      <div className="grid grid--7-5">
        <Panel title={t('session.timeline')} hint={`${tp('session.events', d.timeline.length, { count: fmtInt(d.timeline.length) })}${d.timeline.length >= 2000 ? t('session.latestShown', { n: fmtInt(2000) }) : ''}`}>
          <Timeline items={d.timeline} colorOf={colorOf} typeOf={typeOf} />
        </Panel>
        <div className="stack">
          <Panel title={t('nav.context')} hint={t('session.startupHint', { n: fmtTokens(ctxTotal) })}>
            <ContextBars items={d.context} />
          </Panel>
          <Panel title={t('session.tools')}>
            <RankList
              dense
              showIndex={false}
              valueHeader={t('col.calls')}
              columns={[t('col.avg'), t('col.max')]}
              colWidth={[60, 64]}
              items={d.tools.map((tool, i) => {
                const mx = Number(tool.extra?.maxResult ?? 0);
                return {
                  key: tool.key,
                  label: <span className="mono">{tool.label.replace(/^mcp__/, '')}</span>,
                  value: tool.calls,
                  valueText: fmtInt(tool.calls),
                  color: branchColor(i),
                  cols: [fmtCompact(Number(tool.extra?.avgResult ?? 0)), <span className={mx >= HEAVY_MAX ? 'warn-text' : undefined}>{fmtCompact(mx)}</span>],
                };
              })}
            />
          </Panel>
        </div>
      </div>
      {!d.archived && <FilesChanged sessionId={s.sessionId} colorOf={colorOf} />}
    </div>
  );
}

/** Every file the session's agents changed (all transcripts merged); hidden when nothing was changed. */
function FilesChanged({ sessionId, colorOf }: { sessionId: string; colorOf: Map<string, string> }) {
  const q = useApi<AgentChanges>(changesPath(sessionId, 'all'));
  const c = q.data;
  if (!c || c.archived || !c.files.length) return null;
  return (
    <Panel title={t('ch.session.title')} hint={t('ch.session.hint')}>
      <FileList c={c} agentColors={(id) => colorOf.get(id)} />
    </Panel>
  );
}

function MiniFact({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'warn' }) {
  return (
    <div className={cx('fact', tone && `fact--${tone}`)}>
      <div className="fact__value mono">
        {value}
        {note && <span className="fact__note"> {note}</span>}
      </div>
      <div className="fact__label">{label}</div>
    </div>
  );
}

// ---------- Tree ----------

const STATUS_LABEL: Record<AgentNode['status'], MsgKey> = { working: 'status.working', waiting: 'status.waiting', idle: 'status.idle', done: 'status.done' };

function AgentTree({ agents }: { agents: FlatAgent[] }) {
  const [all, setAll] = useState(false);
  const max = Math.max(...agents.slice(1).map((a) => sumTokens(a.node.tokens)), 1);
  const shown = all ? agents : agents.slice(0, 40);
  return (
    <div className="tree">
      {shown.map(({ node, color, guides }, i) => {
        const tok = sumTokens(node.tokens);
        const root = node.depth === 0;
        return (
          <div key={`${node.id}-${i}`} className={cx('tree__row', root && 'tree__row--root')} style={{ '--c': color, animationDelay: `${Math.min(i * 30, 600)}ms` } as CSSProperties}>
            <div className="tree__indent" aria-hidden>
              {guides.map((g, j) => (
                <span key={j} className="tree__guide" style={{ '--g': alpha(g, 0.35) } as CSSProperties} />
              ))}
              {node.depth > 0 && <span className="tree__elbow" style={{ borderColor: alpha(color, 0.55) }} />}
            </div>
            <span className={cx('tree__orb', `is-${node.status}`)} style={{ background: color, boxShadow: `0 0 ${root ? 14 : 8}px ${color}`, width: root ? 12 : node.depth === 1 ? 9 : 6, height: root ? 12 : node.depth === 1 ? 9 : 6 }} />
            <div className="tree__body">
              <div className="tree__line">
                <span className="tree__type">{root ? t('session.mainAgent') : node.type}</span>
                {node.effort && <span className="effort mono">{node.effort}</span>}
                <span className="tree__model">{fmtModel(node.model)}</span>
                {node.status !== 'done' && <span className="tree__status" style={{ color: node.status === 'waiting' ? STATUS.waiting : STATUS.working }}>{t(STATUS_LABEL[node.status])}</span>}
              </div>
              {node.description && <div className="tree__desc">{node.description}</div>}
              {!root && <CometBar value={tok} max={max} color={color} height={3} delay={100 + i * 25} />}
            </div>
            <div className="tree__nums">
              <span className="mono">{fmtTokens(tok)}</span>
              <span className="faint mono">{t('session.toolCallsShort', { n: fmtInt(node.toolCalls) })}</span>
            </div>
          </div>
        );
      })}
      {agents.length > 40 && (
        <button className="rank__more" onClick={() => setAll((v) => !v)}>
          {all ? t('rank.collapse') : t('session.showAllAgents', { n: agents.length })}
        </button>
      )}
    </div>
  );
}

// ---------- Timeline (virtualized) ----------

const KIND: Record<TimelineItem['kind'], { labelKey: MsgKey; color: string }> = {
  prompt: { labelKey: 'tl.kind.prompt', color: '#e6ebf5' },
  tool: { labelKey: 'tl.kind.tool', color: '#8e9ab0' },
  spawn: { labelKey: 'tl.kind.spawn', color: '#4fe0b0' },
  finish: { labelKey: 'tl.kind.finish', color: '#6b7cff' },
  text: { labelKey: 'tl.kind.text', color: '#a78bfa' },
  compact: { labelKey: 'tl.kind.compact', color: '#ff6fb0' },
  turn: { labelKey: 'tl.kind.turn', color: '#5cc8ff' },
};

type Filter = 'all' | 'prompt' | 'tool' | 'agents' | 'text' | 'compact';
const ROW = 34;
const VIEW = 560;

function Timeline({ items, colorOf, typeOf }: { items: TimelineItem[]; colorOf: Map<string, string>; typeOf: Map<string, string> }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [top, setTop] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useMemo(() => {
    const f = items.filter((e) => filter === 'all' || (filter === 'agents' ? e.kind === 'spawn' || e.kind === 'finish' : filter === 'tool' ? e.kind === 'tool' || e.kind === 'turn' : e.kind === filter));
    return f;
  }, [items, filter]);
  const start = Math.max(0, Math.floor(top / ROW) - 6);
  const end = Math.min(list.length, start + Math.ceil(VIEW / ROW) + 12);

  return (
    <div className="timeline">
      <Segmented<Filter>
        label={t('tl.filter')}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setTop(0);
          if (box.current) box.current.scrollTop = 0;
        }}
        options={[
          { id: 'all', label: t('tl.all') },
          { id: 'prompt', label: t('tl.prompts') },
          { id: 'tool', label: t('tl.tools') },
          { id: 'agents', label: t('tl.agents') },
          { id: 'text', label: t('tl.text') },
          { id: 'compact', label: t('tl.compactions') },
        ]}
      />
      {list.length === 0 ? (
        <Empty title={t('tl.empty')} />
      ) : (
        <div ref={box} className="timeline__scroll" style={{ height: Math.min(VIEW, list.length * ROW + 2) }} onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
          <div style={{ height: list.length * ROW, position: 'relative' }}>
            {list.slice(start, end).map((e, i) => {
              const idx = start + i;
              const c = colorOf.get(e.agentId) ?? '#8e9ab0';
              const k = KIND[e.kind];
              return (
                <div key={idx} className={cx('tl', `tl--${e.kind}`)} style={{ top: idx * ROW, height: ROW }}>
                  <span className="tl__time mono">{fmtTime(e.ts, true)}</span>
                  <span className="tl__agent" title={e.agentId}>
                    <span className="dot" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                    <span className="tl__agent-name">{e.agentId === 'main' ? t('tl.main') : (typeOf.get(e.agentId) ?? e.agentId.slice(0, 7))}</span>
                  </span>
                  <span className="tl__kind" style={{ color: k.color, borderColor: alpha(k.color === '#e6ebf5' ? '#8e9ab0' : k.color, 0.35) }}>
                    {t(k.labelKey)}
                  </span>
                  <span className={cx('tl__label', e.kind === 'tool' && 'mono')} title={e.label}>
                    {e.label}
                  </span>
                  <span className="tl__tok mono">{e.tokens ? fmtCompact(e.tokens) : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Context breakdown ----------

function ContextBars({ items }: { items: SessionDetail['context'] }) {
  const total = items.reduce((s, x) => s + x.tokens, 0) || 1;
  const sorted = [...items].sort((a, b) => b.tokens - a.tokens);
  if (!items.length) return <Empty title={t('session.ctxUnknown')} />;
  return (
    <div className="ctxbars">
      <div className="budget__bar budget__bar--sm">
        {sorted.map((x, i) => (
          <div key={x.key ?? x.label} className="budget__seg" title={`${x.label}: ${fmtTokens(x.tokens)}`} style={{ flexGrow: x.tokens, '--c': branchColor(i), '--cbg': alpha(branchColor(i), 0.22), animationDelay: `${i * 50}ms` } as CSSProperties} />
        ))}
      </div>
      <ul className="legend legend--col">
        {sorted.map((x, i) => (
          <li key={x.key ?? x.label}>
            <span className="dot" style={{ background: branchColor(i), boxShadow: `0 0 8px ${branchColor(i)}` }} />
            <span className="legend__label">{x.label}</span>
            <span className="legend__value mono">{fmtTokens(x.tokens)}</span>
            <span className="legend__pct mono">{fmtPct(x.tokens / total, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
