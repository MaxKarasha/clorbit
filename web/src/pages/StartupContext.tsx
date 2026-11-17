import { useState, type CSSProperties } from 'react';
import type { AnalyticsOverview, AttributionReport, UsageRow } from '@shared/api';
import { t, tp, type MsgKey } from '../i18n';
import { useApi } from '../lib/api';
import { alpha } from '../lib/colors';
import { fmtInt, fmtPct, fmtTokens } from '../lib/format';
import { href } from '../lib/router';
import RankList from '../components/RankList';
import { Chip, cx, Empty, PageHeader, Panel, Tooltip, TipRow, useTip } from '../components/ui';
import { Eyebrow, Guard, rangeQs, useRangeApi } from './common';

const WINDOW = 200_000;

/** Color categories of startup-context rows (server `extra.kind`); labels are dictionary keys. */
export const KINDS: Record<string, { labelKey: MsgKey; color: string }> = {
  system: { labelKey: 'kind.system', color: '#6b7cff' },
  skills: { labelKey: 'kind.skills', color: '#a78bfa' },
  hook: { labelKey: 'kind.hook', color: '#ff6fb0' },
  mcp: { labelKey: 'kind.mcp', color: '#5cc8ff' },
  instructions: { labelKey: 'kind.instructions', color: '#4fe0b0' },
  tools: { labelKey: 'kind.tools', color: '#e6e36a' },
  agents: { labelKey: 'kind.agents', color: '#9af06b' },
  other: { labelKey: 'kind.other', color: '#8c90aa' },
};

export const kindLabel = (k: string): string => t(KINDS[k]?.labelKey ?? 'kind.other');

/** Canonical startup-context key → color category (used when the server sends no `extra.kind`). */
const KEY_KIND: Record<string, string> = {
  system: 'system',
  env: 'system',
  toolDefs: 'tools',
  deferred: 'tools',
  skills: 'skills',
  mcp: 'mcp',
  agents: 'agents',
  claudeMd: 'instructions',
  other: 'other',
};

export function kindOf(r: { key?: string; label: string; extra?: Record<string, number | string> }): string {
  const k = r.extra?.kind;
  if (typeof k === 'string' && KINDS[k]) return k;
  if (r.key) {
    if (r.key.startsWith('hook:')) return 'hook';
    if (r.key.startsWith('mcp:')) return 'mcp';
    if (KEY_KIND[r.key]) return KEY_KIND[r.key];
  }
  // Last resort for older servers: guess from an English label.
  const l = r.label.toLowerCase();
  if (l.includes('mcp')) return 'mcp';
  if (l.includes('hook')) return 'hook';
  if (l.includes('claude.md') || l.includes('instruction')) return 'instructions';
  if (l.includes('skill')) return 'skills';
  if (l.includes('agent')) return 'agents';
  if (l.includes('tool')) return 'tools';
  if (l.includes('system')) return 'system';
  return 'other';
}

const per = (r: UsageRow) => Number(r.extra?.perSession ?? 0);

/** Name of the plugin / MCP server a row belongs to: `group`, then the canonical key, then the label. */
function sourceName(item: UsageRow): string | undefined {
  if (item.group) return item.group;
  if (item.key.startsWith('hook:plugin:')) return item.key.slice('hook:plugin:'.length);
  if (item.key.startsWith('mcp:')) return item.key.slice('mcp:'.length);
  return item.label.match(/MCP:\s*(.+)$/)?.[1]?.trim();
}

/** Whether what gets loaded is actually used: look the source up among plugins and MCP servers. */
function usageOf(item: UsageRow, d: AttributionReport): { used: number; source: 'plugin' | 'mcp' } | null {
  const name = sourceName(item);
  if (!name) return null;
  const mcp = d.mcpServers.find((m) => m.key === name || m.label === name);
  if (mcp) return { used: mcp.calls > 0 ? mcp.sessions : 0, source: 'mcp' };
  const pl = d.plugins.find((p) => p.key === name || p.label === name);
  if (pl) return { used: pl.total > 0 || pl.calls > 0 ? pl.sessions : 0, source: 'plugin' };
  return { used: 0, source: kindOf(item) === 'mcp' ? 'mcp' : 'plugin' };
}

