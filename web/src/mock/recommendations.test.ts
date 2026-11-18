// Demo recommendations for the Skills & plugins tab: shape, determinism, threshold, page filter, language.
import { afterAll, describe, expect, it } from 'vitest';
import type { Insight } from '@shared/api';
import { setLang } from '../i18n';
import { mockResolve } from './index';
import { mockSkillRecommendations } from './recommendations';

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
