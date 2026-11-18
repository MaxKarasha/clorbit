// "Export video": the replay rendered into an MP4 / WebM / GIF on this computer. Settings (format, aspect,
// range, length, overlays, privacy), a progress bar with cancel, then a preview, download and (GIF) copy.
import { useEffect, useMemo, useRef, useState } from 'react';
import { getLang, t, type MsgKey } from '../../i18n';
import { fmtClock, fmtDur } from '../format';
import type { PlayerView, ReplayPlayer } from '../replay-player';
import { fmtSpan } from '../Scrubber';
import { canCopyGif, detectCodec, estimateBytes } from './encode';
import { fpsFor, presetsFor, VIDEO_PRESETS, type Aspect, type ExportFormat } from './layout';
import { ALL_OVERLAYS, planExport, REAL_MAX_MS, type ExportSettings, type OverlayToggles, type TargetDuration } from './plan';
import { ExportCancelled, runExport, type ExportProgress, type ExportResult } from './run';
import './export.css';

export interface Selection { from: number; to: number }

type Support = Record<'mp4' | 'webm', Record<string, boolean>>;
type Job =
  | { k: 'idle' }
  | { k: 'running'; p: ExportProgress | null; started: number }
  | { k: 'done'; res: ExportResult; url: string }
  | { k: 'error'; msg: string }
  | { k: 'cancelled' };

const TARGETS: TargetDuration[] = [15, 30, 60, 'real'];
const OVERLAY_KEYS: (keyof OverlayToggles)[] = ['title', 'end', 'clock', 'counters', 'captions'];

export function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return t('gx.export.kb', { n: Math.max(1, Math.round(n / 1024)) });
  const mb = n / (1024 * 1024);
  const v = mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1);
  return t('gx.export.mb', { n: getLang() === 'uk' ? v.replace('.', ',') : v });
}

const aspectOf = (id: string): Aspect => (id.startsWith('16:9') ? '16:9' : (id as Aspect));

