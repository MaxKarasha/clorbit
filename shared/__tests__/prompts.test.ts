// The prompt builder: both variants, both languages, exact commands, the safety rules.
import { describe, expect, it } from 'vitest';
import { buildPrompts, disablePluginItem, enablePluginInProjectItem, moveSkillItem, reviewItem, shq, type PromptLang } from '../prompts';

const spec = (lang: PromptLang) => ({
  lang,
  summary: 'two plugins unused',
  items: [
    disablePluginItem(lang, { key: 'superpowers@claude-plugins-official', why: 'unused for 45 days', settingsFile: '~/.claude/settings.json' }),
    moveSkillItem(lang, { name: 'old-scraper', skillsDir: '~/.claude/skills', why: 'never used' }),
    enablePluginInProjectItem(lang, { key: 'superpowers@claude-plugins-official', dir: '~/code/my app', why: 'used there' }),
    reviewItem({ name: 'x:dup', action: 'Compare x:dup with dup', why: 'same name' }),
  ],
  verify: ['claude plugin list'],
});

describe('buildPrompts', () => {
  for (const lang of ['en', 'uk'] as const) {
    it(`${lang}: both variants carry the exact names, commands, undo and safety rules`, () => {
      const p = buildPrompts(spec(lang));
      for (const text of [p.all, p.ask]) {
        expect(text).toContain('claude plugin disable superpowers@claude-plugins-official --scope user');
        expect(text).toContain('claude plugin enable superpowers@claude-plugins-official --scope user');
        expect(text).toContain('mkdir -p ~/.claude/skills-disabled && mv ~/.claude/skills/old-scraper ~/.claude/skills-disabled/old-scraper');
        expect(text).toContain('cd "$HOME/code/my app" && claude plugin enable superpowers@claude-plugins-official --scope local');
        // Backup of every settings file the steps touch.
        expect(text).toContain('cp ~/.claude/settings.json ~/.claude/settings.json.bak-$(date +%Y%m%d-%H%M%S)');
        expect(text).toContain('cp "$HOME/code/my app/.claude/settings.local.json"');
        expect(text).toContain('claude plugin list');
        expect(text).toContain('Claude Code');
        expect(text).not.toMatch(/\brm\b/);
      }
      expect(p.ask).toContain('AskUserQuestion');
      expect(p.all).not.toContain('AskUserQuestion');
      expect(p.all).not.toBe(p.ask);
    });
  }

  it('en wording: plan first, backups, no deletes, new sessions', () => {
    const p = buildPrompts(spec('en'));
    expect(p.all).toMatch(/First show me the full list of changes/);
    expect(p.all).toMatch(/back it up/);
    expect(p.all).toMatch(/Do not delete anything/);
    expect(p.all).toMatch(/apply to new Claude Code sessions/);
    expect(p.ask).toMatch(/Do not change anything yet/);
    expect(p.ask).toMatch(/Apply only what I confirmed/);
    expect(p.ask.indexOf('Show me the list of changes I confirmed')).toBeLessThan(p.ask.indexOf('Apply only what I confirmed'));
  });

  it('uk wording is Ukrainian (never Russian)', () => {
    const p = buildPrompts(spec('uk'));
    expect(p.all).toMatch(/Зроби, будь ласка/);
    expect(p.all).toMatch(/зроби його копію/);
    expect(p.ask).toMatch(/Поки нічого не змінюй/);
    expect(p.ask).toMatch(/«Так, зроби»/);
    for (const text of [p.all, p.ask]) expect(text).not.toMatch(/[ыэъё]/i);
  });

  it('without verify commands the report line still reads well', () => {
    const p = buildPrompts({ ...spec('en'), verify: [] });
    expect(p.all).toContain('At the end, show me a short report');
  });
});

describe('shq', () => {
  it('leaves safe words alone and quotes the rest, keeping ~ expandable', () => {
    expect(shq('superpowers@claude-plugins-official')).toBe('superpowers@claude-plugins-official');
    expect(shq('~/.claude/skills/a')).toBe('~/.claude/skills/a');
    expect(shq('~/my dir/$x')).toBe('"$HOME/my dir/\\$x"');
    expect(shq("/tmp/it's")).toBe(`'/tmp/it'\\''s'`);
  });
});
