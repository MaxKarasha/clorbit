// Recommendations: the strip at the top of an analytics tab and the card shared with the Insights page.
// Cards come from GET /api/insights?page=<tab>; hiding one stores its id in Settings.recommendations.dismissed.
// Clorbit never changes anything itself: a card offers a prompt to paste into a Claude Code session.
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { Insight, InsightPage, InsightPrompts, InsightSaving } from '@shared/api';
import { t, tp, type MsgKey } from '../i18n';
import { BRANCH, STATUS } from '../lib/colors';
import { fmtAgo, fmtInt, fmtPct, fmtTokens } from '../lib/format';
import { navigate } from '../lib/router';
import { updateSettings, useSettings } from '../lib/settings';
import { useRangeApi } from '../pages/common';
import { CopyBlock, cx } from './ui';

/** Severity accents. No orange: it is reserved for "waiting for you". */
export const REC_SEV: Record<Insight['severity'], { labelKey: MsgKey; color: string; rank: number }> = {
  high: { labelKey: 'rec.sev.high', color: STATUS.danger, rank: 0 },
  warn: { labelKey: 'rec.sev.warn', color: BRANCH[1], rank: 1 },
  info: { labelKey: 'rec.sev.info', color: STATUS.working, rank: 2 },
};

/** How many cards a tab's strip shows; the rest are on the Insights page. */
const STRIP_MAX = 4;

/** Hidden recommendation ids and the actions on them (saved with the settings; in-memory only in demo mode). */
export function useDismissed() {
  const s = useSettings();
  const list = s.recommendations.dismissed;
  const set = new Set(list);
  return {
    set,
    hide: (id: string) => updateSettings({ recommendations: { dismissed: [...list.filter((x) => x !== id), id] } }),
    show: (id: string) => updateSettings({ recommendations: { dismissed: list.filter((x) => x !== id) } }),
  };
}

export const recOrder = (a: Insight, b: Insight) =>
  REC_SEV[a.severity].rank - REC_SEV[b.severity].rank || (b.estSavingTokens ?? 0) - (a.estSavingTokens ?? 0);

/** The Recommendations strip of one analytics tab (respects the tab's date range). */
export default function Recommendations({ page }: { page: InsightPage }) {
  const days = useSettings().recommendations.unusedDays;
  const q = useRangeApi<Insight[]>('/api/insights', `&page=${page}&unusedDays=${days}`);
  const dismissed = useDismissed();
  const [showHidden, setShowHidden] = useState(false);
  if (!q.data) return null;
  // Actionable cards (with a prompt) first, then by severity and savings.
  const ranked = [...q.data].sort((a, b) => Number(!!b.prompts) - Number(!!a.prompts) || recOrder(a, b));
  const visible = ranked.filter((i) => !dismissed.set.has(i.id));
  const hidden = ranked.filter((i) => dismissed.set.has(i.id));
  if (!visible.length && !hidden.length) return null;
  const shown = visible.slice(0, STRIP_MAX);
  const more = visible.length - shown.length;
  return (
    <section className={cx('recs', q.refreshing && 'is-refreshing')} aria-labelledby={`recs-${page}`}>
      <div className="recs__head">
        <h2 className="recs__title" id={`recs-${page}`}>
          {t('rec.title')}
          {visible.length > 0 && <span className="recs__count mono">{fmtInt(visible.length)}</span>}
        </h2>
        <p className="recs__hint">{t('rec.hint')}</p>
      </div>
      {shown.length > 0 && (
        <div className="recs__grid">
          {shown.map((ins, i) => (
            <RecommendationCard key={ins.id} ins={ins} index={i} compact onHide={() => dismissed.hide(ins.id)} />
          ))}
        </div>
      )}
      {showHidden && hidden.length > 0 && (
        <div className="recs__grid recs__grid--hidden">
          {hidden.map((ins, i) => (
            <RecommendationCard key={ins.id} ins={ins} index={i} compact hidden onShow={() => dismissed.show(ins.id)} />
          ))}
        </div>
      )}
      {(more > 0 || hidden.length > 0) && (
        <div className="recs__foot">
          {more > 0 && (
            <button type="button" className="recs__link" onClick={() => navigate('/insights')}>
              {tp('rec.more', more)}
            </button>
          )}
          {hidden.length > 0 && <HiddenToggle n={hidden.length} open={showHidden} onToggle={() => setShowHidden((v) => !v)} />}
        </div>
      )}
    </section>
  );
}

