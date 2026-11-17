import { useState } from 'react';
import type { AttributionReport, UsageRow } from '@shared/api';
import { t } from '../i18n';
import { branchColor, STATUS } from '../lib/colors';
import { fmtCompact, fmtInt, fmtTokens } from '../lib/format';
import RankList from '../components/RankList';
import { Chip, PageHeader, Panel, Segmented, Tooltip, TipRow, useTip, useWidth } from '../components/ui';
import { logTicks } from '../components/charts/scale';
import { Fact } from './Mcp';
import { Eyebrow, Guard, useRangeApi } from './common';

/** Threshold for a "too large" result (tokens). */
export const HEAVY_MAX = 20_000;
export const HEAVY_AVG = 5_000;

const num = (r: UsageRow, k: string) => Number(r.extra?.[k] ?? 0);
const isHeavy = (r: UsageRow) => num(r, 'maxResult') >= HEAVY_MAX || num(r, 'avgResult') >= HEAVY_AVG;

function shortTool(name: string): { name: string; server?: string } {
  const m = name.match(/^mcp__(.+?)__(.+)$/);
  return m ? { name: m[2], server: m[1] } : { name };
}

export default function Tools() {
  const q = useRangeApi<AttributionReport>('/api/analytics/attribution');
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow section={t('nav.tools')} range={q.range} />}
        title={t('tools.title')}
        lede={t('tools.lede')}
      />
      <Guard state={q}>{(d) => <Body tools={d.tools} />}</Guard>
    </>
  );
}

type Sort = 'result' | 'calls' | 'max';

function Body({ tools }: { tools: UsageRow[] }) {
  const [sort, setSort] = useState<Sort>('result');
  const heavy = tools.filter(isHeavy);
  const totalCalls = tools.reduce((s, r) => s + r.calls, 0);
  const totalResult = tools.reduce((s, r) => s + num(r, 'resultTokens'), 0);
  const sorted = [...tools].sort((a, b) => (sort === 'calls' ? b.calls - a.calls : sort === 'max' ? num(b, 'maxResult') - num(a, 'maxResult') : num(b, 'resultTokens') - num(a, 'resultTokens')));
  const valueOf = (r: UsageRow) => (sort === 'calls' ? r.calls : sort === 'max' ? num(r, 'maxResult') : num(r, 'resultTokens'));

  return (
    <div className="stack">
      <section className="facts glass">
        <Fact value={fmtInt(tools.length)} label={t('tools.inUse')} />
        <Fact value={fmtInt(totalCalls)} label={t('tools.calls')} />
        <Fact value={fmtTokens(totalResult)} label={t('common.resultTokens')} />
        <Fact value={fmtInt(heavy.length)} label={t('tools.overN', { n: fmtCompact(HEAVY_MAX) })} tone={heavy.length ? 'warn' : undefined} />
      </section>

      <div className="grid grid--1-1">
        <Panel title={t('tools.spread')} hint={t('tools.spreadHint')}>
          <Spread tools={[...tools].sort((a, b) => num(b, 'maxResult') - num(a, 'maxResult'))} />
        </Panel>
        <Panel
          title={t('tools.ranking')}
          actions={
            <Segmented<Sort>
              label={t('tools.sort')}
              value={sort}
              onChange={setSort}
              options={[
                { id: 'result', label: t('tools.sortResult') },
                { id: 'calls', label: t('tools.sortCalls') },
                { id: 'max', label: t('col.max') },
              ]}
            />
          }
        >
          <RankList
            valueHeader={sort === 'calls' ? t('col.calls') : sort === 'max' ? t('col.max') : t('col.results')}
            columns={[t('col.callsShort'), t('col.avg'), t('col.max')]}
            colWidth={[64, 64, 72]}
            items={sorted.map((r, i) => {
              const s = shortTool(r.label);
              const heavyRow = isHeavy(r);
              return {
                key: r.key,
                label: <span className="mono">{s.name}</span>,
                sub: s.server ? <span className="mono">MCP · {s.server}</span> : undefined,
                badge: heavyRow ? <Chip tone="warn">{t('tools.heavy')}</Chip> : undefined,
                value: valueOf(r),
                valueText: sort === 'calls' ? fmtInt(r.calls) : fmtTokens(valueOf(r)),
                color: branchColor(i),
                cols: [fmtInt(r.calls), fmtCompact(num(r, 'avgResult')), <span className={num(r, 'maxResult') >= HEAVY_MAX ? 'warn-text' : undefined}>{fmtCompact(num(r, 'maxResult'))}</span>],
              };
            })}
          />
        </Panel>
      </div>
    </div>
  );
}

