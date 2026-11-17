import { useId, useState, type ReactNode } from 'react';
import { alpha } from '../../lib/colors';
import { fmtPct, fmtTokens } from '../../lib/format';
import { t } from '../../i18n';
import { Tooltip, TipRow, useTip, useWidth } from '../ui';

// ---------- Sparkline ----------

export function Sparkline({ values, color = '#5cc8ff', width = 120, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (values.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / (max - min || 1)) * (height - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className="spark" aria-hidden>
      <defs>
        <linearGradient id={`sp-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${width},${height}L0,${height}Z`} fill={`url(#sp-${uid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" className="spark__line" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill="#fff" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

// ---------- Donut ----------

export interface DonutSeg {
  key: string;
  label: string;
  value: number;
  color: string;
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => [cx + r * Math.cos(a - Math.PI / 2), cy + r * Math.sin(a - Math.PI / 2)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0},${y0}A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
}

export function Donut({ segments, size = 200, center }: { segments: DonutSeg[]; size?: number; center?: { label: string; value: string } }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 14;
  const gap = 0.03;
  const minA = 0.07;
  // minimum visible angle for tiny parts; the rest is scaled down proportionally
  const raw = segments.map((s) => (s.value / total) * Math.PI * 2);
  const small = raw.filter((a) => a < minA).length;
  const bigSum = raw.filter((a) => a >= minA).reduce((s, a) => s + a, 0);
  const avail = Math.PI * 2 - small * minA;
  const angles = raw.map((a) => (a < minA ? minA : (a / bigSum) * avail));
  let a = 0;
  const h = hover ? segments.find((s) => s.key === hover) : null;
  return (
    <div className="donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t('chart.donutAria')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(120,150,220,.08)" strokeWidth="14" />
        {segments.map((s, i) => {
          const a0 = a + gap / 2;
          const a1 = a + angles[i] - gap / 2;
          a += angles[i];
          const on = hover === s.key;
          return (
            <path
              key={s.key}
              d={arc(size / 2, size / 2, r, a0, Math.max(a0 + 0.001, a1))}
              fill="none"
              stroke={s.color}
              strokeWidth={on ? 18 : 14}
              strokeLinecap="round"
              className="donut__seg"
              style={{ filter: `drop-shadow(0 0 ${on ? 10 : 5}px ${alpha(s.color, 0.7)})`, animationDelay: `${i * 120}ms` }}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="donut__value">
          {h ? fmtPct(h.value / total) : (center?.value ?? '')}
        </text>
        <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="donut__label">
          {h ? h.label : (center?.label ?? '')}
        </text>
      </svg>
      <ul className="legend legend--col">
        {segments.map((s) => (
          <li key={s.key} className={hover === s.key ? 'is-hover' : ''} onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
            <span className="dot" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
            <span className="legend__label">{s.label}</span>
            <span className="legend__value mono">{fmtTokens(s.value)}</span>
            <span className="legend__pct mono">{fmtPct(s.value / total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Heatmap: week × hour ----------


export function Heatmap({ cells }: { cells: { weekday: number; hour: number; total: number }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const grid = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.total]));
  const max = Math.max(...cells.map((c) => c.total), 1);
  const padL = 30;
  const padT = 20;
  const gap = 3;
  const cell = Math.max(8, Math.min(30, (width - padL - gap * 23) / 24));
  const h = padT + 7 * (cell + gap);
  const peak = cells.reduce((a, c) => (c.total > a.total ? c : a), cells[0] ?? { weekday: 0, hour: 0, total: 0 });
  // Monday-first weekday names, resolved for the current language at render time.
  const wdShort = t('chart.weekdays').split(',');
  const wdFull = t('chart.weekdaysFull').split(',');
  return (
    <div ref={ref} className="chart" onMouseLeave={hide}>
      <svg width={width} height={h} role="img" aria-label={t('chart.heatmapAria')}>
        {[0, 3, 6, 9, 12, 15, 18, 21].map((hr) => (
          <text key={hr} x={padL + hr * (cell + gap) + cell / 2} y={12} textAnchor="middle" className="axis-label">
            {String(hr).padStart(2, '0')}
          </text>
        ))}
        {wdShort.map((d, wd) => (
          <g key={d}>
            <text x={0} y={padT + wd * (cell + gap) + cell / 2 + 4} className="axis-label">
              {d}
            </text>
            {Array.from({ length: 24 }, (_, hr) => {
              const v = grid.get(`${wd}:${hr}`) ?? 0;
              const k = Math.sqrt(v / max);
              const isPeak = peak && peak.weekday === wd && peak.hour === hr && v > 0;
              return (
                <rect
                  key={hr}
                  x={padL + hr * (cell + gap)}
                  y={padT + wd * (cell + gap)}
                  width={cell}
                  height={cell}
                  rx={Math.min(4, cell / 4)}
                  className="heat-cell"
                  style={{ animationDelay: `${(wd * 24 + hr) * 3}ms` }}
                  fill={v <= 0 ? 'rgba(120,150,220,.05)' : heatColor(k)}
                  stroke={isPeak ? '#fff' : 'none'}
                  strokeOpacity={0.7}
                  onMouseMove={(e) =>
                    show(
                      e,
                      <>
                        <div className="tip-title">
                          {wdFull[wd]}, {String(hr).padStart(2, '0')}:00–{String(hr + 1).padStart(2, '0')}:00
                        </div>
                        <TipRow label={t('chart.tokens')} value={fmtTokens(v)} />
                        <TipRow label={t('chart.ofPeak')} value={fmtPct(v / max, 0)} />
                      </>,
                    )
                  }
                />
              );
            })}
          </g>
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/** From deep indigo to glowing sky blue and almost white. */
function heatColor(t: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [30, 36, 80]],
    [0.35, [80, 70, 200]],
    [0.7, [92, 170, 255]],
    [1, [210, 245, 255]],
  ];
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
  const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
  return `rgba(${c[0]},${c[1]},${c[2]},${0.35 + 0.65 * t})`;
}

// ---------- Legend ----------

export function Legend({ items }: { items: { label: ReactNode; color: string }[] }) {
  return (
    <ul className="legend">
      {items.map((it, i) => (
        <li key={i}>
          <span className="dot" style={{ background: it.color, boxShadow: `0 0 8px ${it.color}` }} />
          <span className="legend__label">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
