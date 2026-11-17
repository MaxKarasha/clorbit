import { useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { t } from '../i18n';
import { CometBar, cx } from './ui';

export interface RankItem {
  key: string;
  label: ReactNode;
  sub?: ReactNode; // second line under the name (group, path)
  badge?: ReactNode;
  value: number;
  valueText: ReactNode;
  color: string;
  cols: ReactNode[];
  marker?: { value: number; color?: string; title?: string };
  href?: string;
  onClick?: () => void;
  children?: RankItem[];
  childrenEmpty?: ReactNode;
  tone?: 'warn' | 'danger' | 'muted';
}

/**
 * Comet ranking: position, name with a thin comet, main number, extra columns.
 * Rows with children expand; rows with href link deeper.
 */
export default function RankList({
  items,
  valueHeader,
  columns,
  colWidth = 88,
  max,
  dense,
  limit,
  showIndex = true,
}: {
  items: RankItem[];
  valueHeader: ReactNode;
  columns: ReactNode[];
  colWidth?: number | number[];
  max?: number;
  dense?: boolean;
  limit?: number;
  showIndex?: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  const m = max ?? Math.max(...items.map((i) => i.value), 1);
  const widths = columns.map((_, i) => (Array.isArray(colWidth) ? (colWidth[i] ?? 88) : colWidth));
  const grid = `${showIndex ? '30px ' : ''}minmax(110px, 1fr) minmax(76px, 104px) ${widths.map((w) => `minmax(${Math.min(w, 48)}px, ${w}px)`).join(' ')} 26px`;
  const shown = limit && !all ? items.slice(0, limit) : items;

  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <div className={cx('rank', dense && 'rank--dense')} style={{ '--grid': grid } as CSSProperties}>
      <div className="rank__head" role="row">
        {showIndex && <span />}
        <span>{t('rank.name')}</span>
        <span className="ta-r">{valueHeader}</span>
        {columns.map((c, i) => (
          <span key={i} className="ta-r">
            {c}
          </span>
        ))}
        <span />
      </div>
      {shown.map((it, i) => (
        <RankRow key={it.key} item={it} index={i} max={m} showIndex={showIndex} open={open.has(it.key)} onToggle={() => toggle(it.key)} />
      ))}
      {limit && items.length > limit && (
        <button className="rank__more" onClick={() => setAll((v) => !v)}>
          {all ? t('rank.collapse') : t('rank.showAll', { n: items.length })}
        </button>
      )}
    </div>
  );
}

function RankRow({ item, index, max, showIndex, open, onToggle, child }: { item: RankItem; index: number; max: number; showIndex: boolean; open?: boolean; onToggle?: () => void; child?: boolean }) {
  const expandable = !!item.children;
  const clickable = expandable || item.href || item.onClick;
  const props: HTMLAttributes<HTMLElement> = {
    className: cx('rank__row', child && 'rank__row--child', clickable && 'is-clickable', open && 'is-open', item.tone && `is-${item.tone}`),
    role: !item.href && clickable ? 'button' : undefined,
    tabIndex: !item.href && clickable ? 0 : undefined,
    'aria-expanded': expandable ? open : undefined,
    style: { '--c': item.color, animationDelay: `${Math.min(index * 35, 500)}ms` } as CSSProperties,
    onClick: expandable ? onToggle : item.onClick,
    onKeyDown: (e: KeyboardEvent) => {
      if (!item.href && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        (expandable ? onToggle : item.onClick)?.();
      }
    },
  };
  const body = (
    <>
      {showIndex && <span className="rank__idx mono">{child ? '' : String(index + 1).padStart(2, '0')}</span>}
      <span className="rank__main">
        <span className="rank__label">
          <span className="rank__name">{item.label}</span>
          {item.badge}
        </span>
        {item.sub && <span className="rank__sub">{item.sub}</span>}
      </span>
      <span className="rank__value mono">{item.valueText}</span>
      {item.cols.map((c, i) => (
        <span key={i} className="rank__col mono">
          {c}
        </span>
      ))}
      <span className="rank__chev" aria-hidden>
        {expandable ? (open ? '−' : '+') : item.href ? '→' : ''}
      </span>
      <span className="rank__bar" style={{ gridColumn: `${showIndex ? 2 : 1} / -2` }}>
        <CometBar value={item.value} max={max} color={item.color} delay={80 + Math.min(index * 40, 600)} marker={item.marker} height={child ? 3 : 5} />
      </span>
    </>
  );
  return (
    <>
      {item.href ? (
        <a {...props} href={item.href}>
          {body}
        </a>
      ) : (
        <div {...props}>{body}</div>
      )}
      {expandable && open && (
        <div className="rank__children">
          {item.children!.length ? (
            item.children!.map((c, i) => <RankRow key={c.key} item={c} index={i} max={max} showIndex={showIndex} child />)
          ) : (
            <div className="rank__empty">{item.childrenEmpty ?? t('rank.noData')}</div>
          )}
        </div>
      )}
    </>
  );
}
