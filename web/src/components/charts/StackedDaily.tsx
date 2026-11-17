import { useId, useState } from 'react';
import type { DailyPoint } from '@shared/api';
import { fmtCompact, fmtDay, fmtInt, fmtTokens, fmtWeekday, parseDay } from '../../lib/format';
import { t } from '../../i18n';
import { Tooltip, TipRow, useTip, useWidth } from '../ui';
import { niceTicks } from './scale';

export interface Series {
  key: string;
  label: string;
  color: string;
}

/** Daily bars stacked by series (models). */
export default function StackedDaily({
  daily,
  series,
  value,
  height = 260,
}: {
  daily: DailyPoint[];
  series: Series[];
  value: (d: DailyPoint, key: string) => number;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const padL = 52;
  const padR = 8;
  const padT = 12;
  const padB = 30;
  const innerW = Math.max(10, width - padL - padR);
  const innerH = height - padT - padB;
  const totals = daily.map((d) => series.reduce((s, x) => s + value(d, x.key), 0));
  const ticks = niceTicks(Math.max(...totals, 1));
  const yMax = ticks[ticks.length - 1];
  const band = innerW / Math.max(1, daily.length);
  const barW = Math.min(56, Math.max(2, band * (daily.length > 40 ? 0.7 : 0.58)));
  const y = (v: number) => padT + innerH - (v / yMax) * innerH;
  const labelEvery = Math.ceil(daily.length / Math.max(1, Math.floor(innerW / 64)));

  return (
    <div ref={ref} className="chart" onMouseLeave={() => (hide(), setHover(null))}>
      <svg width={width} height={height} role="img" aria-label={t('chart.dailyAria')}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`sd-${uid}-${cssId(s.key)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="1" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.55" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={padL - 10} y={y(t) + 4} textAnchor="end" className="axis-label">
              {fmtCompact(t)}
            </text>
          </g>
        ))}
        {daily.map((d, i) => {
          const cx0 = padL + band * i + band / 2;
          let acc = 0;
          const wd = parseDay(d.date).getDay();
          const weekend = wd === 0 || wd === 6;
          return (
            <g key={d.date} className="bar-col" style={{ animationDelay: `${Math.min(i * 18, 600)}ms`, transformOrigin: `0 ${y(0)}px` }} opacity={hover == null || hover === i ? 1 : 0.42}>
              {weekend && <rect x={padL + band * i} y={padT} width={band} height={innerH} fill="rgba(120,150,220,.035)" />}
              {series.map((s, si) => {
                const v = value(d, s.key);
                if (v <= 0) return null;
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                const top = si === series.length - 1 || series.slice(si + 1).every((n) => value(d, n.key) <= 0);
                return (
                  <rect
                    key={s.key}
                    x={cx0 - barW / 2}
                    y={y1}
                    width={barW}
                    height={Math.max(0.5, y0 - y1 - (top ? 0 : 1))}
                    rx={top ? Math.min(3, barW / 3) : 0}
                    fill={`url(#sd-${uid}-${cssId(s.key)})`}
                  />
                );
              })}
              {hover === i && totals[i] > 0 && <rect x={cx0 - barW / 2 - 1} y={y(totals[i]) - 2} width={barW + 2} height={2} rx={1} fill="#fff" opacity={0.85} filter="drop-shadow(0 0 6px #fff)" />}
              <rect
                x={padL + band * i}
                y={padT}
                width={band}
                height={innerH}
                fill="transparent"
                onMouseMove={(e) => {
                  setHover(i);
                  show(
                    e,
                    <>
                      <div className="tip-title">
                        {fmtWeekday(d.date)}, {fmtDay(d.date)}
                      </div>
                      {series
                        .map((s) => ({ s, v: value(d, s.key) }))
                        .filter((x) => x.v > 0)
                        .reverse()
                        .map(({ s, v }) => (
                          <TipRow key={s.key} color={s.color} label={s.label} value={fmtTokens(v)} />
                        ))}
                      <div className="tip-sep" />
                      <TipRow label={t('chart.total')} value={fmtTokens(totals[i])} />
                      <TipRow label={t('chart.sessions')} value={fmtInt(d.sessions)} />
                    </>,
                  );
                }}
              />
            </g>
          );
        })}
        <line x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} className="axis-line" />
        {daily.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d.date} x={padL + band * i + band / 2} y={height - 10} textAnchor="middle" className="axis-label">
              {daily.length <= 14 ? `${fmtWeekday(d.date)} ${parseDay(d.date).getDate()}` : fmtDay(d.date)}
            </text>
          ) : null,
        )}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

function cssId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_');
}
