// The time machine's timeline: play/pause, speed, original time and elapsed, a track with activity density,
// markers (spawns, waits, compactions, prompts) and compressed idle gaps; drag to seek.
import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { densityBins, type MarkerKind, type ReplayMarker, type TimeMap } from '@shared/replay';
import { getLang, locale, t, type MsgKey } from '../i18n';
import { fmtClock } from './format';
import { SPEEDS, type PlayerView, type ReplayPlayer, type Speed } from './replay-player';

const BINS = 220;
const MARKER_KINDS: MarkerKind[] = ['spawn', 'wait', 'compact', 'prompt'];

/** 12:05 or 1:02:05. */
export function fmtSpan(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
}

function fmtWhen(ts: number, showDate: boolean): string {
  const clock = fmtClock(ts);
  if (!showDate) return clock;
  return `${new Date(ts).toLocaleDateString(locale(getLang()), { day: 'numeric', month: 'short' })} ${clock}`;
}

const speedLabel = (s: Speed, rate: number) => (s === 'auto' ? t('gx.replay.auto', { rate }) : `${s}×`);

export default function Scrubber({ player, view, follow, onFollow }: { player: ReplayPlayer; view: PlayerView; follow: boolean | null; onFollow: (v: boolean) => void }) {
  const r = player.replay;
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; f: number; marker: ReplayMarker | null } | null>(null);
  const dragging = useRef(false);
  // The playhead moves every frame without React.
  useEffect(() => {
    player.onFrame = (f) => {
      const pct = `${(f * 100).toFixed(3)}%`;
      if (headRef.current) headRef.current.style.left = pct;
      if (fillRef.current) fillRef.current.style.width = pct;
    };
    return () => { player.onFrame = null; };
  }, [player]);

  const map = player.map;
  // Recomputed when the replay or the axis (auto ↔ linear) changes.
  const density = useMemo(() => densityBins(r.events, map, BINS), [r, map]);
  const markers = player.markers;
  const pos = (ts: number) => (map.duration > 0 ? (map.toPlay(ts) / map.duration) * 100 : 0);
  const showDate = new Date(r.startedAt).toDateString() !== new Date(r.endedAt).toDateString() || new Date(r.startedAt).toDateString() !== new Date().toDateString();

  const fracAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
  };
  const nearMarker = (f: number): ReplayMarker | null => {
    const w = trackRef.current?.getBoundingClientRect().width ?? 1;
    let best: ReplayMarker | null = null;
    let bd = 6 / w;
    for (const m of markers) {
      const d = Math.abs(pos(m.ts) / 100 - f);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const f = fracAt(e.clientX);
    const m = nearMarker(f);
    player.seek(m ? m.ts : player.timeAt(f));
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const f = fracAt(e.clientX);
    const rect = trackRef.current!.getBoundingClientRect();
    setHover({ x: e.clientX - rect.left, f, marker: dragging.current ? null : nearMarker(f) });
    if (dragging.current) player.seek(player.timeAt(f));
  };
  const onUp = () => { dragging.current = false; };
  const onKey = (e: React.KeyboardEvent) => {
    // The track is a slider: arrows step through events, Home/End jump to the ends (the page handles space).
    if (e.key === 'Home') { e.preventDefault(); player.seek(r.startedAt); }
    else if (e.key === 'End') { e.preventDefault(); player.seek(r.endedAt); }
  };

  const total = r.endedAt - r.startedAt;
  const elapsed = view.t - r.startedAt;
  const hoverT = hover ? player.timeAt(hover.f) : null;
  const counts = useMemo(() => {
    const c: Record<MarkerKind, number> = { spawn: 0, wait: 0, compact: 0, prompt: 0 };
    for (const m of markers) c[m.kind]++;
    return c;
  }, [markers]);

  return (
    <section className="rp-bar" aria-label={t('gx.replay.title')}>
      <div className="rp-controls">
        <button type="button" className={`rp-play${view.playing ? ' is-playing' : ''}`} onClick={() => player.toggle()} title={view.playing ? t('gx.replay.pause') : t('gx.replay.play')} aria-label={view.playing ? t('gx.replay.pause') : t('gx.replay.play')}>
          {view.playing ? (
            <svg viewBox="0 0 24 24" aria-hidden><path d="M8 5v14M16 5v14" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden><path d="M7 5l12 7-12 7z" /></svg>
          )}
        </button>
        <div className="rp-time">
          <strong className="mono">{fmtWhen(view.t, showDate)}</strong>
          <span className="mono">{t('gx.replay.elapsed', { elapsed: fmtSpan(elapsed), total: fmtSpan(total) })}</span>
        </div>
        <div className="rp-speed" role="radiogroup" aria-label={t('gx.replay.speed')}>
          {SPEEDS.map((s) => (
            <button
              key={String(s)}
              type="button"
              role="radio"
              aria-checked={view.speed === s}
              className={view.speed === s ? 'on' : ''}
              onClick={() => player.setSpeed(s)}
              title={s === 'auto' ? t('gx.replay.autoTitle', { rate: player.speed === 'auto' ? view.rate : autoPreview(player) }) : t('gx.replay.speedTitle', { n: s })}
            >
              {s === 'auto' ? speedLabel(s, view.speed === 'auto' ? view.rate : autoPreview(player)) : speedLabel(s, 0)}
            </button>
          ))}
        </div>
        {follow !== null && (
          <label className={`rp-follow${follow ? ' on' : ''}`} title={t('gx.replay.followTitle')}>
            <input type="checkbox" checked={follow} onChange={(e) => onFollow(e.target.checked)} />
            <i aria-hidden />
            {t('gx.replay.follow')}
          </label>
        )}
        <ul className="rp-legend" aria-label={t('gx.replay.markers')}>
          {MARKER_KINDS.filter((k) => counts[k]).map((k) => (
            <li key={k} className={`rp-k rp-k--${k}`}><i aria-hidden />{t(`gx.replay.m.${k}` as MsgKey)} <em>{counts[k]}</em></li>
          ))}
        </ul>
        <span className="rp-keys">{t('gx.replay.keys')}</span>
      </div>
      <div
        ref={trackRef}
        className="rp-track"
        role="slider"
        tabIndex={0}
        aria-label={t('gx.replay.track')}
        aria-valuemin={0}
        aria-valuemax={Math.round(total / 1000)}
        aria-valuenow={Math.round(elapsed / 1000)}
        aria-valuetext={fmtWhen(view.t, showDate)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
      >
        <TrackArt density={density} markers={markers} map={map} />
        <div className="rp-fill" ref={fillRef} style={{ width: `${view.t >= r.startedAt ? player.frac(view.t) * 100 : 0}%` }} />
        {map.gaps.map((g) => (
          <span key={g.from} className="rp-gap" style={{ left: `${pos(g.from)}%`, width: `${Math.max(0.15, pos(g.to) - pos(g.from))}%` }} title={t('gx.replay.gap', { d: fmtSpan(g.to - g.from) })} />
        ))}
        <div className="rp-head" ref={headRef} style={{ left: `${player.frac(view.t) * 100}%` }} />
        {hover && hoverT !== null && (
          <div className="rp-tip" style={{ left: Math.min(Math.max(hover.x, 80), (trackRef.current?.clientWidth ?? 0) - 80) }}>
            <b className="mono">{fmtWhen(hover.marker ? hover.marker.ts : hoverT, showDate)}</b>
            {hover.marker && (
              <span className={`rp-tip__m rp-k--${hover.marker.kind}`}>
                <i aria-hidden />
                {t(`gx.replay.m.${hover.marker.kind}` as MsgKey)}{hover.marker.label ? `: ${short(hover.marker.label, 60)}` : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const MARK_COLOR: Record<MarkerKind, string> = { spawn: 'rgba(181, 140, 255, 0.75)', wait: '#ffb15c', compact: '#7fd6ff', prompt: '#f2f5fb' };

/**
 * Density bars and markers, drawn on a canvas: a long session has thousands of markers, too many for DOM nodes
 * that would be diffed on every update. Redrawn only when the data, the axis or the size changes.
 */
const TrackArt = memo(function TrackArt({ density, markers, map }: { density: number[]; markers: readonly ReplayMarker[]; map: TimeMap }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const c = ref.current;
    if (!c || !size.w || !size.h) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);
    const bw = size.w / density.length;
    const top = 4, hh = size.h - 8;
    g.fillStyle = 'rgba(127, 214, 255, 0.34)';
    density.forEach((v, i) => {
      if (v <= 0) return;
      const h = Math.max(0.06, v) * hh;
      g.fillRect(i * bw + bw * 0.12, top + hh - h, Math.max(0.6, bw * 0.76), h);
    });
    const d = Math.max(1, map.duration);
    // Spawns first (the many, short and soft), then the rare ones on top.
    for (const kind of ['spawn', 'prompt', 'compact', 'wait'] as MarkerKind[]) {
      g.strokeStyle = MARK_COLOR[kind];
      g.lineWidth = kind === 'spawn' ? 1.2 : 2;
      g.setLineDash(kind === 'compact' ? [3, 2] : []);
      g.beginPath();
      for (const m of markers) {
        if (m.kind !== kind) continue;
        const x = Math.round((map.toPlay(m.ts) / d) * size.w) + 0.5;
        g.moveTo(x, kind === 'spawn' ? size.h * 0.45 : 0);
        g.lineTo(x, size.h);
      }
      g.stroke();
    }
  }, [density, markers, map, size]);
  return <canvas ref={ref} className="rp-art" aria-hidden />;
});

function short(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/** The rate "auto" would use, shown while another speed is on. */
function autoPreview(p: ReplayPlayer): number {
  return p.autoRateValue();
}
