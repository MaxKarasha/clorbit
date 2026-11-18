// Overview → "Subscription limits": the 5 h and 7 d used % over the selected range (step lines,
// one segment per window, reset markers) with the forecast extending to the next reset, or the
// how-to-connect explanation when there is no data.
import { useMemo, useState, type MouseEvent } from 'react';
import type { AboutInfo, LimitsForecast, LimitsPoint, LimitWindow, WindowForecast } from '@shared/api';
import { resetMarkers, splitWindows, windowSeries, type WindowPoint } from '@shared/forecast';
import { fiveHourWindow } from '@shared/plan';
import { t } from '../i18n';
import { useApi } from '../lib/api';
import { fmtDateTime, fmtDay, fmtTime, parseDay } from '../lib/format';
import { forecastView, SEV_COLOR } from '../lib/forecast';
import { openSettings } from '../lib/settings';
import type { ActiveRange } from '../lib/router';
import LimitsHowTo from '../components/LimitsHowTo';
import PlanBadge from '../components/PlanBadge';
import Recommendations from '../components/Recommendations';
import { Legend } from '../components/charts/small';
import { Panel, TipRow, Tooltip, useTip, useWidth } from '../components/ui';
import { rangeQs } from './common';

const COLOR: Record<LimitWindow, string> = { '5h': '#5cc8ff', '7d': '#a78bfa' };

export default function LimitsPanel({ range }: { range: ActiveRange }) {
  const hist = useApi<LimitsPoint[]>(`/api/limits/history?${rangeQs(range)}`);
  const fc = useApi<LimitsForecast>('/api/limits/forecast');
  // The plan badge in the header (servers older than 0.3 have no `plan`: no badge).
  const about = useApi<AboutInfo>('/api/about');
  const points = hist.data ?? [];
  const f = fc.data;
  const hasSource = f?.source === 'statusline';
  const loading = (hist.loading || fc.loading) && !hist.data && !f;
  // No 5-hour window (Ultra): from the status line when it reports, else from the plan table.
  const w5 = fiveHourWindow(f?.fiveHour.noWindow ? 'none' : hasSource && f?.fiveHour.pct != null ? 'present' : 'unknown', about.data?.plan);
  const no5h = w5.state === 'none';
  const legend = (
    <Legend
      items={[
        ...(no5h ? [] : [{ label: t('limits.w5h'), color: COLOR['5h'] }]),
        { label: t('limits.w7d'), color: COLOR['7d'] },
      ]}
    />
  );
  const no5hNote = no5h ? <p className="lim-note lim-note--inf"><span aria-hidden>∞</span> {t(w5.from === 'plan' ? 'limits.no5hPlan' : 'limits.no5h')}</p> : null;
  return (
    <Panel title={<span className="lim-title">{t('limits.title')}<PlanBadge plan={about.data?.plan} /></span>} hint={t('limits.hint')} actions={hasSource || points.length ? legend : undefined}>
      {loading ? (
        <div className="lim-empty" style={{ minHeight: 120 }} />
      ) : !hasSource && !points.length ? (
        <div className="lim-empty">
          <div className="lim-empty__title">{t('limits.emptyTitle')}</div>
          {no5hNote}
          <LimitsHowTo compact />
          <button type="button" className="btn btn--ghost btn--sm lim-empty__btn" onClick={(e) => openSettings(e.currentTarget, 'connection')}>
            {t('limits.openSettings')}
          </button>
        </div>
      ) : (
        <>
          {hasSource && f && <Summary f={f} no5h={no5h} />}
          {no5hNote}
          {points.length ? <LimitsChart points={points} forecast={hasSource ? f : null} range={range} no5h={no5h} /> : <p className="lim-note">{t('limits.noPoints')}</p>}
          {/* Pace, a window that runs out and its levers. Without a source the how-to is the explanation
              (the "not connected" card is on the Insights page). */}
          {hasSource && <Recommendations page="limits" />}
        </>
      )}
    </Panel>
  );
}