export default function ExportDialog({ player, view, demo, sel, onSel, onBusy, onClose }: {
  player: ReplayPlayer;
  view: PlayerView;
  demo: boolean;
  sel: Selection | null;
  onSel(s: Selection | null): void;
  /** An export started / ended: the page can stop drawing the live scene meanwhile (it competes for the GPU). */
  onBusy?(busy: boolean): void;
  onClose(): void;
}) {
  const r = player.replay;
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [videoSize, setVideoSize] = useState('16:9-1080');
  const [gifSize, setGifSize] = useState('16:9');
  const [useSel, setUseSel] = useState(!!sel);
  const [target, setTarget] = useState<TargetDuration>(30);
  const [overlays, setOverlays] = useState<OverlayToggles>(ALL_OVERLAYS);
  const [anonymize, setAnonymize] = useState(!demo);
  const [support, setSupport] = useState<Support | null>(null);
  const [job, setJob] = useState<Job>({ k: 'idle' });
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Which encoders this browser has, per size (H.264 at 1080×1920 may be missing where 1080p works).
  useEffect(() => {
    let live = true;
    (async () => {
      const out: Support = { mp4: {}, webm: {} };
      for (const f of ['mp4', 'webm'] as const) for (const p of VIDEO_PRESETS) out[f][p.id] = !!(await detectCodec(f, p.width, p.height, fpsFor(f)));
      if (!live) return;
      setSupport(out);
      const any = (f: 'mp4' | 'webm') => Object.values(out[f]).some(Boolean);
      setFormat((cur) => (cur === 'mp4' && !any('mp4') ? (any('webm') ? 'webm' : 'gif') : cur));
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => { if (sel) setUseSel(true); }, [sel]);
  useEffect(() => { boxRef.current?.focus(); }, []);
  // The preview's object URL lives as long as the result.
  useEffect(() => () => { if (job.k === 'done') URL.revokeObjectURL(job.url); }, [job]);
  useEffect(() => () => { abortRef.current?.abort(); delete document.documentElement.dataset.xpBusy; }, []);

  const running = job.k === 'running';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !running) { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, onClose]);

  const has = (f: ExportFormat) => f === 'gif' || !support || Object.values(support[f]).some(Boolean);
  const sizeOk = (f: ExportFormat, id: string) => f === 'gif' || !support || !!support[f][id];
  const size = format === 'gif' ? gifSize : videoSize;
  const range = useSel && sel ? sel : null;
  const settings: ExportSettings = { format, size, range, target, overlays, anonymize: demo ? false : anonymize };
  // The plan for the summary line (captions do not change its length).
  const plan = useMemo(
    () => planExport(r, { ...settings, overlays: { ...overlays, captions: false } }),
    [r, format, size, range?.from, range?.to, target, overlays.title, overlays.end],
  );
  const lenMs = plan.schedule.titleMs + plan.schedule.contentMs + plan.schedule.tailMs;
  const bytes = estimateBytes(format, plan.width, plan.height, plan.fps, lenMs);
  const fitted = target !== 'real' && plan.schedule.contentMs < target * 1000 - plan.schedule.titleMs - plan.schedule.tailMs - 1;
  const empty = r.events.length === 0;

  const pickFormat = (f: ExportFormat) => {
    setFormat(f);
    if (f !== 'gif' && !sizeOk(f, videoSize)) {
      const ok = VIDEO_PRESETS.find((p) => sizeOk(f, p.id));
      if (ok) setVideoSize(ok.id);
    }
  };
  const pickAspect = (id: string) => {
    if (format === 'gif') { setGifSize(id); setVideoSize(VIDEO_PRESETS.find((p) => p.aspect === aspectOf(id))!.id); }
    else { setVideoSize(id); setGifSize(aspectOf(id)); }
  };

  const start = async () => {
    const ac = new AbortController();
    abortRef.current = ac;
    player.pause();
    onBusy?.(true);
    document.documentElement.dataset.xpBusy = '1';
    setCopied(null);
    setJob({ k: 'running', p: null, started: performance.now() });
    try {
      // The progress view (with its live preview canvas) mounts with the 'running' state.
      await new Promise((res) => requestAnimationFrame(res));
      const res = await runExport(r, settings, {
        signal: ac.signal,
        preview: previewRef.current,
        onProgress: (p) => setJob((j) => (j.k === 'running' ? { ...j, p } : j)),
      });
      if (import.meta.env.DEV) (window as unknown as { __exportLast?: ExportResult }).__exportLast = res;
      setJob({ k: 'done', res, url: URL.createObjectURL(res.blob) });
    } catch (e) {
      if (e instanceof ExportCancelled || ac.signal.aborted) setJob({ k: 'cancelled' });
      else setJob({ k: 'error', msg: e instanceof Error ? e.message : String(e) });
    } finally {
      abortRef.current = null;
      onBusy?.(false);
      delete document.documentElement.dataset.xpBusy;
    }
  };

  const copy = async (blob: Blob) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopied('ok');
    } catch { setCopied('fail'); }
  };

  const setFrom = () => onSel({ from: player.t, to: sel && sel.to > player.t ? sel.to : r.endedAt });
  const setTo = () => onSel({ from: sel && sel.from < player.t ? sel.from : r.startedAt, to: player.t });
  const when = (ts: number) => fmtClock(ts);

  return (
    <div className="xp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !running) onClose(); }}>
      <div className="xp" role="dialog" aria-modal="true" aria-labelledby="xp-title" tabIndex={-1} ref={boxRef}>
        <header className="xp-head">
          <div>
            <h2 id="xp-title">{t('gx.export.title')}</h2>
            <p>{t('gx.export.lede')}</p>
          </div>
          <button type="button" className="xp-x" onClick={onClose} disabled={running} aria-label={t('gx.export.close')} title={t('gx.export.close')}>×</button>
        </header>

        {job.k === 'done' ? (
          <Result res={job.res} url={job.url} copied={copied} onCopy={() => copy(job.res.blob)} onBack={() => setJob({ k: 'idle' })} />
        ) : (
          <>
            <div className={`xp-body${running ? ' is-busy' : ''}`} aria-busy={running}>
              <Row label={t('gx.export.format')}>
                <div className="xp-seg" role="radiogroup" aria-label={t('gx.export.format')}>
                  {(['mp4', 'webm', 'gif'] as ExportFormat[]).filter(has).map((f) => (
                    <button key={f} type="button" role="radio" aria-checked={format === f} className={format === f ? 'on' : ''} disabled={running} onClick={() => pickFormat(f)}>
                      <b>{t(`gx.export.fmt.${f}` as MsgKey)}</b><small>{t(`gx.export.fmt.${f}Hint` as MsgKey)}</small>
                    </button>
                  ))}
                </div>
                {!support && <p className="xp-note">{t('gx.export.checking')}</p>}
                {support && !has('mp4') && <p className="xp-note">{has('webm') ? t('gx.export.noMp4') : t('gx.export.noVideo')}</p>}
              </Row>

              <Row label={t('gx.export.size')}>
                <div className="xp-seg xp-seg--wrap" role="radiogroup" aria-label={t('gx.export.size')}>
                  {presetsFor(format).map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={size === p.id} className={size === p.id ? 'on' : ''} disabled={running || !sizeOk(format, p.id)} onClick={() => pickAspect(p.id)}>
                      <i className={`xp-ar xp-ar--${p.aspect.replace(':', '-')}`} aria-hidden />
                      <b>{t(`gx.export.sz.${format === 'gif' ? p.aspect : p.id}` as MsgKey)}</b>
                      <small>{p.width}×{p.height} · {t(`gx.export.szHint.${p.aspect}` as MsgKey)}</small>
                    </button>
                  ))}
                </div>
              </Row>

              <Row label={t('gx.export.range')}>
                <div className="xp-seg" role="radiogroup" aria-label={t('gx.export.range')}>
                  <button type="button" role="radio" aria-checked={!range} className={!range ? 'on' : ''} disabled={running} onClick={() => setUseSel(false)}>
                    <b>{t('gx.export.range.all')}</b><small>{fmtSpan(r.endedAt - r.startedAt)}</small>
                  </button>
                  <button type="button" role="radio" aria-checked={!!range} className={range ? 'on' : ''} disabled={running || !sel} onClick={() => setUseSel(true)}>
                    <b>{t('gx.export.range.sel')}</b>
                    <small>{sel ? t('gx.export.range.span', { from: when(sel.from), to: when(sel.to), d: fmtSpan(sel.to - sel.from) }) : '—'}</small>
                  </button>
                </div>
                <div className="xp-actions-row">
                  <button type="button" className="xp-chip" disabled={running} onClick={setFrom}>⇤ {t('gx.export.range.from')}</button>
                  <button type="button" className="xp-chip" disabled={running} onClick={setTo}>{t('gx.export.range.to')} ⇥</button>
                  {sel && <button type="button" className="xp-chip xp-chip--ghost" disabled={running} onClick={() => { onSel(null); setUseSel(false); }}>{t('gx.export.range.clear')}</button>}
                </div>
                <p className="xp-note">{t('gx.export.range.hint')}</p>
              </Row>

              <Row label={t('gx.export.duration')}>
                <div className="xp-seg" role="radiogroup" aria-label={t('gx.export.duration')}>
                  {TARGETS.map((d) => (
                    <button key={String(d)} type="button" role="radio" aria-checked={target === d} className={target === d ? 'on' : ''} disabled={running} onClick={() => setTarget(d)}
                      title={d === 'real' ? t('gx.export.dur.realHint', { max: fmtDur(REAL_MAX_MS[format]) }) : undefined}>
                      <b>{d === 'real' ? t('gx.export.dur.real') : t('gx.export.dur.s', { n: d })}</b>
                    </button>
                  ))}
                </div>
                <p className="xp-note">{target === 'real' ? t('gx.export.dur.realHint', { max: fmtDur(REAL_MAX_MS[format]) }) : fitted ? t('gx.export.dur.short') : t('gx.export.dur.fitHint')}</p>
              </Row>

              <Row label={t('gx.export.overlays')}>
                <div className="xp-checks">
                  {OVERLAY_KEYS.map((k) => (
                    <label key={k} className={`xp-check${overlays[k] ? ' on' : ''}`}>
                      <input type="checkbox" checked={overlays[k]} disabled={running} onChange={(e) => setOverlays((o) => ({ ...o, [k]: e.target.checked }))} />
                      <i aria-hidden />{t(`gx.export.ovOpt.${k}` as MsgKey)}
                    </label>
                  ))}
                </div>
              </Row>

              <Row label={t('gx.export.privacy')}>
                {demo ? (
                  <p className="xp-note">{t('gx.export.demoNote')}</p>
                ) : (
                  <>
                    <label className={`xp-check xp-check--big${anonymize ? ' on' : ''}`}>
                      <input type="checkbox" checked={anonymize} disabled={running} onChange={(e) => setAnonymize(e.target.checked)} />
                      <i aria-hidden />{t('gx.export.anon')}
                    </label>
                    <p className={`xp-note${anonymize ? '' : ' xp-note--warn'}`}>{anonymize ? t('gx.export.anonOn') : t('gx.export.anonOffNote')}</p>
                  </>
                )}
              </Row>
            </div>

            <footer className="xp-foot">
              {running ? (
                <Progress job={job} onCancel={() => abortRef.current?.abort()} preview={previewRef} w={plan.width} h={plan.height} />
              ) : (
                <>
                  <div className="xp-sum mono">
                    {empty ? t('gx.export.empty') : t('gx.export.summary', { w: plan.width, h: plan.height, fps: plan.fps, len: fmtSpan(lenMs), size: fmtBytes(bytes) })}
                    {job.k === 'cancelled' && <span className="xp-msg">{t('gx.export.cancelled')}</span>}
                    {job.k === 'error' && <span className="xp-msg xp-msg--err">{t('gx.export.failed', { msg: job.msg })}</span>}
                  </div>
                  <button type="button" className="gx-btn primary xp-go" disabled={empty || !has(format) || !sizeOk(format, size)} onClick={start}>{t('gx.export.start')}</button>
                </>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="xp-row">
      <h3>{label}</h3>
      <div>{children}</div>
    </section>
  );
}

function Progress({ job, onCancel, preview, w, h }: {
  job: Extract<Job, { k: 'running' }>;
  onCancel(): void;
  preview: React.RefObject<HTMLCanvasElement | null>;
  w: number;
  h: number;
}) {
  const p = job.p;
  const f = p ? p.frame / p.total : 0;
  const el = performance.now() - job.started;
  const left = p && p.frame > 8 ? (el / p.frame) * (p.total - p.frame) : null;
  // The live preview: a thumbnail of the frame being rendered (also what keeps encoding going, see runExport).
  const k = Math.min(1, 180 / h, 240 / w);
  return (
    <div className="xp-prog">
      <canvas className="xp-live" ref={preview} width={Math.round(w * k)} height={Math.round(h * k)} aria-hidden />
      <p className="xp-note xp-prog__note">{t('gx.export.keepOpen')}</p>
      <div className="xp-prog__top">
        <span className="mono">{p ? t('gx.export.rendering', { n: p.frame, total: p.total }) : t('gx.export.preparing')}</span>
        <span className="mono xp-prog__left">{left !== null ? t('gx.export.left', { t: fmtSpan(left) }) : ''}{p && p.bytes ? ` · ${fmtBytes(p.bytes)}` : ''}</span>
      </div>
      <div className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f * 100)}><i style={{ width: `${(f * 100).toFixed(1)}%` }} /></div>
      <button type="button" className="gx-btn xp-cancel" onClick={onCancel}>{t('gx.export.cancel')}</button>
    </div>
  );
}