export default function StartupContext() {
  const q = useRangeApi<AttributionReport>('/api/analytics/attribution');
  const ov = useApi<AnalyticsOverview>(`/api/analytics/overview?${rangeQs(q.range)}`);
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow section={t('nav.context')} range={q.range} />}
        title={t('ctx.title')}
        lede={t('ctx.lede')}
      />
      <Guard state={q} label={t('ctx.loading')}>
        {(d) => <Body d={d} periodTotal={ov.data?.totals.total ?? null} sessionsTotal={ov.data?.totals.sessions ?? null} />}
      </Guard>
    </>
  );
}

function Body({ d, periodTotal, sessionsTotal }: { d: AttributionReport; periodTotal: number | null; sessionsTotal: number | null }) {
  const items = d.startupContext;
  const [focus, setFocus] = useState<string | null>(null);
  const { tip, show, hide } = useTip();
  if (!items.length) return <Empty title={t('ctx.emptyTitle')}>{t('ctx.emptyText')}</Empty>;

  const maxSessions = Math.max(...items.map((i) => i.sessions), 1);
  const S = sessionsTotal ?? maxSessions;
  // Typical session: each item's contribution is weighted by the share of sessions it appears in.
  const typical = items
    .map((i) => ({ item: i, tokens: per(i) * Math.min(1, i.sessions / Math.max(1, S)), kind: kindOf(i) }))
    .filter((x) => x.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);
  const perSessionTotal = typical.reduce((s, x) => s + x.tokens, 0);
  const totalCost = items.reduce((s, i) => s + i.total, 0);
  const share = periodTotal ? totalCost / periodTotal : null;

  const flags = new Map<string, { used: number; loaded: number }>();
  for (const it of items) {
    const u = usageOf(it, d);
    if (u && u.used / Math.max(1, it.sessions) < 0.15) flags.set(it.key, { used: u.used, loaded: it.sessions });
  }
  const wasted = items.filter((i) => flags.has(i.key));
  const wastedPerSession = wasted.reduce((s, i) => s + per(i), 0);
  const wastedTotal = wasted.reduce((s, i) => s + i.total, 0);

  const hasTurns = items.some((i) => i.turns > 0);
  const byKind = new Map<string, number>();
  typical.forEach((x) => byKind.set(x.kind, (byKind.get(x.kind) ?? 0) + x.tokens));

  return (
    <div className="stack">
      <section className="budget glass" aria-label={t('ctx.budgetAria')}>
        <div className="budget__head">
          <div>
            <div className="eyebrow">{t('ctx.typicalStarts')}</div>
            <div className="budget__big">
              <span className="mono">{fmtTokens(perSessionTotal)}</span> <span className="budget__unit">{t('ctx.tokensUnit')}</span>
            </div>
            <div className="budget__cap">
              {t('ctx.windowShareA')} <span className="mono">{fmtPct(perSessionTotal / WINDOW)}</span> {t('ctx.windowShareB', { window: fmtTokens(WINDOW) })}
            </div>
          </div>
          <div className="budget__side">
            <BudgetStat label={t('ctx.cost')} value={fmtTokens(totalCost)} note={share != null ? t('ctx.ofAllTokens', { pct: fmtPct(share) }) : t('ctx.cacheWriteRead')} />
            <BudgetStat
              label={t('ctx.wasted')}
              value={wasted.length ? t('ctx.perSessionValue', { n: fmtTokens(wastedPerSession) }) : '—'}
              note={wasted.length ? `${tp('ctx.sources', wasted.length, { count: fmtInt(wasted.length) })} · ${t('ctx.inPeriod', { n: fmtTokens(wastedTotal) })}` : t('ctx.allUsed')}
              tone={wasted.length ? 'warn' : undefined}
            />
          </div>
        </div>

        <div className="budget__window" aria-hidden>
          <span className="budget__window-fill" style={{ width: `${Math.min(100, (perSessionTotal / WINDOW) * 100)}%` }} />
          <span className="budget__window-label mono">
            {t('common.of', { a: fmtTokens(perSessionTotal), b: fmtTokens(WINDOW) })}
          </span>
        </div>

        <div className="budget__bar" onMouseLeave={() => (hide(), setFocus(null))}>
          {typical.map((x, i) => {
            const c = KINDS[x.kind].color;
            const pct = x.tokens / perSessionTotal;
            const flagged = flags.has(x.item.key);
            return (
              <div
                key={x.item.key}
                className={cx('budget__seg', flagged && 'is-flagged', focus && focus !== x.item.key && 'is-dim')}
                style={{ flexGrow: x.tokens, '--c': c, '--cbg': alpha(c, 0.22), animationDelay: `${i * 45}ms` } as CSSProperties}
                onMouseEnter={() => setFocus(x.item.key)}
                onMouseMove={(e) =>
                  show(
                    e,
                    <>
                      <div className="tip-title">{x.item.label}</div>
                      <TipRow color={c} label={kindLabel(x.kind)} value={fmtPct(pct)} />
                      <TipRow label={t('col.perSession')} value={fmtTokens(per(x.item))} />
                      <TipRow label={t('ctx.inSessions')} value={t('common.of', { a: fmtInt(x.item.sessions), b: fmtInt(S) })} />
                      {flagged && <div className="tip-warn">{t('ctx.rarelyUsed')}</div>}
                    </>,
                  )
                }
              >
                {pct > 0.07 && (
                  <span className="budget__seg-text">
                    <span className="budget__seg-name">{x.item.label}</span>
                    <span className="budget__seg-val mono">{fmtTokens(x.tokens)}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <ul className="legend budget__legend">
          {[...byKind.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <li key={k}>
                <span className="dot" style={{ background: KINDS[k].color, boxShadow: `0 0 8px ${KINDS[k].color}` }} />
                <span className="legend__label">{kindLabel(k)}</span>
                <span className="legend__value mono">{fmtTokens(v)}</span>
              </li>
            ))}
        </ul>
        <Tooltip tip={tip} />
      </section>

      {wasted.length > 0 && (
        <Panel title={t('ctx.wasteTitle')} hint={t('ctx.wasteHint')} className="panel--warn">
          <div className="waste">
            {wasted
              .sort((a, b) => b.total - a.total)
              .map((w) => {
                const f = flags.get(w.key)!;
                return (
                  <div key={w.key} className="waste__item">
                    <div className="waste__name">{w.label}</div>
                    <div className="waste__nums">
                      <span>
                        <span className="mono">{fmtTokens(per(w))}</span> {t('ctx.perSessionUnit')}
                      </span>
                      <span>
                        {t('ctx.loadedIn')} <span className="mono">{fmtInt(f.loaded)}</span>, {t('ctx.usedIn')} <span className="mono warn-text">{fmtInt(f.used)}</span>
                      </span>
                      <span>
                        <span className="mono">{fmtTokens(w.total)}</span> {t('ctx.inPeriodUnit')}
                      </span>
                    </div>
                  </div>
                );
              })}
            <a className="btn btn--ghost" href={href('/insights')}>
              {t('ctx.howToDisable')}
            </a>
          </div>
        </Panel>
      )}

      <Panel title={t('ctx.allSources')} hint={t('ctx.allSourcesHint')}>
        <RankList
          valueHeader={t('col.inPeriod')}
          columns={hasTurns ? [t('col.perSession'), t('col.sessions'), t('col.turns')] : [t('col.perSession'), t('col.sessions')]}
          colWidth={[96, 80, 88]}
          items={items.map((it) => {
            const k = kindOf(it);
            const kl = kindLabel(k);
            const f = flags.get(it.key);
            return {
              key: it.key,
              label: it.label,
              sub: (
                <span>
                  {kl !== it.label && <span style={{ color: KINDS[k].color }}>{kl}</span>}
                  {it.group && <span className="mono muted">{kl !== it.label ? ' · ' : ''}{it.group}</span>}
                </span>
              ),
              badge: f ? <Chip tone="warn">{t('ctx.usedBadge', { used: fmtInt(f.used), loaded: fmtInt(f.loaded) })}</Chip> : undefined,
              value: it.total,
              valueText: fmtTokens(it.total),
              color: KINDS[k].color,
              cols: hasTurns ? [fmtTokens(per(it)), fmtInt(it.sessions), fmtInt(it.turns)] : [fmtTokens(per(it)), fmtInt(it.sessions)],
            };
          })}
        />
      </Panel>
    </div>
  );
}

function BudgetStat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'warn' }) {
  return (
    <div className={cx('bstat', tone && `bstat--${tone}`)}>
      <div className="bstat__label">{label}</div>
      <div className="bstat__value mono">{value}</div>
      <div className="bstat__note">{note}</div>
    </div>
  );
}
