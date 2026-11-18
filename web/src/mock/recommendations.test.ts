// Demo recommendations for the Skills & plugins, MCP and Startup context tabs: shape, determinism, threshold,
// page filter, language.
import { afterAll, describe, expect, it } from 'vitest';
import type { Insight } from '@shared/api';
import { setLang } from '../i18n';
import { mockResolve } from './index';
import { mockMcpRecommendations, mockSkillRecommendations } from './recommendations';

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