function Result({ res, url, copied, onCopy, onBack }: { res: ExportResult; url: string; copied: 'ok' | 'fail' | null; onCopy(): void; onBack(): void }) {
  const gif = res.blob.type === 'image/gif';
  const tall = res.height > res.width;
  return (
    <div className="xp-result">
      <div className={`xp-preview${tall ? ' xp-preview--tall' : ''}`}>
        {gif ? <img src={url} alt="" /> : <video src={url} controls autoPlay muted loop playsInline />}
      </div>
      <div className="xp-result__meta">
        <b className="mono">{res.fileName}</b>
        <span className="mono">{res.width}×{res.height} · {res.fps} fps · {fmtSpan(res.durationMs)} · {t('gx.export.done', { size: fmtBytes(res.blob.size), took: fmtSpan(res.tookMs) })}</span>
      </div>
      <div className="xp-foot xp-foot--result">
        <button type="button" className="gx-btn" onClick={onBack}>{t('gx.export.again')}</button>
        <span className="xp-grow" />
        {gif && canCopyGif() && (
          <button type="button" className="gx-btn" onClick={onCopy}>{copied === 'ok' ? t('gx.export.copied') : copied === 'fail' ? t('gx.export.copyFailed') : t('gx.export.copy')}</button>
        )}
        <a className="gx-btn primary" href={url} download={res.fileName}>{t('gx.export.download')}</a>
      </div>
    </div>
  );
}
