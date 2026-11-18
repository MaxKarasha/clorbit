// The prompt builder: both variants, both languages, exact commands, the safety rules.
import { describe, expect, it } from 'vitest';
import {
  agentModelItem, allowRuleItem, buildPrompts, instructionNoteItem, compressInstructionsItem, consolidateMemoryItem, disableClaudeAiConnectorsItem, disableMcpJsonServerItem, disablePluginItem,
  enablePluginInProjectItem, moveMcpToProjectsItem, moveSkillItem, PROMPT_NOTES, removeMcpServerItem, reviewItem, shq, type PromptLang,
} from '../prompts';

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

describe('MCP and instruction-file items', () => {
  const mcp = (lang: PromptLang) => buildPrompts({
    lang,
    summary: 's',
    items: [
      removeMcpServerItem(lang, { name: 'pencil', scope: 'user', claudeJson: '~/.claude.json', why: 'unused' }),
      removeMcpServerItem(lang, { name: 'db', scope: 'local', dir: '~/code/my app', claudeJson: '~/.claude.json', why: 'unused' }),
      moveMcpToProjectsItem(lang, { name: 'github', dirs: ['~/code/a', '~/code/b'], claudeJson: '~/.claude.json', why: 'used in a, b' }),
      disableMcpJsonServerItem(lang, { name: 'sentry', dir: '~/code/a', why: 'unused' }),
      disableClaudeAiConnectorsItem(lang, { settingsFile: '~/.claude/settings.json', why: 'none used' }),
      compressInstructionsItem(lang, { path: '~/.claude/CLAUDE.md', why: 'big' }),
      consolidateMemoryItem(lang, { path: '~/.claude/projects/-x/memory/MEMORY.md', why: 'big' }),
    ],
    verify: ['claude mcp list'],
    notes: [PROMPT_NOTES[lang].mcpRemove('~/.claude.json'), PROMPT_NOTES[lang].jq, ...PROMPT_NOTES[lang].compress, ...PROMPT_NOTES[lang].memory],
  });
  for (const lang of ['en', 'uk'] as const) {
    it(`${lang}: exact claude mcp commands per scope, undo from the backup, backups of every file, no rm`, () => {
      const p = mcp(lang);
      for (const text of [p.all, p.ask]) {
        expect(text).toContain('claude mcp remove pencil --scope user');
        expect(text).toContain('cd "$HOME/code/my app" && claude mcp remove db --scope local');
        expect(text).toContain(`(cd ~/code/a && claude mcp add-json github "$(jq -c --arg n github '.mcpServers[$n]' ~/.claude.json)" --scope local) && (cd ~/code/b && claude mcp add-json github`);
        expect(text).toContain(') && claude mcp remove github --scope user');
        expect(text).toContain('"disabledMcpjsonServers"');
        expect(text).toContain('"disableClaudeAiConnectors": true');
        for (const f of ['~/.claude.json', '~/code/a/.claude/settings.local.json', '~/.claude/settings.json', '~/.claude/CLAUDE.md', '~/.claude/projects/-x/memory/MEMORY.md']) {
          expect(text).toContain(`cp ${f} ${f}.bak-$(date +%Y%m%d-%H%M%S)`);
        }
        expect(text).toContain('claude mcp list');
        expect(text).not.toMatch(/\brm\b/);
        expect(text).not.toMatch(/[ыэъё]/i);
      }
    });
  }
  it('en wording of the notes: the one allowed removal, @imports load at startup, archive instead of delete', () => {
    const p = mcp('en');
    expect(p.all).toContain('"claude mcp remove" is the one removal allowed here, and only after ~/.claude.json is backed up');
    expect(p.all).toContain('not an @import');
    expect(p.all).toContain('into an "archive" folder next to them (do not delete them)');
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

describe('allow rules, instruction notes, subagent models', () => {
  for (const lang of ['en', 'uk'] as const) {
    it(`${lang}: exact rule, file and line; every file backed up; the allow rules' safety notes`, () => {
      const p = buildPrompts({
        lang,
        summary: 'x',
        items: [
          allowRuleItem(lang, { rule: 'Bash(git status *)', file: '~/code/app/.claude/settings.local.json', why: 'approved 9 times' }),
          instructionNoteItem(lang, { name: 'tail', file: '~/.claude/CLAUDE.md', section: 'Output hygiene', text: 'Pipe long output through | tail -n 40.', why: 'Bash: 6 results over 20K' }),
          agentModelItem(lang, { name: 'code-reviewer', file: '~/.claude/agents/code-reviewer.md', model: 'sonnet', why: 'read-only' }),
        ],
        notes: [...PROMPT_NOTES[lang].allow, ...PROMPT_NOTES[lang].note('~/.claude/CLAUDE.md'), ...PROMPT_NOTES[lang].agentModel],
      });
      for (const text of [p.all, p.ask]) {
        expect(text).toContain('"Bash(git status *)"');
        expect(text).toContain('"permissions.allow"');
        expect(text).toContain('"Output hygiene"');
        expect(text).toContain('"Pipe long output through | tail -n 40."');
        expect(text).toContain('"model: sonnet"');
        for (const f of ['~/code/app/.claude/settings.local.json', '~/.claude/CLAUDE.md', '~/.claude/agents/code-reviewer.md']) expect(text).toContain(`cp ${f} ${f}.bak-$(date +%Y%m%d-%H%M%S)`);
        expect(text).toContain('Bash(*)');
        expect(text).not.toMatch(/\brm\b/);
        if (lang === 'uk') expect(text).not.toMatch(/[ыэъё]/i);
      }
    });
  }
});
