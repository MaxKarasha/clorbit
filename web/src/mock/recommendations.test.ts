// Demo recommendations for the Skills & plugins, MCP and Startup context tabs: shape, determinism, threshold,
// page filter, language.
import { afterAll, describe, expect, it } from 'vitest';
import type { Insight, LimitsForecast, WindowForecast } from '@shared/api';
import { setLang } from '../i18n';
import { mockResolve } from './index';
import { mockLimitsRecommendations, mockMcpRecommendations, mockSkillRecommendations } from './recommendations';

const NOW = new Date(2026, 10, 18, 15, 7).getTime();
const range = { from: '2026-11-05', to: '2026-11-18' };
afterAll(() => setLang('en'));

describe('demo recommendations', () => {
  it('a believable set for the skills tab, every card actionable', () => {
    const list = mockSkillRecommendations(range, 30, NOW);
    expect(list.map((i) => i.id.split(':')[0])).toEqual(['unused-plugins', 'hook-context', 'unused-skills', 'unused-own-skills', 'duplicate-skills']);
    for (const i of list) {
      expect(i.pages).toContain('skills');
      expect(i.prompts?.all.length).toBeGreaterThan(200);
      expect(i.prompts?.ask).toContain('AskUserQuestion');
      expect(i.targets?.length).toBeGreaterThan(0);
      expect(i.severity).toMatch(/^(high|warn|info)$/);
    }
    const unused = list[0];
    expect(unused.saving).toMatchObject({ days: 30, basis: 'projection' });
    expect(unused.saving!.period).toBeGreaterThan(unused.saving!.perSession!);
    expect(unused.prompts!.all).toContain('claude plugin disable cowork-plugin-management@knowledge-work --scope user');
    expect(list[3].prompts!.all).toContain('mv ~/.claude/skills/pdf-tools ~/.claude/skills-disabled/pdf-tools');
  });

  it('is deterministic and follows the threshold', () => {
    expect(mockSkillRecommendations(range, 30, NOW)).toEqual(mockSkillRecommendations(range, 30, NOW));
    const at50 = mockSkillRecommendations(range, 50, NOW);
    expect(at50[0].targets!.map((t) => t.label)).toEqual(['cowork-plugin-management']);
    expect(at50[0].title).toContain('cowork-plugin-management');
  });

  it('the demo endpoint filters by page and follows the language', () => {
    const skills = mockResolve(`/api/insights?from=${range.from}&to=${range.to}&page=skills&unusedDays=30`) as Insight[];
    expect(skills.length).toBe(5);
    expect(skills.every((i) => i.pages?.includes('skills'))).toBe(true);
    const all = mockResolve(`/api/insights?from=${range.from}&to=${range.to}`) as Insight[];
    expect(all.length).toBeGreaterThan(skills.length);
    expect(mockResolve(`/api/insights?from=${range.from}&to=${range.to}&page=nope`)).toEqual([]);
    setLang('uk');
    const uk = mockSkillRecommendations(range, 30, NOW);
    expect(uk[0].title).toMatch(/плагіни/);
    expect(uk[0].prompts!.ask).toMatch(/Поки нічого не змінюй/);
  });
});

describe('demo recommendations: MCP and Startup context', () => {
  const at = (page: string) => mockResolve(`/api/insights?from=${range.from}&to=${range.to}&page=${page}&unusedDays=30`) as Insight[];

  it('the MCP tab: unused servers with a command per source, failures, heavy results, a server for one project', () => {
    setLang('en');
    const list = at('mcp');
    expect(list.every((i) => i.pages?.includes('mcp'))).toBe(true);
    expect(list.map((i) => i.id.split(':')[0]).sort()).toEqual(['big-results-mcp', 'mcp-failing', 'mcp-projects', 'unused-mcp']);
    const unused = list.find((i) => i.id.startsWith('unused-mcp:'))!;
    expect(unused.prompts!.all).toContain('claude mcp remove postgres --scope user');
    expect(unused.prompts!.all).toContain('"disabledMcpjsonServers" in ~/code/billing-service/.claude/settings.local.json');
    expect(unused.prompts!.all).toMatch(/Disconnect the claude\.ai connector Miro/);
    expect(unused.prompts!.all).toContain('cp ~/.claude.json ~/.claude.json.bak-$(date +%Y%m%d-%H%M%S)');
    const move = list.find((i) => i.id.startsWith('mcp-projects:'))!;
    expect(move.prompts!.all).toContain('(cd ~/code/aurora-web && claude mcp add-json playwright');
    for (const i of list) {
      expect(i.prompts?.ask).toContain('AskUserQuestion');
      expect(i.prompts!.all).not.toMatch(/\brm\b/);
    }
    // Threshold: at 50 days only the servers unused that long stay.
    expect(mockMcpRecommendations(range, 50, NOW)[0].targets!.map((t) => t.key)).toEqual(['claude_ai_Miro', 'claude_ai_Canva', 'sentry']);
    expect(mockMcpRecommendations(range, 30, NOW)).toEqual(mockMcpRecommendations(range, 30, NOW));
  });

  it('the Startup tab: files, memory, hook, the listing card pointing to Skills & plugins, the total', () => {
    setLang('en');
    const list = at('startup');
    expect(list.every((i) => i.pages?.includes('startup'))).toBe(true);
    const ids = list.map((i) => i.id);
    for (const id of ['big-instructions:demo', 'big-memory:demo', 'hook-event-context:demo', 'startup-skill-listing', 'startup-total']) expect(ids).toContain(id);
    const listing = list.find((i) => i.id === 'startup-skill-listing')!;
    expect(listing.seeAlso).toBe('skills');
    expect(listing.saving!.perSession).toBeGreaterThan(0);
    expect(listing.estSavingTokens).toBeUndefined();
    const files = list.find((i) => i.id === 'big-instructions:demo')!;
    expect(files.prompts!.all).toContain('cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak-$(date +%Y%m%d-%H%M%S)');
    expect(files.prompts!.all).toContain('not an @import');
    expect(list.find((i) => i.id === 'startup-total')!.evidence.join('\n')).toMatch(/Subagents start with their own startup context/);
  });

  it('Ukrainian demo (never Russian letters)', () => {
    setLang('uk');
    for (const page of ['mcp', 'startup']) {
      for (const i of at(page)) {
        for (const text of [i.title, i.detail, ...i.evidence, i.prompts?.all ?? '', i.prompts?.ask ?? '']) expect(text).not.toMatch(/[ыэъё]/i);
      }
    }
    expect(at('mcp').find((i) => i.id.startsWith('unused-mcp:'))!.title).toMatch(/4 підключені MCP-сервери/);
    setLang('en');
  });
});