export function HiddenToggle({ n, open, onToggle }: { n: number; open: boolean; onToggle: () => void }) {
  return (
    <span className="recs__hidden">
      {tp('rec.hiddenCount', n)} ·{' '}
      <button type="button" className="recs__link" aria-expanded={open} onClick={onToggle}>
        {open ? t('rec.collapseHidden') : t('rec.showHidden')}
      </button>
    </span>
  );
}

// ---------- the card ----------

export function RecommendationCard({
  ins,
  index = 0,
  compact = false,
  hidden = false,
  onHide,
  onShow,
}: {
  ins: Insight;
  index?: number;
  /** Strip variant: evidence folds into the item list. */
  compact?: boolean;
  hidden?: boolean;
  onHide?: () => void;
  onShow?: () => void;
}) {
  const sev = REC_SEV[ins.severity];
  const targets = ins.targets ?? [];
  const [open, setOpen] = useState(!compact && targets.length > 0 && targets.length <= 3);
  const listId = useId();
  const evidenceInline = ins.evidence.length > 0 && (!targets.length || !compact);
  return (
    <article
      className={cx('insight rec glass', `insight--${ins.severity}`, compact && 'rec--compact', hidden && 'rec--hidden')}
      style={{ '--c': sev.color, animationDelay: `${index * 70}ms` } as CSSProperties}
      data-rec-id={ins.id}
    >
      <div className="insight__head">
        <span className="insight__sev">
          <span className="dot" style={{ background: sev.color, boxShadow: `0 0 10px ${sev.color}` }} />
          {t(sev.labelKey)}
        </span>
        {ins.scope && (
          <span className="rec__scope" title={t(ins.scope === 'history' ? 'rec.scope.historyTip' : 'rec.scope.rangeTip')}>
            {t(ins.scope === 'history' ? 'rec.scope.history' : 'rec.scope.range')}
          </span>
        )}
      </div>
      <h3 className="insight__title">{ins.title}</h3>
      <p className="insight__detail">{ins.detail}</p>
      {ins.saving ? <Savings s={ins.saving} /> : ins.estSavingTokens ? (
        <div className="rec__save rec__save--plain">
          {t('insights.saving')} <span className="mono">{fmtTokens(ins.estSavingTokens)}</span>
        </div>
      ) : null}
      {evidenceInline && <Evidence lines={ins.evidence} />}
      {targets.length > 0 && (
        <div className="rec__items">
          <button type="button" className="rec__toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
            <span className={cx('rec__chev', open && 'is-open')} aria-hidden>
              ›
            </span>
            {open ? t('rec.itemsHide') : tp('rec.items', targets.length)}
          </button>
          {open && (
            <div id={listId}>
              <ul className="rec__list">
                {targets.map((tg) => (
                  <li key={tg.key}>
                    <span className="rec__name mono" title={tg.key}>
                      {tg.label}
                    </span>
                    <span className="rec__meta">
                      {tg.lastUsed === null ? (
                        <span className="rec__never">{t('rec.never')}</span>
                      ) : tg.lastUsed !== undefined ? (
                        <span title={new Date(tg.lastUsed).toLocaleString()}>{t('rec.lastUsed', { when: fmtAgo(tg.lastUsed) })}</span>
                      ) : null}
                      {tg.tokensPerSession ? <span className="mono">{t('rec.perSession', { n: fmtTokens(tg.tokensPerSession) })}</span> : null}
                    </span>
                    {tg.note && <span className="rec__note">{tg.note}</span>}
                  </li>
                ))}
              </ul>
              {compact && ins.evidence.length > 0 && <Evidence lines={ins.evidence} />}
            </div>
          )}
        </div>
      )}
      {!ins.prompts && ins.fix && <CopyBlock text={ins.fix} />}
      <div className="rec__actions">
        {ins.prompts && !hidden && <PromptButton prompts={ins.prompts} />}
        {hidden ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onShow}>
            {t('rec.unhide')}
          </button>
        ) : onHide ? (
          <button type="button" className="btn btn--ghost btn--sm rec__hide" onClick={onHide} title={t('rec.hideTip')}>
            {t('rec.hide')}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function Evidence({ lines }: { lines: string[] }) {
  return (
    <div className="insight__evidence">
      <div className="eyebrow">{t('rec.evidence')}</div>
      <ul>
        {lines.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

/** "−3.2K context tokens per session and per subagent · ≈ −41M over 30 days · 6% of the startup context". */
export function Savings({ s }: { s: InsightSaving }) {
  const per = s.perSession ?? 0;
  const sub = s.perSubagent ?? 0;
  const same = per > 0 && sub > 0 && Math.abs(per - sub) <= 0.1 * Math.max(per, sub);
  const lead = per || sub;
  if (!lead && !s.period) return null;
  return (
    <div className="rec__save">
      {lead > 0 && (
        <div className="rec__save-main">
          <span className="rec__save-big mono">−{fmtTokens(lead)}</span>
          <span className="rec__save-cap">
            {same ? t('rec.save.perBoth') : t('rec.save.perSession')}
            {!same && per > 0 && sub > 0 && <span className="rec__save-sub"> · {t('rec.save.perSub', { n: fmtTokens(sub) })}</span>}
          </span>
        </div>
      )}
      <div className="rec__save-line">
        {s.period ? (
          <span className="mono">{t(s.basis === 'range' ? 'rec.save.periodRange' : 'rec.save.period', { n: fmtTokens(s.period), days: s.days ?? 30 })}</span>
        ) : null}
        {s.pctStartup ? <span>{t('rec.save.pct', { pct: fmtPct(s.pctStartup, s.pctStartup < 0.1 ? 1 : 0) })}</span> : null}
        <span className="rec__est" title={t('rec.save.estimateTip')}>
          {t('rec.save.estimate')}
        </span>
      </div>
    </div>
  );
}

// ---------- "Copy prompt ▾" ----------

type Variant = keyof InsightPrompts;
const VARIANT_KEY = 'clorbit.recVariant';
const readVariant = (): Variant => {
  try {
    return localStorage.getItem(VARIANT_KEY) === 'all' ? 'all' : 'ask';
  } catch {
    return 'ask';
  }
};

async function copyText(text: string) {
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
}

/** Split button: the left part copies the last chosen variant ("Ask me" by default), ▾ opens both. */
export function PromptButton({ prompts }: { prompts: InsightPrompts }) {
  const [variant, setVariant] = useState<Variant>(readVariant);
  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(timer);
  }, [copied]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [menu]);
  const copy = async (v: Variant) => {
    await copyText(prompts[v]);
    setVariant(v);
    try {
      localStorage.setItem(VARIANT_KEY, v);
    } catch {
      /* storage unavailable */
    }
    setMenu(false);
    setCopied(true);
  };
  const vLabel = (v: Variant) => t(v === 'all' ? 'rec.variant.all' : 'rec.variant.ask');
  return (
    <div className="rec__copy" ref={ref}>
      <div className={cx('splitbtn', copied && 'is-done')}>
        <button type="button" className="splitbtn__main" onClick={() => void copy(variant)} aria-live="polite" data-variant={variant}>
          {copied ? `✓ ${t('rec.copied')}` : t('rec.copyAs', { variant: vLabel(variant) })}
        </button>
        <button
          type="button"
          className="splitbtn__more"
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-controls={menuId}
          aria-label={t('rec.menu')}
          title={t('rec.menu')}
          onClick={() => setMenu((v) => !v)}
        >
          ▾
        </button>
      </div>
      {copied && <span className="rec__pasted">{t('rec.pasteHint')}</span>}
      {menu && (
        <div className="rec__menu glass" role="menu" id={menuId}>
          {(['ask', 'all'] as const).map((v) => (
            <button key={v} type="button" role="menuitem" className={cx('rec__menu-item', v === variant && 'is-default')} onClick={() => void copy(v)} data-variant={v}>
              <b>{vLabel(v)}</b>
              <span>{t(v === 'all' ? 'rec.variant.allD' : 'rec.variant.askD')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