function Spread({ tools }: { tools: UsageRow[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const rows = tools.filter((r) => num(r, 'maxResult') > 0);
  const padL = 150;
  const padR = 16;
  const rowH = 30;
  const padT = 26;
  const lo = 50;
  const hi = Math.max(100_000, ...rows.map((r) => num(r, 'maxResult') * 1.2));
  const sx = (v: number) => padL + ((Math.log(Math.max(lo, v)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (width - padL - padR);
  const h = padT + rows.length * rowH + 8;
  return (
    <div ref={ref} className="chart" onMouseLeave={hide}>
      <svg width={width} height={h} role="img" aria-label={t('tools.spreadAria')}>
        {logTicks(lo * 2, hi)
          .filter((v) => String(v)[0] === '1')
          .map((v) => (
            <g key={v}>
              <line x1={sx(v)} x2={sx(v)} y1={padT - 6} y2={h - 6} className="grid-line" />
              <text x={sx(v)} y={14} textAnchor="middle" className="axis-label">
                {fmtCompact(v)}
              </text>
            </g>
          ))}
        <rect x={sx(HEAVY_MAX)} y={padT - 6} width={Math.max(0, width - padR - sx(HEAVY_MAX))} height={h - padT} fill="rgba(255,177,92,.05)" />
        <line x1={sx(HEAVY_MAX)} x2={sx(HEAVY_MAX)} y1={padT - 6} y2={h - 6} stroke={STATUS.waiting} strokeOpacity="0.5" strokeDasharray="3 4" />
        {rows.map((r, i) => {
          const y = padT + i * rowH + rowH / 2;
          const avg = num(r, 'avgResult');
          const max = num(r, 'maxResult');
          const heavyMax = max >= HEAVY_MAX;
          const c = branchColor(i);
          const s = shortTool(r.label);
          return (
            <g
              key={r.key}
              className="spread-row"
              style={{ animationDelay: `${i * 40}ms` }}
              onMouseMove={(e) =>
                show(
                  e,
                  <>
                    <div className="tip-title mono">{r.label}</div>
                    <TipRow label={t('tools.avgResult')} value={fmtTokens(avg)} />
                    <TipRow color={heavyMax ? STATUS.waiting : c} label={t('tools.largest')} value={fmtTokens(max)} />
                    <TipRow label={t('col.calls')} value={fmtInt(r.calls)} />
                  </>,
                )
              }
            >
              <rect x={0} y={y - rowH / 2} width={width} height={rowH} fill="transparent" />
              <text x={padL - 14} y={y + 4} textAnchor="end" className="spread-label">
                {s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name}
              </text>
              <line x1={sx(lo)} x2={width - padR} y1={y} y2={y} stroke="rgba(120,150,220,.08)" />
              <line x1={sx(avg)} x2={sx(heavyMax ? Math.max(avg, HEAVY_MAX) : max)} y1={y} y2={y} stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.65" />
              {heavyMax && <line x1={sx(Math.max(avg, HEAVY_MAX))} x2={sx(max)} y1={y} y2={y} stroke={STATUS.waiting} strokeWidth="2" strokeLinecap="round" opacity="0.9" />}
              <circle cx={sx(max)} cy={y} r="3.2" fill={heavyMax ? STATUS.waiting : c} style={{ filter: `drop-shadow(0 0 6px ${heavyMax ? STATUS.waiting : c})` }} />
              <circle cx={sx(avg)} cy={y} r="5" fill="#03040a" stroke={c} strokeWidth="2" />
            </g>
          );
        })}
        <text x={sx(HEAVY_MAX) + 6} y={h - 10} className="axis-label" fill={STATUS.waiting}>
          {t('tools.heavyZone')}
        </text>
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