describe('demo recommendations: Tools and Subagents', () => {
  const at = (page: string) => mockResolve(`/api/insights?from=${range.from}&to=${range.to}&page=${page}&unusedDays=30`) as Insight[];

  it('the Tools tab: allow rules with the waiting time, re-reads, output hygiene, a failing tool, the MCP heavy results', () => {
    setLang('en');
    const list = at('tools');
    expect(list.every((i) => i.pages?.includes('tools'))).toBe(true);
    expect(list.map((i) => i.id.split(':')[0]).sort()).toEqual(['big-outputs', 'big-results-mcp', 'failing-tools', 'permission-allow', 'repeated-reads']);
    const allow = list.find((i) => i.id.startsWith('permission-allow:'))!;
    expect(allow.saving!.waitMs).toBeGreaterThan(60_000);
    expect(allow.prompts!.all).toContain('Add "Bash(git status *)" to "permissions.allow" in ~/.claude/settings.json');
    expect(allow.prompts!.all).toContain('Add "Bash(pnpm test *)" to "permissions.allow" in ~/code/aurora-web/.claude/settings.local.json');
    expect(allow.prompts!.all).toContain('cp ~/code/aurora-web/.claude/settings.local.json ~/code/aurora-web/.claude/settings.local.json.bak-');
    const big = list.find((i) => i.id.startsWith('big-outputs:'))!;
    expect(big.prompts!.ask).toContain('"Output hygiene" section of ~/.claude/CLAUDE.md');
    for (const i of list) {
      expect(i.prompts?.ask).toContain('AskUserQuestion');
      expect(i.prompts!.all).not.toMatch(/\brm\b/);
    }
  });

  it('the Subagents tab: a cheaper model (share of cost), startup overhead pointing to Startup, a burst, failing agents', () => {
    setLang('en');
    const list = at('subagents');
    expect(list.map((i) => i.id).sort()).toEqual(['agent-failing:demo', 'agent-model:demo', 'agent-nesting:demo', 'agent-startup:demo']);
    const model = list.find((i) => i.id === 'agent-model:demo')!;
    expect(model.saving).toMatchObject({ costShare: 0.5, basis: 'range' });
    expect(model.prompts!.all).toContain('set "model: sonnet" in the frontmatter of ~/.claude/agents/code-reviewer.md');
    expect(model.prompts!.all).toContain('Start Explore subagents for searches and lookups with model "sonnet"');
    expect(list.find((i) => i.id === 'agent-startup:demo')!.seeAlso).toBe('startup');
    expect(at('subagents')).toEqual(list);
  });

  it('Ukrainian demo (never Russian letters)', () => {
    setLang('uk');
    for (const page of ['tools', 'subagents']) {
      for (const i of at(page)) {
        for (const text of [i.title, i.detail, ...i.evidence, i.prompts?.all ?? '', i.prompts?.ask ?? '']) expect(text).not.toMatch(/[ыэъё]/i);
      }
    }
    expect(at('subagents').find((i) => i.id === 'agent-model:demo')!.prompts!.ask).toContain('Поки нічого не змінюй');
    setLang('en');
  });
});

