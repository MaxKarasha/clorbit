import type { AttributionReport, UsageRow } from '@shared/api';
import { t, tp } from '../i18n';
import { branchColor } from '../lib/colors';
import { fmtAgo, fmtInt, fmtPct, fmtTokens } from '../lib/format';
import RankList, { type RankItem } from '../components/RankList';
import Recommendations from '../components/Recommendations';
import { PageHeader, Panel } from '../components/ui';
import { Eyebrow, Guard, unusedChip, useRangeApi } from './common';


function skillName(s: UsageRow): string {
  return s.group && s.label.startsWith(`${s.group}:`) ? s.label.slice(s.group.length + 1) : s.label;
}

export function skillItem(s: UsageRow, i: number, color?: string): RankItem {
  const loads = Number(s.extra?.loads ?? s.calls);
  return {
    key: s.key,
    label: skillName(s),
    sub: s.group ? <span className="mono">{s.group}</span> : <span className="muted">{t('attr.ownSkill')}</span>,
    badge: s.total === 0 && loads === 0 ? unusedChip() : undefined,
    tone: s.total === 0 ? 'muted' : undefined,
    value: s.total,
    valueText: fmtTokens(s.total),
    color: color ?? branchColor(i + 1),
    cols: [fmtInt(s.turns), fmtInt(loads), fmtInt(s.sessions), <span className="muted">{fmtAgo(s.lastUsed)}</span>],
  };
}

export default function Attribution() {
  const q = useRangeApi<AttributionReport>('/api/analytics/attribution');
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow section={t('nav.attribution')} range={q.range} />}
        title={t('attr.title')}
        lede={t('attr.lede')}
      />
      <Recommendations page="skills" />
      <Guard state={q}>{(d) => <Body d={d} />}</Guard>
    </>
  );
}

function Body({ d }: { d: AttributionReport }) {
  const pluginsTotal = d.plugins.reduce((s, p) => s + p.total, 0);
  const all = pluginsTotal + d.unattributedTotal;
  const max = Math.max(...d.plugins.map((p) => p.total), ...d.skills.map((s) => s.total), 1);
  const idle = d.plugins.filter((p) => p.total === 0 && p.calls === 0).length;
  const idleSkills = d.skills.filter((s) => s.total === 0).length;

  return (
    <div className="stack">
      <section className="split glass" aria-label={t('attr.splitAria')}>
        <div className="split__text">
          <div className="split__big mono">{fmtPct(all ? pluginsTotal / all : 0)}</div>
          <div className="split__cap">
            {t('attr.viaPlugins')}
            <span className="muted"> · {t('attr.rest', { n: fmtTokens(d.unattributedTotal) })}</span>
          </div>
        </div>
        <div className="split__bar" aria-hidden>
          {d.plugins
            .filter((p) => p.total > 0)
            .map((p, i) => (
              <span key={p.key} title={`${p.label}: ${fmtTokens(p.total)}`} style={{ flexGrow: p.total, background: branchColor(i), boxShadow: `0 0 12px ${branchColor(i)}` }} />
            ))}
          <span className="split__rest" style={{ flexGrow: d.unattributedTotal }} />
        </div>
        <div className="split__facts">
          <span>
            <span className="mono">{fmtInt(d.plugins.length)}</span> {tp('attr.pluginsCount', d.plugins.length)}
          </span>
          <span>
            <span className="mono">{fmtInt(d.skills.length)}</span> {tp('attr.skillsCount', d.skills.length)}
          </span>
          {idle + idleSkills > 0 && (
            <span className="warn-text">
              <span className="mono">{fmtInt(idle + idleSkills)}</span> {t('attr.unusedCount')}
            </span>
          )}
        </div>
      </section>

      <div className="grid grid--1-1">
        <Panel title={t('attr.plugins')} hint={t('attr.pluginsHint')}>
          <RankList
            valueHeader={t('col.tokens')}
            columns={[t('col.turns'), t('col.callsShort'), t('col.sessions'), t('col.last')]}
            colWidth={[64, 56, 56, 96]}
            max={max}
            items={d.plugins.map((p, i) => {
              const skills = d.skills.filter((s) => s.group === p.key);
              return {
                key: p.key,
                label: p.label,
                badge: p.total === 0 && p.calls === 0 ? unusedChip() : undefined,
                tone: p.total === 0 ? 'muted' : undefined,
                value: p.total,
                valueText: fmtTokens(p.total),
                color: branchColor(i),
                cols: [fmtInt(p.turns), fmtInt(p.calls), fmtInt(p.sessions), <span className="muted">{fmtAgo(p.lastUsed)}</span>],
                children: skills.map((s, j) => ({ ...skillItem(s, j, branchColor(i)), sub: undefined })),
                childrenEmpty: t('attr.noSkills'),
              } satisfies RankItem;
            })}
          />
        </Panel>
        <Panel title={t('attr.skills')} hint={t('attr.skillsHint')}>
          <RankList valueHeader={t('col.tokens')} columns={[t('col.turns'), t('col.callsShort'), t('col.sessions'), t('col.last')]} colWidth={[64, 56, 56, 96]} max={max} limit={14} items={d.skills.map((s, i) => skillItem(s, i))} />
        </Panel>
      </div>
    </div>
  );
}
