import { useState } from 'react';
import type { AttributionReport } from '@shared/api';
import { t } from '../i18n';
import { branchColor } from '../lib/colors';
import { fmtAgo, fmtCompact, fmtDuration, fmtInt, fmtTokens } from '../lib/format';
import Bubble from '../components/charts/Bubble';
import RankList from '../components/RankList';
import Recommendations from '../components/Recommendations';
import { Empty, PageHeader, Panel, TipRow } from '../components/ui';
import { Eyebrow, Guard, useRangeApi } from './common';

export default function Subagents() {
  const q = useRangeApi<AttributionReport>('/api/analytics/attribution');
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow section={t('nav.subagents')} range={q.range} />}
        title={t('sub.title')}
        lede={t('sub.lede')}
      />
      <Recommendations page="subagents" />
      <Guard state={q}>{(d) => <Body d={d} />}</Guard>
    </>
  );
}

function Body({ d }: { d: AttributionReport }) {
  const [sel, setSel] = useState<string | null>(null);
  const rows = d.subagentTypes;
  if (!rows.length) return <Empty title={t('sub.emptyTitle')}>{t('sub.emptyText')}</Empty>;
  const n = (r: (typeof rows)[number], k: string) => Number(r.extra?.[k] ?? 0);
  const colorOf = (key: string) => branchColor(rows.findIndex((r) => r.key === key));
  return (
    <div className="stack">
      <Panel title={t('sub.chart')} hint={t('sub.chartHint')}>
        <Bubble
          height={380}
          xLabel={t('sub.xLabel')}
          yLabel={t('sub.yLabel')}
          fmtX={(v) => fmtDuration(v)}
          xTicks={[10e3, 30e3, 60e3, 120e3, 300e3, 600e3, 1200e3, 1800e3, 3600e3, 7200e3]}
          fmtY={(v) => fmtCompact(v)}
          selected={sel}
          onSelect={(k) => setSel((s) => (s === k ? null : k))}
          points={rows.map((r) => ({
            key: r.key,
            label: r.label,
            x: n(r, 'avgDurationMs'),
            y: n(r, 'avgTokens'),
            size: r.calls,
            color: colorOf(r.key),
            tip: (
              <>
                <div className="tip-title">{r.label}</div>
                <TipRow label={t('col.runs')} value={fmtInt(r.calls)} />
                <TipRow label={t('sub.tokensPerRun')} value={fmtTokens(n(r, 'avgTokens'))} />
                <TipRow label={t('sub.avgDuration')} value={fmtDuration(n(r, 'avgDurationMs'))} />
                <TipRow label={t('col.total')} value={fmtTokens(r.total)} />
              </>
            ),
          }))}
        />
      </Panel>
      <Panel title={t('sub.types')}>
        <RankList
          valueHeader={t('col.total')}
          columns={[t('col.runs'), t('col.perRun'), t('col.duration'), t('col.depth'), t('col.sessions'), t('col.last')]}
          colWidth={[76, 88, 96, 70, 60, 104]}
          items={rows.map((r) => ({
            key: r.key,
            label: r.label,
            value: r.total,
            valueText: fmtTokens(r.total),
            color: colorOf(r.key),
            tone: sel && sel !== r.key ? 'muted' : undefined,
            onClick: () => setSel((s) => (s === r.key ? null : r.key)),
            cols: [
              fmtInt(r.calls),
              fmtTokens(n(r, 'avgTokens')),
              fmtDuration(n(r, 'avgDurationMs')),
              <DepthPips depth={n(r, 'maxDepth')} color={colorOf(r.key)} />,
              fmtInt(r.sessions),
              <span className="muted">{fmtAgo(r.lastUsed)}</span>,
            ],
          }))}
        />
      </Panel>
    </div>
  );
}

/** Nesting depth: planet → satellite → dust. */
function DepthPips({ depth, color }: { depth: number; color: string }) {
  return (
    <span className="pips" title={t('sub.maxDepth', { n: depth })}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= depth ? 'is-on' : ''} style={i <= depth ? { background: color, boxShadow: `0 0 6px ${color}` } : undefined} />
      ))}
    </span>
  );
}