describe('demo recommendations: Sessions, Overview, the Session page and the limits panel', () => {
  const q = (qs: string) => mockResolve(`/api/insights?from=${range.from}&to=${range.to}&unusedDays=30&${qs}`) as Insight[];
  const H = 3_600_000;
  const win = (w: '5h' | '7d', o: Partial<WindowForecast> = {}): WindowForecast => ({ window: w, pct: null, resetsAt: null, ratePerHour: 0, hitsAt: null, pctAtReset: null, confidence: 'medium', basis: 'limits', points: 9, ...o });
  const fc = (seven: Partial<WindowForecast>): LimitsForecast => ({ source: 'statusline', now: NOW, updatedAt: NOW, fiveHour: win('5h', { noWindow: true }), sevenDay: win('7d', seven) });

  it('the Sessions tab: idle-gap rebuilds with a measured saving, compactions with a CLAUDE.md note, reviews for the rest', () => {
    setLang('en');
    const list = q('page=sessions');
    expect(list.map((i) => i.id).sort()).toEqual(['auto-compactions:demo', 'automated-sessions:demo', 'context-full:demo', 'effort-simple:demo', 'idle-rebuilds:demo', 'low-cache-days:demo']);
    expect(list.every((i) => i.pages?.includes('sessions'))).toBe(true);
    const idle = list.find((i) => i.id === 'idle-rebuilds:demo')!;
    expect(idle.estSavingTokens).toBeGreaterThan(0);
    expect(idle.prompts).toBeUndefined();
    const compact = list.find((i) => i.id === 'auto-compactions:demo')!;
    expect(compact.prompts!.all).toContain('Add one line to the "Long tasks" section of ~/.claude/CLAUDE.md');
    expect(compact.prompts!.all).toContain('.bak-$(date +%Y%m%d-%H%M%S)');
    expect(compact.prompts!.all).not.toMatch(/\brm\b/);
    for (const id of ['low-cache-days:demo', 'effort-simple:demo', 'context-full:demo', 'automated-sessions:demo']) {
      expect(list.find((i) => i.id === id)!.estSavingTokens).toBeUndefined();
    }
  });

  it('the Overview: the best cards of several tabs, ranked by savings, never a limits card', () => {
    const top = q('page=overview');
    expect(top.length).toBeGreaterThanOrEqual(3);
    expect(new Set(top.slice(0, 3).map((i) => i.pages?.[0])).size).toBeGreaterThan(1);
    expect(top.some((i) => i.pages?.includes('limits'))).toBe(false);
    for (let k = 1; k < top.length; k++) expect(top[k - 1].estSavingTokens ?? 0).toBeGreaterThanOrEqual(top[k].estSavingTokens ?? 0);
  });

  it('the Session page: that session\'s cards, deterministic, linking to their tabs; no id → none', () => {
    const a = q('page=session&session=11111111-1111-4111-8111-111111111111');
    expect(a.map((i) => i.id.split(':')[0]).sort()).toEqual(['auto-compactions@session', 'idle-rebuilds@session', 'repeated-reads@session']);
    expect(a.every((i) => i.pages?.length === 1 && i.pages[0] === 'session' && i.seeAlso)).toBe(true);
    expect(q('page=session&session=11111111-1111-4111-8111-111111111111')).toEqual(a);
    expect(q('page=session')).toEqual([]);
  });

  it('the limits panel: one card from the demo forecast; the pace when the week has room, the levers when it runs out', () => {
    const lim = q('page=limits');
    expect(lim).toHaveLength(1);
    expect(lim[0].pages).toEqual(['limits']);
    const week = { input: 2e6, output: 3e6, cacheRead: 900e6, cacheWrite: 60e6 };
    const cards = q('');
    const pace = mockLimitsRecommendations(fc({ pct: 30, ratePerHour: 0.2, resetsAt: NOW + 3 * 24 * H, pctAtReset: 44 }), cards, week, NOW);
    expect(pace.map((i) => i.id)).toEqual(['limits-pace:demo']);
    expect(pace[0].title).toBe('On pace to finish the week at ≈ 44% of the weekly limit: you have room');
    const out = mockLimitsRecommendations(fc({ pct: 82, ratePerHour: 1.1, hitsAt: NOW + 16 * H, resetsAt: NOW + 40 * H, pctAtReset: 100 }), cards, week, NOW);
    expect(out[0].id).toBe('limits-runout:demo');
    expect(out[0].saving!.windowPct).toBeGreaterThan(0);
    expect(out[0].saving!.window).toBe('7d');
    expect(out[0].estSavingTokens).toBeUndefined();
    expect(out[0].targets!.length).toBeGreaterThan(0);
    expect(out[0].seeAlso).toBeTruthy();
  });

  it('Ukrainian demo for the new strips (never Russian letters)', () => {
    setLang('uk');
    const all = [...q('page=sessions'), ...q('page=overview'), ...q('page=limits'), ...q('page=session&session=22222222-2222-4222-8222-222222222222')];
    for (const i of all) {
      for (const text of [i.title, i.detail, i.fix ?? '', ...i.evidence, ...(i.targets ?? []).map((t) => t.note ?? ''), i.prompts?.all ?? '', i.prompts?.ask ?? '']) expect(text).not.toMatch(/[ыэъё]/i);
    }
    expect(q('page=sessions').find((i) => i.id === 'auto-compactions:demo')!.prompts!.ask).toContain('Поки нічого не змінюй');
    setLang('en');
  });
});
