import { useState, type ReactNode } from 'react';
import { t } from '../../i18n';
import { alpha } from '../../lib/colors';
import { Tooltip, useTip, useWidth } from '../ui';
import { logTicks } from './scale';

export interface BubblePoint {
  key: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  tip: ReactNode;
}

/** Bubbles on log axes: x and y are values, area is size. */
export default function Bubble({
  points,
  height = 360,
  xLabel,
  yLabel,
  fmtX,
  fmtY,
  onSelect,
  selected,
  xTicks,
}: {
  points: BubblePoint[];
  height?: number;
  xLabel: string;
  yLabel: string;
  fmtX: (v: number) => string;
  fmtY: (v: number) => string;
  onSelect?: (key: string) => void;
  selected?: string | null;
  xTicks?: number[];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const [hover, setHover] = useState<string | null>(null);
  const padL = 64;
  const padR = 24;
  const padT = 24;
  const padB = 44;
  const valid = points.filter((p) => p.x > 0 && p.y > 0);
  if (!valid.length) return <div className="chart" ref={ref} style={{ height }} />;
  const xs = valid.map((p) => p.x);
  const ys = valid.map((p) => p.y);
  const x0 = Math.min(...xs) / 1.8;
  const x1 = Math.max(...xs) * 1.8;
  const y0 = Math.min(...ys) / 1.8;
  const y1 = Math.max(...ys) * 1.8;
  const sx = (v: number) => padL + ((Math.log(v) - Math.log(x0)) / (Math.log(x1) - Math.log(x0))) * (width - padL - padR);
  const sy = (v: number) => padT + (1 - (Math.log(v) - Math.log(y0)) / (Math.log(y1) - Math.log(y0))) * (height - padT - padB);
  const maxSize = Math.max(...valid.map((p) => p.size), 1);
  const rOf = (s: number) => 7 + Math.sqrt(s / maxSize) * 34;
  const sorted = [...valid].sort((a, b) => b.size - a.size);

  return (
    <div ref={ref} className="chart" onMouseLeave={() => (hide(), setHover(null))}>
      <svg width={width} height={height} role="img" aria-label={t('chart.vs', { y: yLabel, x: xLabel })}>
        <defs>
          {valid.map((p) => (
            <radialGradient key={p.key} id={`bb-${p.key.replace(/[^a-zA-Z0-9]/g, '_')}`} cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="22%" stopColor={p.color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={p.color} stopOpacity="0.18" />
            </radialGradient>
          ))}
        </defs>
        {(xTicks ? xTicks.filter((t) => t >= x0 && t <= x1) : logTicks(x0, x1)).map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={padT} y2={height - padB} className="grid-line" />
            <text x={sx(t)} y={height - padB + 18} textAnchor="middle" className="axis-label">
              {fmtX(t)}
            </text>
          </g>
        ))}
        {logTicks(y0, y1).map((t) => (
          <g key={`y${t}`}>
            <line x1={padL} x2={width - padR} y1={sy(t)} y2={sy(t)} className="grid-line" />
            <text x={padL - 10} y={sy(t) + 4} textAnchor="end" className="axis-label">
              {fmtY(t)}
            </text>
          </g>
        ))}
        <text x={width - padR} y={height - 6} textAnchor="end" className="axis-title">
          {xLabel} →
        </text>
        <text x={padL} y={12} className="axis-title">
          ↑ {yLabel}
        </text>
        {sorted.map((p, i) => {
          const r = rOf(p.size);
          const on = hover === p.key || selected === p.key;
          const dim = (hover || selected) && !on;
          return (
            <g
              key={p.key}
              className="bubble"
              style={{ animationDelay: `${i * 70}ms`, cursor: onSelect ? 'pointer' : undefined }}
              opacity={dim ? 0.35 : 1}
              onMouseEnter={() => setHover(p.key)}
              onMouseMove={(e) => show(e, p.tip)}
              onMouseLeave={() => (setHover(null), hide())}
              onClick={() => onSelect?.(p.key)}
            >
              <circle cx={sx(p.x)} cy={sy(p.y)} r={r + 6} fill={alpha(p.color, on ? 0.16 : 0.07)} />
              <circle
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={r}
                fill={`url(#bb-${p.key.replace(/[^a-zA-Z0-9]/g, '_')})`}
                stroke={alpha(p.color, 0.9)}
                strokeWidth={on ? 1.6 : 0.8}
                style={{ filter: `drop-shadow(0 0 ${on ? 16 : 8}px ${alpha(p.color, 0.6)})` }}
              />
              {sx(p.x) > width - 150 ? (
                <text x={sx(p.x) - r - 8} y={sy(p.y) + 4} textAnchor="end" className="bubble__label">
                  {p.label}
                </text>
              ) : (
                <text x={sx(p.x) + r + 8} y={sy(p.y) + 4} className="bubble__label">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
