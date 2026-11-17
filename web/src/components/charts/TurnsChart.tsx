import { useId, useState, type MouseEvent } from 'react';
import { fmtCompact, fmtPct, fmtTime, fmtTokens } from '../../lib/format';
import { t } from '../../i18n';
import { Tooltip, TipRow, useTip, useWidth } from '../ui';
import { niceTicks } from './scale';

/**
 * Main-agent turns: context fill (area, left axis, dashed window limit)
 * and cumulative tokens (line, right axis). Vertical markers are compactions.
 */
export default function TurnsChart({
  series,
  limit,
  compactions,
  height = 280,
}: {
  series: { ts: number; total: number; context: number }[];
  limit: number | null;
  compactions: number[];
  height?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const [hi, setHi] = useState<number | null>(null);
  const padL = 56;
  const padR = 60;
  const padT = 16;
  const padB = 28;
  if (series.length < 2) return <div ref={ref} className="chart" style={{ height }} />;
  const t0 = series[0].ts;
  const t1 = series[series.length - 1].ts;
  const sx = (t: number) => padL + ((t - t0) / Math.max(1, t1 - t0)) * (width - padL - padR);
  const maxCtx = Math.max(...series.map((s) => s.context));
  const ctxTicks = niceTicks(Math.max(maxCtx, limit && limit < maxCtx * 1.6 ? limit : 0));
  const cMax = ctxTicks[ctxTicks.length - 1];
  const totTicks = niceTicks(series[series.length - 1].total);
  const tMax = totTicks[totTicks.length - 1];
  const innerH = height - padT - padB;
  const syc = (v: number) => padT + innerH - (v / cMax) * innerH;
  const syt = (v: number) => padT + innerH - (v / tMax) * innerH;

  const ctxLine = series.map((s, i) => `${i ? 'L' : 'M'}${sx(s.ts).toFixed(1)},${syc(s.context).toFixed(1)}`).join('');
  const totLine = series.map((s, i) => `${i ? 'L' : 'M'}${sx(s.ts).toFixed(1)},${syt(s.total).toFixed(1)}`).join('');
  const base = syc(0);

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best = 0;
    let bd = Infinity;
    series.forEach((s, i) => {
      const d = Math.abs(sx(s.ts) - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHi(best);
    const s = series[best];
    show(
      e,
      <>
        <div className="tip-title">
          {t('chart.turn', { n: best + 1, time: fmtTime(s.ts) })}
        </div>
        <TipRow color="#5cc8ff" label={t('chart.context')} value={fmtTokens(s.context)} />
        {limit && <TipRow label={t('chart.windowFill')} value={fmtPct(s.context / limit, 0)} />}
        <TipRow color="#a78bfa" label={t('chart.cumulative')} value={fmtTokens(s.total)} />
      </>,
    );
  };

  const showLimit = limit != null && limit <= cMax;
  return (
    <div ref={ref} className="chart" onMouseLeave={() => (hide(), setHi(null))}>
      <svg width={width} height={height} role="img" aria-label={t('chart.turnsAria')}>
        <defs>
          <linearGradient id={`ctx-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5cc8ff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#5cc8ff" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ctxTicks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={syc(t)} y2={syc(t)} className="grid-line" />
            <text x={padL - 10} y={syc(t) + 4} textAnchor="end" className="axis-label">
              {fmtCompact(t)}
            </text>
          </g>
        ))}
        {totTicks.map((t) => (
          <text key={`r${t}`} x={width - padR + 10} y={syt(t) + 4} className="axis-label axis-label--violet">
            {fmtCompact(t)}
          </text>
        ))}
        {showLimit && (
          <g>
            <line x1={padL} x2={width - padR} y1={syc(limit!)} y2={syc(limit!)} stroke="#ffb15c" strokeOpacity="0.55" strokeDasharray="4 5" />
            <text x={padL + 6} y={syc(limit!) - 6} className="axis-label" fill="#ffb15c">
              {t('chart.windowLimit', { n: fmtCompact(limit!) })}
            </text>
          </g>
        )}
        {compactions.map((ts, i) => (
          <g key={i}>
            <line x1={sx(ts)} x2={sx(ts)} y1={padT} y2={base} stroke="#ff6fb0" strokeOpacity="0.6" strokeDasharray="2 4" />
            <text x={sx(ts) + 5} y={padT + 10} className="axis-label" fill="#ff6fb0">
              {t('chart.compaction')}
            </text>
          </g>
        ))}
        <path d={`${ctxLine}L${sx(t1)},${base}L${sx(t0)},${base}Z`} fill={`url(#ctx-${uid})`} className="area-in" />
        <path d={ctxLine} pathLength={1} fill="none" stroke="#5cc8ff" strokeWidth="1.6" className="line-draw" style={{ filter: 'drop-shadow(0 0 6px rgba(92,200,255,.6))' }} />
        <path d={totLine} pathLength={1} fill="none" stroke="#a78bfa" strokeWidth="1.6" className="line-draw line-draw--late" style={{ filter: 'drop-shadow(0 0 6px rgba(167,139,250,.55))' }} />
        {hi != null && (
          <g>
            <line x1={sx(series[hi].ts)} x2={sx(series[hi].ts)} y1={padT} y2={base} stroke="rgba(230,235,245,.35)" />
            <circle cx={sx(series[hi].ts)} cy={syc(series[hi].context)} r="4" fill="#5cc8ff" stroke="#fff" strokeWidth="1.5" />
            <circle cx={sx(series[hi].ts)} cy={syt(series[hi].total)} r="4" fill="#a78bfa" stroke="#fff" strokeWidth="1.5" />
          </g>
        )}
        {[t0, t0 + (t1 - t0) / 2, t1].map((t, i) => (
          <text key={i} x={sx(t)} y={height - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="axis-label">
            {fmtTime(t)}
          </text>
        ))}
        <rect x={padL} y={padT} width={Math.max(0, width - padL - padR)} height={innerH} fill="transparent" onMouseMove={onMove} />
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
