import { useState } from 'react';
import type { Insight } from '@shared/api';
import { t } from '../i18n';
import { fmtInt, fmtTokens } from '../lib/format';
import { useSettings } from '../lib/settings';
import { Empty, PageHeader } from '../components/ui';
import { HiddenToggle, REC_SEV, RecommendationCard, recOrder, useDismissed } from '../components/Recommendations';
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

function Body({ list }: { list: Insight[] }) {
  const dismissed = useDismissed();
  const [showHidden, setShowHidden] = useState(false);
  const visible = list.filter((i) => !dismissed.set.has(i.id)).sort(recOrder);
  const hidden = list.filter((i) => dismissed.set.has(i.id)).sort(recOrder);
  if (!list.length) return <Empty title={t('insights.emptyTitle')}>{t('insights.emptyText')}</Empty>;
  const saving = visible.reduce((s, i) => s + (i.estSavingTokens ?? 0), 0);
  const count = (s: Insight['severity']) => visible.filter((i) => i.severity === s).length;
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
        <div className="fact">
          <div className="fact__value mono">{saving ? `≈ ${fmtTokens(saving)}` : '—'}</div>
          <div className="fact__label">{t('insights.savingTotal')}</div>
        </div>
      </section>
      {visible.length > 0 ? (
        <div className="insights">
          {visible.map((ins, i) => (
            <RecommendationCard key={ins.id} ins={ins} index={i} onHide={() => dismissed.hide(ins.id)} />
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
            <RecommendationCard key={ins.id} ins={ins} index={i} hidden onShow={() => dismissed.show(ins.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
