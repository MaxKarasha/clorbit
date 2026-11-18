import type { AnalyticsOverview } from '@shared/api';
import { locale, t, tp } from '../i18n';
import { branchColor, modelColor, TOKEN_COLORS, tokenLabel } from '../lib/colors';
import { fmtAgo, fmtInt, fmtModel, fmtPct, fmtTokens } from '../lib/format';
import { href } from '../lib/router';
import StackedDaily from '../components/charts/StackedDaily';
import { Donut, Heatmap, Legend, Sparkline } from '../components/charts/small';
import RankList from '../components/RankList';
import { Empty, PageHeader, Panel } from '../components/ui';
import type { ActiveRange } from '../lib/router';
import { Eyebrow, Guard, useRangeApi } from './common';
import LimitsPanel from './LimitsPanel';

export default function Overview() {
  const q = useRangeApi<AnalyticsOverview>('/api/analytics/overview');
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow section={t('nav.overview')} range={q.range} />}
        title={t('overview.title')}
        lede={t('overview.lede')}
      />
      <Guard state={q} label={t('overview.loading')}>
        {(d) => <OverviewBody d={d} range={q.range} />}
      </Guard>
    </>
  );
}

function OverviewBody({ d, range }: { d: AnalyticsOverview; range: ActiveRange }) {
  const tot = d.totals;
  if (!tot.total && !tot.sessions) {
    return (
      <div className="stack">
        <Empty title={t('overview.emptyTitle')}>
          {t('overview.emptyText')}
        </Empty>
        <LimitsPanel range={range} />
      </div>
    );
  }
  const inputSide = tot.input + tot.cacheRead + tot.cacheWrite;
  const cacheRate = inputSide ? tot.cacheRead / inputSide : 0;
  const dailyTotals = d.daily.map((p) => p.tokens.input + p.tokens.output + p.tokens.cacheRead + p.tokens.cacheWrite);
  const days = Math.max(1, d.daily.length);
  const modelSeries = d.models.map((m, i) => ({ key: m.key, label: fmtModel(m.label), color: modelColor(m.key, i) }));
  const maxProject = Math.max(...d.projects.map((p) => p.total), 1);

  return (
    <div className="stack">
      {/* Instrument: key metrics */}
      <section className="kpis glass" aria-label={t('overview.kpisAria')}>
        <div className="kpi kpi--hero">
          <div className="kpi__label">{t('overview.totalTokens')}</div>
          <div className="kpi__value kpi__value--hero mono">{fmtTokens(tot.total)}</div>
          <div className="kpi__foot">
            <Sparkline values={dailyTotals} width={180} height={34} />
            <span className="kpi__note">
              ≈ <span className="mono">{fmtTokens(tot.total / days)}</span> {t('overview.perDayUnit')}
            </span>
          </div>
        </div>
        <Kpi label={t('overview.sessions')} value={fmtInt(tot.sessions)} note={tp('overview.inProjects', tot.projects, { count: fmtInt(tot.projects) })} series={d.daily.map((p) => p.sessions)} color={branchColor(1)} />
        <Kpi
          label={t('overview.subagents')}
          value={fmtInt(tot.subagents)}
          note={tot.sessions ? t('overview.perSession', { n: fmtOneDecimal(tot.subagents / tot.sessions) }) : ''}
          series={d.daily.map((p) => p.subagents)}
          color={branchColor(2)}
        />
        <Kpi label={t('overview.toolCalls')} value={fmtInt(tot.toolCalls)} note={t('overview.perDay', { n: fmtInt(tot.toolCalls / days) })} series={d.daily.map((p) => p.toolCalls)} color={branchColor(3)} />
        <Kpi label={t('overview.compactions')} value={fmtInt(tot.compactions)} note={tot.compactions ? t('overview.overflowed') : t('overview.notOverflowed')} tone={tot.compactions > tot.sessions * 0.15 ? 'warn' : undefined} />
        <Kpi label={t('overview.cacheShare')} value={fmtPct(cacheRate)} note={t('overview.cacheNote')} meter={cacheRate} />
      </section>

      <div className="grid grid--2-1">
        <Panel title={t('overview.daily')} hint={t('overview.dailyHint')} actions={<Legend items={modelSeries.map((s) => ({ label: s.label, color: s.color }))} />}>
          <StackedDaily daily={d.daily} series={modelSeries} value={(p, k) => p.byModel[k] ?? 0} height={340} />
        </Panel>
        <Panel title={t('overview.mix')} hint={t('overview.mixHint')}>
          <Donut
            size={196}
            center={{ label: t('overview.donutTotal'), value: fmtTokens(tot.total) }}
            segments={(['cacheRead', 'cacheWrite', 'input', 'output'] as const).map((k) => ({ key: k, label: tokenLabel(k), value: tot[k], color: TOKEN_COLORS[k] }))}
          />
        </Panel>
      </div>

      <LimitsPanel range={range} />

      <div className="grid grid--7-5">
        <Panel title={t('overview.projects')} hint={t('overview.projectsHint')}>
          <RankList
            valueHeader={t('col.tokens')}
            columns={[t('col.sessions'), t('col.subagents'), t('col.last')]}
            colWidth={[64, 88, 104]}
            max={maxProject}
            limit={10}
            items={d.projects.map((p, i) => ({
              key: p.key,
              label: p.label,
              value: p.total,
              valueText: fmtTokens(p.total),
              color: branchColor(i),
              cols: [fmtInt(p.sessions), fmtInt(Number(p.extra?.subagents ?? 0)), <span className="muted">{fmtAgo(p.lastUsed)}</span>],
              href: href('/analytics/sessions', { project: p.key }),
            }))}
          />
        </Panel>
        <div className="stack">
          <Panel title={t('overview.heatmap')} hint={t('overview.heatmapHint')}>
            <Heatmap cells={d.heatmap} />
          </Panel>
          <Panel title={t('overview.models')}>
            <RankList
              dense
              showIndex={false}
              valueHeader={t('col.tokens')}
              columns={[t('col.share')]}
              colWidth={72}
              items={d.models.map((m, i) => ({
                key: m.key,
                label: fmtModel(m.label),
                sub: <span className="mono">{m.key}</span>,
                value: m.total,
                valueText: fmtTokens(m.total),
                color: modelColor(m.key, i),
                cols: [fmtPct(m.total / (tot.total || 1), 0)],
              }))}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** One decimal in the current locale (e.g. 2.4 / 2,4). */
function fmtOneDecimal(n: number): string {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
}

function Kpi({ label, value, note, series, color, tone, meter }: { label: string; value: string; note?: string; series?: number[]; color?: string; tone?: 'warn'; meter?: number }) {
  return (
    <div className={`kpi${tone ? ` kpi--${tone}` : ''}`}>
      <div className="kpi__label">{label}</div>
      <div className="kpi__value mono">{value}</div>
      <div className="kpi__foot">
        {series && <Sparkline values={series} color={color} width={96} height={22} />}
        {meter != null && (
          <span className="meter" aria-hidden>
            <span style={{ width: `${meter * 100}%` }} />
          </span>
        )}
      </div>
      {note && <div className="kpi__note">{note}</div>}
    </div>
  );
}
