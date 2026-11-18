import { useState } from 'react';
import { INSIGHT_PAGES, type Insight, type InsightPage } from '@shared/api';
import { bySavings, homePage, insightTotals } from '@shared/insights';
import { t } from '../i18n';
import { fmtDuration, fmtInt, fmtTokens } from '../lib/format';
import { useSettings } from '../lib/settings';
import { cx, Empty, PageHeader } from '../components/ui';
import { HiddenToggle, PAGE_LINK, REC_SEV, RecommendationCard, useDismissed } from '../components/Recommendations';
import { Eyebrow, Guard, useRangeApi } from './common';

/** Every recommendation of every tab, with the same cards as the tabs' strips. */
export default function Insights() {
  const days = useSettings().recommendations.unusedDays;
  const q = useRangeApi<Insight[]>('/api/insights', `&unusedDays=${days}`);
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow section={t('nav.insights')} range={q.range} />}
        title={t('insights.title')}
        lede={t('insights.lede')}
      />
      <Guard state={q} label={t('insights.loading')}>
        {(d) => <Body list={d} />}
      </Guard>
    </>
  );
}

type Filter = InsightPage | 'all' | 'none';

function Body({ list }: { list: Insight[] }) {
  const dismissed = useDismissed();
  const [showHidden, setShowHidden] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  if (!list.length) return <Empty title={t('insights.emptyTitle')}>{t('insights.emptyText')}</Empty>;
  const pageOf = (i: Insight): Filter => homePage(i) ?? 'none';
  const allVisible = list.filter((i) => !dismissed.set.has(i.id));
  // Chips: every tab that has a card (in the tabs' order), then cards that belong to no tab.
  const counts = new Map<Filter, number>();
  for (const i of allVisible) counts.set(pageOf(i), (counts.get(pageOf(i)) ?? 0) + 1);
  const chips = ([...INSIGHT_PAGES, 'none'] as Filter[]).filter((p) => counts.has(p));
  const active: Filter = filter === 'all' || counts.has(filter) ? filter : 'all';
  const inFilter = (i: Insight) => active === 'all' || pageOf(i) === active;
  // Sorted by savings (tokens, then waiting time), then severity.
  const visible = allVisible.filter(inFilter).sort(bySavings);
  const hidden = list.filter((i) => dismissed.set.has(i.id) && inFilter(i)).sort(bySavings);
  const totals = insightTotals(visible);
  const count = (s: Insight['severity']) => visible.filter((i) => i.severity === s).length;
  const chipLabel = (p: Filter) => (p === 'all' ? t('insights.filterAll') : p === 'none' ? t('insights.filterOther') : t(PAGE_LINK[p].labelKey));
  return (
    <div className="stack">
      <section className="facts glass">
        {(['high', 'warn', 'info'] as const).map((s) => (
          <div key={s} className="fact">
            <div className="fact__value mono" style={{ color: count(s) ? REC_SEV[s].color : undefined }}>
              {fmtInt(count(s))}
            </div>
            <div className="fact__label">{t(REC_SEV[s].labelKey).toLowerCase()}</div>
          </div>
        ))}
        <div className="fact" title={t('insights.savingTotalTip')}>
          <div className="fact__value mono">{totals.tokens ? `≈ ${fmtTokens(totals.tokens)}` : '—'}</div>
          <div className="fact__label">{t('insights.savingTotal')}</div>
        </div>
        {totals.waitMs > 0 && (
          <div className="fact">
            <div className="fact__value mono">≈ {fmtDuration(totals.waitMs)}</div>
            <div className="fact__label">{t('insights.waitTotal')}</div>
          </div>
        )}
      </section>
      {chips.length > 1 && (
        <div className="ins-filter" role="group" aria-label={t('insights.filterAria')}>
          {(['all', ...chips] as Filter[]).map((p) => (
            <button
              key={p}
              type="button"
              className={cx('chip chip--filter', active === p && 'is-active')}
              aria-pressed={active === p}
              onClick={() => setFilter(p)}
              data-filter={p}
            >
              {chipLabel(p)}
              <span className="mono ins-filter__n">{fmtInt(p === 'all' ? allVisible.length : counts.get(p) ?? 0)}</span>
            </button>
          ))}
        </div>
      )}
      {visible.length > 0 ? (
        <div className="insights">
          {visible.map((ins, i) => (
            <RecommendationCard key={ins.id} ins={ins} index={i} showPage onHide={() => dismissed.hide(ins.id)} />
          ))}
        </div>
      ) : (
        <Empty title={t('insights.emptyTitle')}>{t('insights.emptyText')}</Empty>
      )}
      {hidden.length > 0 && (
        <div className="recs__foot">
          <HiddenToggle n={hidden.length} open={showHidden} onToggle={() => setShowHidden((v) => !v)} />
        </div>
      )}
      {showHidden && hidden.length > 0 && (
        <div className="insights">
          {hidden.map((ins, i) => (
            <RecommendationCard key={ins.id} ins={ins} index={i} hidden showPage onShow={() => dismissed.show(ins.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
