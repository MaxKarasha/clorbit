import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

// ---------- Layout ----------

export function PageHeader({ eyebrow, title, lede, right }: { eyebrow: ReactNode; title: ReactNode; lede?: ReactNode; right?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head__text">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
      </div>
      {right && <div className="page-head__right">{right}</div>}
    </header>
  );
}

export function Panel({
  title,
  hint,
  actions,
  children,
  className,
  style,
  flush,
}: {
  title?: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  flush?: boolean;
}) {
  return (
    <section className={cx('panel glass', flush && 'panel--flush', className)} style={style}>
      {(title || actions) && (
        <div className="panel__head">
          <div>
            {title && <h2 className="panel__title">{title}</h2>}
            {hint && <div className="panel__hint">{hint}</div>}
          </div>
          {actions && <div className="panel__actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------- States ----------

export function Loading({ label, rows = 6 }: { label?: string; rows?: number }) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <div className="orbit-loader" aria-hidden>
        <span />
      </div>
      <div className="state__label">{label ?? t('ui.loading')}</div>
      <div className="skeleton-rows" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton" style={{ width: `${88 - ((i * 17) % 50)}%`, animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <div className="state__title">{t('ui.errorTitle')}</div>
      <div className="state__label mono">{message}</div>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          {t('ui.retry')}
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state state--empty">
      <div className="empty-orb" aria-hidden />
      <div className="state__title">{title}</div>
      {children && <div className="state__label">{children}</div>}
    </div>
  );
}

// ---------- Comet: the signature ranking bar ----------

/** Thin "comet" with a bright head. value/max sets the length; marker is an extra tick (e.g. the maximum). */
export function CometBar({
  value,
  max,
  color = 'var(--b1)',
  delay = 0,
  marker,
  height = 6,
}: {
  value: number;
  max: number;
  color?: string;
  delay?: number;
  marker?: { value: number; color?: string; title?: string };
  height?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const mpct = marker && max > 0 ? Math.max(0, Math.min(1, marker.value / max)) : null;
  return (
    <div className="comet" style={{ '--c': color, '--h': `${height}px`, '--d': `${delay}ms` } as CSSProperties}>
      <div className="comet__track" />
      <div className="comet__reveal">
        <div className="comet__fill" style={{ width: `${Math.max(pct * 100, value > 0 ? 1.2 : 0)}%` }}>
          {value > 0 && <span className="comet__head" />}
        </div>
      </div>
      {mpct != null && (
        <span className="comet__marker" title={marker!.title} style={{ left: `${mpct * 100}%`, background: marker!.color ?? 'var(--text)' }} />
      )}
    </div>
  );
}

// ---------- Tooltip ----------

export interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

export function useTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  return {
    tip,
    show: (e: { clientX: number; clientY: number }, content: ReactNode) => setTip({ x: e.clientX, y: e.clientY, content }),
    hide: () => setTip(null),
  };
}

export function Tooltip({ tip }: { tip: TipState | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    let left = tip.x + 16;
    let top = tip.y + 14;
    if (left + r.width > window.innerWidth - 12) left = tip.x - r.width - 16;
    if (top + r.height > window.innerHeight - 12) top = tip.y - r.height - 14;
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [tip]);
  if (!tip) return null;
  return createPortal(
    <div ref={ref} className="tooltip glass" style={{ left: pos?.left ?? tip.x + 16, top: pos?.top ?? tip.y + 14, opacity: pos ? 1 : 0 }}>
      {tip.content}
    </div>,
    document.body,
  );
}

export function TipRow({ color, label, value }: { color?: string; label: ReactNode; value: ReactNode }) {
  return (
    <div className="tip-row">
      {color && <span className="dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />}
      <span className="tip-row__label">{label}</span>
      <span className="tip-row__value mono">{value}</span>
    </div>
  );
}

// ---------- Container size ----------

export function useWidth<T extends HTMLElement>(initial = 600): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// ---------- Copy ----------

export function CopyBlock({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
  };
  return (
    <div className="copyblock">
      <div className="copyblock__bar">
        <span className="eyebrow">{label ?? t('ui.whatToDo')}</span>
        <button className={cx('btn btn--ghost btn--sm', copied && 'is-done')} onClick={copy} aria-live="polite">
          {copied ? t('ui.copied') : t('ui.copy')}
        </button>
      </div>
      <pre className="copyblock__code mono">{text}</pre>
    </div>
  );
}

// ---------- Small bits ----------

export function Dot({ color, glow = true }: { color: string; glow?: boolean }) {
  return <span className="dot" style={{ background: color, boxShadow: glow ? `0 0 10px ${color}` : undefined }} />;
}

export function Chip({ children, tone }: { children: ReactNode; tone?: 'warn' | 'danger' | 'ok' | 'muted' }) {
  return <span className={cx('chip', tone && `chip--${tone}`)}>{children}</span>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={cx('segmented__btn', value === o.id && 'is-active')} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
