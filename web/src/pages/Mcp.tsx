import type { AttributionReport } from '@shared/api';
import { t } from '../i18n';
import { branchColor } from '../lib/colors';
import { fmtAgo, fmtInt, fmtTokens } from '../lib/format';
import RankList, { type RankItem } from '../components/RankList';
import Recommendations from '../components/Recommendations';
import { PageHeader, Panel } from '../components/ui';
import { Eyebrow, Guard, unusedChip, useRangeApi } from './common';

export default function Mcp() {
  const q = useRangeApi<AttributionReport>('/api/analytics/attribution');
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow section={t('nav.mcp')} range={q.range} />}
        title={t('mcp.title')}
        lede={t('mcp.lede')}
      />
      <Recommendations page="mcp" />
      <Guard state={q}>{(d) => <Body d={d} />}</Guard>
    </>
  );
}

function Body({ d }: { d: AttributionReport }) {
  const max = Math.max(...d.mcpServers.map((s) => s.total), 1);
  const silent = d.mcpServers.filter((s) => s.calls === 0);
  const totalCalls = d.mcpServers.reduce((s, x) => s + x.calls, 0);
  const totalResult = d.mcpServers.reduce((s, x) => s + Number(x.extra?.resultTokens ?? 0), 0);

  return (
    <div className="stack">
      <section className="facts glass">
        <Fact value={fmtInt(d.mcpServers.length)} label={t('mcp.connected')} />
        <Fact value={fmtInt(totalCalls)} label={t('mcp.toolCalls')} />
        <Fact value={fmtTokens(totalResult)} label={t('common.resultTokens')} />
        <Fact value={fmtInt(silent.length)} label={t('mcp.noCalls')} tone={silent.length ? 'warn' : undefined} />
      </section>

      <Panel title={t('mcp.servers')} hint={t('mcp.serversHint')}>
        <RankList
          valueHeader={t('col.tokens')}
          columns={[t('col.calls'), t('col.results'), t('col.sessions'), t('col.last')]}
          colWidth={[80, 100, 64, 110]}
          max={max}
          items={d.mcpServers.map((s, i) => {
            const color = branchColor(i);
            const tools = d.mcpTools.filter((tool) => tool.group === s.key);
            return {
              key: s.key,
              label: s.label,
              badge: s.calls === 0 ? unusedChip() : undefined,
              tone: s.calls === 0 ? 'muted' : undefined,
              value: s.total,
              valueText: fmtTokens(s.total),
              color,
              cols: [fmtInt(s.calls), fmtTokens(Number(s.extra?.resultTokens ?? 0)), fmtInt(s.sessions), <span className="muted">{fmtAgo(s.lastUsed)}</span>],
              children: tools.map(
                (tool) =>
                  ({
                    key: tool.key,
                    label: <span className="mono">{tool.label}</span>,
                    value: tool.total,
                    valueText: fmtTokens(tool.total),
                    color,
                    cols: [fmtInt(tool.calls), Number(tool.extra?.resultTokens ?? 0) ? fmtTokens(Number(tool.extra?.resultTokens)) : '—', fmtInt(tool.sessions), <span className="muted">{fmtAgo(tool.lastUsed)}</span>],
                  }) satisfies RankItem,
              ),
              childrenEmpty: t('mcp.noToolCalls'),
            } satisfies RankItem;
          })}
        />
      </Panel>
    </div>
  );
}

export function Fact({ value, label, tone }: { value: string; label: string; tone?: 'warn' }) {
  return (
    <div className={`fact${tone ? ` fact--${tone}` : ''}`}>
      <div className="fact__value mono">{value}</div>
      <div className="fact__label">{label}</div>
    </div>
  );
}
