import type { CSSProperties } from 'react';
import type { Insight } from '@shared/api';
import { t, tp, type MsgKey } from '../i18n';
import { STATUS } from '../lib/colors';
import { fmtInt, fmtTokens } from '../lib/format';
import { CopyBlock, Empty, PageHeader } from '../components/ui';
import { Eyebrow, Guard, useRangeApi } from './common';

const SEV: Record<Insight['severity'], { labelKey: MsgKey; color: string; rank: number }> = {
  high: { labelKey: 'insights.sev.high', color: STATUS.danger, rank: 0 },
  warn: { labelKey: 'insights.sev.warn', color: STATUS.waiting, rank: 1 },
  info: { labelKey: 'insights.sev.info', color: STATUS.working, rank: 2 },
};

export default function Insights() {
  const q = useRangeApi<Insight[]>('/api/insights');
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
  if (!list.length) return <Empty title={t('insights.emptyTitle')}>{t('insights.emptyText')}</Empty>;
  const sorted = [...list].sort((a, b) => SEV[a.severity].rank - SEV[b.severity].rank || (b.estSavingTokens ?? 0) - (a.estSavingTokens ?? 0));
  const saving = list.reduce((s, i) => s + (i.estSavingTokens ?? 0), 0);
  const count = (s: Insight['severity']) => list.filter((i) => i.severity === s).length;
  return (
    <div className="stack">
      <section className="facts glass">
        {(['high', 'warn', 'info'] as const).map((s) => (
          <div key={s} className="fact">
            <div className="fact__value mono" style={{ color: count(s) ? SEV[s].color : undefined }}>
              {fmtInt(count(s))}
            </div>
            <div className="fact__label">{t(SEV[s].labelKey).toLowerCase()}</div>
          </div>
        ))}
        <div className="fact">
          <div className="fact__value mono">{saving ? `≈ ${fmtTokens(saving)}` : '—'}</div>
          <div className="fact__label">{t('insights.savingTotal')}</div>
        </div>
      </section>
      <div className="insights">
        {sorted.map((ins, i) => (
          <InsightCard key={ins.id} ins={ins} index={i} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({ ins, index }: { ins: Insight; index: number }) {
  const sev = SEV[ins.severity];
  return (
    <article className={`insight glass insight--${ins.severity}`} style={{ '--c': sev.color, animationDelay: `${index * 70}ms` } as CSSProperties}>
      <div className="insight__head">
        <span className="insight__sev">
          <span className="dot" style={{ background: sev.color, boxShadow: `0 0 10px ${sev.color}` }} />
          {t(sev.labelKey)}
        </span>
        {ins.estSavingTokens ? (
          <span className="insight__save">
            {t('insights.saving')} <span className="mono">{fmtTokens(ins.estSavingTokens)}</span>
          </span>
        ) : null}
      </div>
      <h3 className="insight__title">{ins.title}</h3>
      <p className="insight__detail">{ins.detail}</p>
      {ins.evidence.length > 0 && (
        <div className="insight__evidence">
          <div className="eyebrow">
            {tp('insights.evidence', ins.evidence.length, { count: fmtInt(ins.evidence.length) })}
          </div>
          <ul>
            {ins.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {ins.fix && <CopyBlock text={ins.fix} />}
    </article>
  );
}