function Summary({ f, no5h }: { f: LimitsForecast; no5h: boolean }) {
  const row = (w: WindowForecast, label: string) => {
    const v = forecastView(w, label, f.now);
    return (
      <div className={`lim-sum lim-sum--${v.sev}`} title={v.title}>
        <span className="lim-sum__dot" style={{ background: COLOR[w.window] }} aria-hidden />
        <b>{label}</b>
        <span className="mono">{w.pct == null ? '—' : `${Math.round(w.pct)}%`}</span>
        {v.sub && <span className="lim-sum__line" style={v.sev !== 'none' ? { color: SEV_COLOR[v.sev] } : undefined}>{v.sub}</span>}
        {w.pctAtReset != null && !w.exhausted && !w.hitsAt && <span className="lim-sum__at">{t('limits.atReset', { pct: Math.round(w.pctAtReset) })}</span>}
      </div>
    );
  };
  return (
    <div className="lim-sums">
      {!no5h && row(f.fiveHour, t('gx.bar.5h'))}
      {row(f.sevenDay, t('gx.bar.7d'))}
    </div>
  );
}

/** The used % of one window at time t: the latest point at or before t within its window, else null (between windows). */
function valueAt(wins: WindowPoint[][], ts: number, now: number): number | null {
  for (let i = wins.length - 1; i >= 0; i--) {
    const w = wins[i];
    if (w[0].ts > ts) continue;
    if (ts > segEnd(w, wins[i + 1], now)) return null;
    let v = w[0].pct;
    for (const p of w) if (p.ts <= ts) v = p.pct; else break;
    return v;
  }
  return null;
}

/** Where a window's line ends: its reset, the next window's start or now, whichever is first. */
function segEnd(w: WindowPoint[], next: WindowPoint[] | undefined, now: number): number {
  const last = w[w.length - 1];
  let end = next ? next[0].ts : now;
  if (last.resetsAt != null && last.resetsAt > last.ts) end = Math.min(end, last.resetsAt);
  return Math.max(last.ts, end);
}

/** Round local times (whole hours or midnights) for the x axis, about five of them. */
function timeTicks(x0: number, x1: number): number[] {
  const H = 3_600_000;
  const steps = [H, 2 * H, 3 * H, 4 * H, 6 * H, 12 * H, 24 * H, 48 * H, 7 * 24 * H, 14 * 24 * H];
  const step = steps.find((s) => (x1 - x0) / s <= 6) ?? steps[steps.length - 1];
  const d = new Date(x0);
  if (step >= 24 * H) d.setHours(0, 0, 0, 0);
  else d.setMinutes(0, 0, 0);
  const out: number[] = [];
  for (let t = d.getTime(); t <= x1; ) {
    if (t >= x0) out.push(t);
    const n = new Date(t);
    if (step >= 24 * H) n.setDate(n.getDate() + step / (24 * H));
    else n.setHours(n.getHours() + step / H);
    t = n.getTime();
  }
  // Hours aligned to the step (00, 06, 12, 18 for 6 h).
  return step < 24 * H ? out.filter((t) => new Date(t).getHours() % (step / H) === 0) : out;
}

function LimitsChart({ points, forecast, range, no5h = false, height = 260 }: { points: LimitsPoint[]; forecast: LimitsForecast | null | undefined; range: ActiveRange; no5h?: boolean; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip();
  const [hx, setHx] = useState<number | null>(null);
  const now = forecast?.now ?? Date.now();
  const series = useMemo(() => {
    const out = {} as Record<LimitWindow, WindowPoint[][]>;
    for (const w of ['5h', '7d'] as const) out[w] = w === '5h' && no5h ? [] : splitWindows(windowSeries(points, w), w);
    return out;
  }, [points, no5h]);
  const resets7 = useMemo(() => resetMarkers(points, '7d'), [points]);
  const resets5 = useMemo(() => (no5h ? [] : resetMarkers(points, '5h')), [points, no5h]);

  const padL = 40, padR = 18, padT = 18, padB = 28;
  const from = parseDay(range.from).getTime();
  const toEnd = parseDay(range.to).getTime() + 86_400_000 - 1;
  const live = toEnd >= now;
  const f5 = no5h ? undefined : forecast?.fiveHour;
  const f7 = forecast?.sevenDay;
  // A range that includes now reaches to the 5 h reset, so the forecast is visible.
  const x0 = from;
  const x1 = live ? Math.max(Math.min(toEnd, now), f5?.resetsAt && f5.resetsAt > now ? f5.resetsAt : now) : toEnd;
  const innerW = Math.max(10, width - padL - padR);
  const innerH = height - padT - padB;
  const sx = (ts: number) => padL + ((Math.min(x1, Math.max(x0, ts)) - x0) / Math.max(1, x1 - x0)) * innerW;
  const sy = (v: number) => padT + innerH - (Math.min(100, Math.max(0, v)) / 100) * innerH;

  const paths = (w: LimitWindow) => {
    const wins = series[w];
    return wins.map((win, i) => {
      const end = segEnd(win, wins[i + 1], live ? now : x1);
      if (end < x0 || win[0].ts > x1) return null;
      let d = `M${sx(win[0].ts).toFixed(1)},${sy(win[0].pct).toFixed(1)}`;
      for (let k = 1; k < win.length; k++) d += `H${sx(win[k].ts).toFixed(1)}V${sy(win[k].pct).toFixed(1)}`;
      d += `H${sx(end).toFixed(1)}`;
      const area = `${d}V${sy(0).toFixed(1)}H${sx(win[0].ts).toFixed(1)}Z`;
      return { d, area, key: `${w}-${i}` };
    }).filter(Boolean) as { d: string; area: string; key: string }[];
  };

  /** The dashed forecast from the latest reading to the reset (clipped to the chart). */
  const forecastLine = (fw: WindowForecast | undefined, w: LimitWindow) => {
    if (!live || !fw || fw.basis === 'none' || fw.pct == null || !fw.resetsAt || fw.reset || fw.exhausted) return null;
    const last = series[w][series[w].length - 1];
    const a = Math.max(last ? last[last.length - 1].ts : now, Math.min(now, x1));
    // Straight to the projected % at the reset (or to 100% where it runs out, then flat).
    const target = fw.pctAtReset ?? fw.pct;
    const at = (ts: number) => fw.pct! + ((target - fw.pct!) * (ts - a)) / Math.max(1, fw.resetsAt! - a);
    const pts: [number, number][] = [[a, fw.pct]];
    const end = Math.min(fw.resetsAt, x1);
    if (fw.hitsAt && fw.hitsAt < end) pts.push([fw.hitsAt, 100]);
    pts.push([end, fw.hitsAt && fw.hitsAt < end ? 100 : at(end)]);
    return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('');
  };

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ts = x0 + ((x - padL) / innerW) * (x1 - x0);
    setHx(x);
    const future = live && ts > now;
    const v5 = future ? null : valueAt(series['5h'], ts, now);
    const v7 = future ? null : valueAt(series['7d'], ts, now);
    show(
      e,
      <>
        <div className="tip-title">{fmtDateTime(ts)}{future ? ` · ${t('limits.forecast')}` : ''}</div>
        {future ? (
          <>
            {f5?.pctAtReset != null && f5.resetsAt && <TipRow color={COLOR['5h']} label={t('limits.w5h')} value={`${Math.round(f5.pctAtReset)}% · ${t('limits.reset')} ${fmtTime(f5.resetsAt)}`} />}
            {f7?.pctAtReset != null && <TipRow color={COLOR['7d']} label={t('limits.w7d')} value={`${Math.round(f7.pctAtReset)}% · ${t('limits.reset')}`} />}
          </>
        ) : (
          <>
            {!no5h && <TipRow color={COLOR['5h']} label={t('limits.w5h')} value={v5 == null ? '—' : `${Math.round(v5)}%`} />}
            <TipRow color={COLOR['7d']} label={t('limits.w7d')} value={v7 == null ? '—' : `${Math.round(v7)}%`} />
          </>
        )}
      </>,
    );
  };

  // X labels: times for short spans, dates for longer ones.
  const span = x1 - x0;
  const ticks = timeTicks(x0, x1);
  const daily = ticks.length > 1 && ticks[1] - ticks[0] >= 86_400_000 - 2 * 3_600_000;
  const xLabel = (ts: number) => (daily ? fmtDay(ts) : `${span > 86_400_000 && new Date(ts).getHours() === 0 ? `${fmtDay(ts)} ` : ''}${fmtTime(ts)}`);
  const p5 = paths('5h');
  const p7 = paths('7d');
  const fl5 = forecastLine(f5, '5h');
  const fl7 = forecastLine(f7, '7d');
  const nowX = live ? sx(Math.min(now, x1)) : null;

  return (
    <div ref={ref} className="chart lim-chart" onMouseLeave={() => (hide(), setHx(null))}>
      <svg width={width} height={height} role="img" aria-label={t('limits.aria')}>
        <defs>
          <linearGradient id="lim-5h" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR['5h']} stopOpacity="0.28" />
            <stop offset="100%" stopColor={COLOR['5h']} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={padL} x2={width - padR} y1={sy(v)} y2={sy(v)} className="grid-line" style={v === 100 ? { stroke: 'rgba(255,107,139,.45)', strokeDasharray: '4 5' } : undefined} />
            <text x={padL - 8} y={sy(v) + 4} textAnchor="end" className="axis-label">{v}%</text>
          </g>
        ))}
        {resets5.filter((ts) => ts >= x0 && ts <= x1).map((ts) => (
          <line key={`r5-${ts}`} x1={sx(ts)} x2={sx(ts)} y1={sy(0)} y2={sy(0) - 6} stroke={COLOR['5h']} strokeOpacity="0.55" />
        ))}
        {resets7.filter((ts) => ts >= x0 && ts <= x1).map((ts) => (
          <g key={`r7-${ts}`}>
            <line x1={sx(ts)} x2={sx(ts)} y1={padT} y2={sy(0)} stroke={COLOR['7d']} strokeOpacity="0.5" strokeDasharray="2 4" />
            <text x={sx(ts) + 4} y={padT + 10} className="axis-label" fill={COLOR['7d']}>{t('limits.reset')} · {t('gx.bar.7d')}</text>
          </g>
        ))}
        {live && f5?.resetsAt && f5.resetsAt <= x1 && f5.resetsAt > now && (
          <g>
            <line x1={sx(f5.resetsAt)} x2={sx(f5.resetsAt)} y1={padT} y2={sy(0)} stroke={COLOR['5h']} strokeOpacity="0.5" strokeDasharray="2 4" />
            <text x={sx(f5.resetsAt) - 5} y={sy(0) - 8} textAnchor="end" className="axis-label" fill={COLOR['5h']}>{t('limits.reset')} · {t('gx.bar.5h')} · {fmtTime(f5.resetsAt)}</text>
          </g>
        )}
        {nowX != null && <line x1={nowX} x2={nowX} y1={padT} y2={sy(0)} stroke="rgba(230,235,245,.18)" />}
        {p5.map((p) => <path key={`a${p.key}`} d={p.area} fill="url(#lim-5h)" />)}
        {p7.map((p) => <path key={p.key} d={p.d} fill="none" stroke={COLOR['7d']} strokeWidth="1.6" style={{ filter: 'drop-shadow(0 0 5px rgba(167,139,250,.5))' }} />)}
        {p5.map((p) => <path key={p.key} d={p.d} fill="none" stroke={COLOR['5h']} strokeWidth="1.6" style={{ filter: 'drop-shadow(0 0 5px rgba(92,200,255,.55))' }} />)}
        {fl7 && <path d={fl7} fill="none" stroke={COLOR['7d']} strokeWidth="1.6" strokeDasharray="5 5" strokeOpacity="0.85" />}
        {fl5 && <path d={fl5} fill="none" stroke={f5?.hitsAt ? SEV_COLOR.warn : COLOR['5h']} strokeWidth="1.8" strokeDasharray="5 5" />}
        {live && f5?.hitsAt && f5.hitsAt <= x1 && <circle cx={sx(f5.hitsAt)} cy={sy(100)} r="4" fill={SEV_COLOR.warn} stroke="#fff" strokeWidth="1.2" />}
        {hx != null && hx >= padL && hx <= width - padR && <line x1={hx} x2={hx} y1={padT} y2={sy(0)} stroke="rgba(230,235,245,.3)" />}
        {ticks.map((ts) => (
          <text key={ts} x={sx(ts)} y={height - 8} textAnchor={sx(ts) < padL + 30 ? 'start' : sx(ts) > width - padR - 30 ? 'end' : 'middle'} className="axis-label">{xLabel(ts)}</text>
        ))}
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent" onMouseMove={onMove} />
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
