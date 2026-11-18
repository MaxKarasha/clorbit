// Demo recommendations for the "Skills & plugins", "MCP" and "Startup context" tabs. Same shape and prompt builder
// as the server's rules (server/recommend-skills.ts, recommend-mcp.ts, recommend-startup.ts); every plugin, skill,
// server, file and project here is invented. Deterministic for a given range, threshold and day.
import type { AttributionReport, Insight, InsightTarget, Range } from '@shared/api';
import {
  buildPrompts, compressInstructionsItem, consolidateMemoryItem, disableMcpJsonServerItem, disablePluginItem, enablePluginInProjectItem,
  moveMcpToProjectsItem, moveSkillItem, PROMPT_NOTES, removeMcpServerItem, reviewItem,
} from '@shared/prompts';
import { getLang, t } from '../i18n';
import { fmtTokens } from '../lib/format';

const DAY = 86_400_000;
const SETTINGS = '~/.claude/settings.json';
const SKILLS = '~/.claude/skills';
/** Demo activity: sessions and subagents (with a skill listing) per day, and the average startup context. */
const SESSIONS_PER_DAY = 26;
const SUBAGENTS_PER_DAY = 70;
const STARTUP_PER_SESSION = 23_400;

const iso = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const num = (n: number) => fmtTokens(n);
const days = (range: Range) => {
  const [a, b] = [range.from, range.to].map((d) => new Date(`${d}T00:00:00`).getTime());
  return Math.max(1, Math.round((b - a) / DAY) + 1);
};
/** A projection over 30 days, like the server's (sessions and subagents both get the context). */
const projection = (perSession: number, perSubagent = perSession) => ({
  perSession,
  ...(perSubagent ? { perSubagent } : {}),
  period: Math.round(30 * (SESSIONS_PER_DAY * perSession + SUBAGENTS_PER_DAY * perSubagent)),
  days: 30,
  basis: 'projection' as const,
  pctStartup: perSession / STARTUP_PER_SESSION,
});

export function mockSkillRecommendations(range: Range, unusedDays = 30, now = Date.now()): Insight[] {
  const lang = getLang();
  const out: Insight[] = [];
  const last = (ts: number | null, seen: number) =>
    ts ? t('mock.rec.lastUsed', { n: Math.floor((now - ts) / DAY) }) : t('mock.rec.never', { date: iso(seen) });
  const old = (ts: number | null, seen: number) => now - (ts ?? seen) >= unusedDays * DAY;

  // A. Unused plugins.
  const plugins = [
    { key: 'cowork-plugin-management@knowledge-work', name: 'cowork-plugin-management', last: null, seen: now - 95 * DAY, skills: 1380, hook: 0 },
    { key: 'andrej-karpathy-skills@karpathy-skills', name: 'andrej-karpathy-skills', last: now - 47 * DAY, seen: now - 120 * DAY, skills: 610, hook: 0 },
  ].filter((p) => old(p.last, p.seen));
  if (plugins.length) {
    const per = plugins.reduce((n, p) => n + p.skills + p.hook, 0);
    const one = plugins.length === 1 ? plugins[0] : null;
    out.push({
      id: `unused-plugins:demo-${plugins.map((p) => p.name).join('+')}`,
      severity: 'warn',
      title: one ? t('mock.rec.unused.titleOne', { name: one.name, last: last(one.last, one.seen) }) : t('mock.rec.unused.titleMany', { n: plugins.length, days: unusedDays }),
      detail: t('mock.rec.unused.detail', { days: unusedDays }),
      evidence: plugins.map((p) => t('mock.rec.unused.evidence', { name: p.name, last: last(p.last, p.seen), n: num(p.skills + p.hook), parts: t('mock.rec.parts.skills', { n: num(p.skills) }) })),
      pages: ['skills', 'startup'],
      scope: 'history',
      saving: projection(per),
      targets: plugins.map((p): InsightTarget => ({ key: p.key, label: p.name, kind: 'plugin', lastUsed: p.last, tokensPerSession: p.skills + p.hook })),
      prompts: buildPrompts({
        lang,
        summary: t('mock.rec.unused.summary', { n: plugins.length, days: unusedDays }),
        items: plugins.map((p) => disablePluginItem(lang, { key: p.key, why: t('mock.rec.why', { last: last(p.last, p.seen), n: num(p.skills + p.hook) }), settingsFile: SETTINGS })),
        verify: ['claude plugin list'],
      }),
    });
  }

  // B. The superpowers SessionStart hook in every session, used in few (the selected range).
  {
    const per = 3900;
    const total = Math.max(12, Math.round(days(range) * SESSIONS_PER_DAY * 0.9));
    const used = Math.max(2, Math.round(total * 0.18));
    const key = 'superpowers@claude-plugins-official';
    const avoid = Math.round((total - used) * per * 1.6); // subagents carry the block too
    out.push({
      id: 'hook-context:superpowers',
      severity: 'high',
      title: t('mock.rec.hook.title', { n: num(per) }),
      detail: t('mock.rec.hook.detail', { used, total }),
      evidence: [t('mock.rec.hook.per', { n: num(per) }), t('mock.rec.hook.sessions', { used, total })],
      pages: ['skills', 'startup'],
      scope: 'range',
      saving: { perSession: per, perSubagent: per, period: avoid, days: days(range), basis: 'range', pctStartup: per / STARTUP_PER_SESSION },
      targets: [{ key, label: 'superpowers', kind: 'plugin', lastUsed: now - 2 * 3_600_000, tokensPerSession: per }],
      prompts: buildPrompts({
        lang,
        summary: t('mock.rec.hook.summary', { n: num(per) }),
        items: [
          disablePluginItem(lang, { key, why: t('mock.rec.hook.why', { n: num(per), used, total }), settingsFile: SETTINGS }),
          enablePluginInProjectItem(lang, { key, dir: '~/code/aurora-web', why: t('mock.rec.hook.whyEnable', { project: 'aurora-web' }) }),
          enablePluginInProjectItem(lang, { key, dir: '~/code/billing-service', why: t('mock.rec.hook.whyEnable', { project: 'billing-service' }) }),
        ],
        verify: ['claude plugin list'],
      }),
    });
  }

  // C. Most of acme-tools' skills unused.
  {
    const skills = [
      { name: 'release-checklist', last: null, seen: now - 70 * DAY, tok: 420 },
      { name: 'oncall-runbook', last: now - 64 * DAY, seen: now - 150 * DAY, tok: 380 },
      { name: 'legacy-deploy', last: null, seen: now - 150 * DAY, tok: 350 },
      { name: 'jira-sync', last: now - 41 * DAY, seen: now - 150 * DAY, tok: 260 },
      { name: 'style-guide', last: now - 33 * DAY, seen: now - 150 * DAY, tok: 210 },
    ].filter((s) => old(s.last, s.seen));
    const usedList = `api-conventions (${last(now - 1 * DAY, 0)}), db-migrations (${last(now - 6 * DAY, 0)})`;
    const totalSkills = skills.length + 2;
    if (skills.length >= 2 && skills.length * 2 > totalSkills) {
      const unusedTok = skills.reduce((n, s) => n + s.tok, 0);
      const all = unusedTok + 520;
      out.push({
        id: `unused-skills:acme-tools:demo-${skills.length}`,
        severity: 'warn',
        title: t('mock.rec.skills.title', { n: skills.length, total: totalSkills, days: unusedDays }),
        detail: t('mock.rec.skills.detail', { unused: num(unusedTok), all: num(all) }),
        evidence: [t('mock.rec.skills.stillUsed', { list: usedList })],
        pages: ['skills'],
        scope: 'history',
        saving: projection(all),
        targets: skills.map((s): InsightTarget => ({ key: `acme-tools:${s.name}`, label: s.name, kind: 'skill', lastUsed: s.last, tokensPerSession: s.tok })),
        prompts: buildPrompts({
          lang,
          summary: t('mock.rec.skills.summary', { n: skills.length, total: totalSkills, days: unusedDays }),
          items: [disablePluginItem(lang, { key: 'acme-tools@acme-internal', why: t('mock.rec.skills.why', { n: skills.length, total: totalSkills, list: usedList }), settingsFile: SETTINGS })],
          verify: ['claude plugin list'],
        }),
      });
    }
  }

  // C2. Own skills unused.
  {
    const own = [
      { name: 'pdf-tools', seen: now - 80 * DAY, tok: 290 },
      { name: 'old-scraper', seen: now - 80 * DAY, tok: 240 },
      { name: 'meeting-notes', seen: now - 80 * DAY, tok: 180 },
    ].filter((s) => old(null, s.seen));
    if (own.length >= 2) {
      const per = own.reduce((n, s) => n + s.tok, 0);
      out.push({
        id: `unused-own-skills:demo-${own.length}`,
        severity: 'info',
        title: t('mock.rec.own.title', { n: own.length, days: unusedDays }),
        detail: t('mock.rec.own.detail'),
        evidence: own.map((s) => t('mock.rec.own.evidence', { name: s.name, last: last(null, s.seen), n: num(s.tok) })),
        pages: ['skills'],
        scope: 'history',
        saving: projection(per),
        targets: own.map((s): InsightTarget => ({ key: s.name, label: s.name, kind: 'ownSkill', lastUsed: null, tokensPerSession: s.tok })),
        prompts: buildPrompts({
          lang,
          summary: t('mock.rec.own.summary', { n: own.length, days: unusedDays }),
          items: own.map((s) => moveSkillItem(lang, { name: s.name, skillsDir: SKILLS, why: t('mock.rec.why', { last: last(null, s.seen), n: num(s.tok) }) })),
          verify: [`ls ${SKILLS}`],
        }),
      });
    }
  }

  // D. A duplicate skill name.
  {
    const ownLast = last(now - 2 * DAY, 0);
    const pluginLast = last(null, now - 58 * DAY);
    out.push({
      id: 'duplicate-skills:demo-frontend-design',
      severity: 'info',
      title: t('mock.rec.dup.title'),
      detail: t('mock.rec.dup.detail'),
      evidence: [t('mock.rec.dup.evidence', { own: ownLast, plugin: pluginLast })],
      pages: ['skills'],
      scope: 'history',
      targets: [{ key: 'ui-ux-pro-max:frontend-design', label: 'frontend-design · ui-ux-pro-max', kind: 'skill', lastUsed: null, tokensPerSession: 310, note: `${t('mock.rec.dup.own')}: ${ownLast}` }],
      prompts: buildPrompts({
        lang,
        summary: t('mock.rec.dup.summary'),
        items: [reviewItem({ name: 'ui-ux-pro-max:frontend-design', action: t('mock.rec.dup.action'), why: t('mock.rec.dup.why') })],
      }),
    });
  }

  for (const r of out) r.estSavingTokens = r.saving?.period;
  return out;
}

const CLAUDE_JSON = '~/.claude.json';

/** Demo recommendations for the MCP tab: unused servers, failing ones, heavy results, a server used in one project. */
export function mockMcpRecommendations(range: Range, unusedDays = 30, now = Date.now()): Insight[] {
  const lang = getLang();
  const out: Insight[] = [];
  const last = (ts: number | null, seen: number) =>
    ts ? t('mock.rec.lastUsed', { n: Math.floor((now - ts) / DAY) }) : t('mock.rec.never', { date: iso(seen) });
  const old = (ts: number | null, seen: number) => now - (ts ?? seen) >= unusedDays * DAY;
  const BILLING = '~/code/billing-service';

  // A. Unused servers, each with the command for where it is configured.
  {
    const servers = [
      { key: 'postgres', label: 'postgres', src: 'user' as const, last: now - 44 * DAY, seen: now - 140 * DAY, tok: 980 },
      { key: 'claude_ai_Miro', label: 'claude.ai Miro', src: 'connector' as const, last: null, seen: now - 80 * DAY, tok: 620 },
      { key: 'claude_ai_Canva', label: 'claude.ai Canva', src: 'connector' as const, last: null, seen: now - 80 * DAY, tok: 540 },
      { key: 'sentry', label: 'sentry', src: 'project' as const, last: now - 52 * DAY, seen: now - 120 * DAY, tok: 410 },
    ].filter((x) => old(x.last, x.seen));
    if (servers.length) {
      const per = servers.reduce((n, x) => n + x.tok, 0);
      const source = (x: (typeof servers)[number]) =>
        x.src === 'user' ? t('mock.rec.mcp.src.user') : x.src === 'project' ? t('mock.rec.mcp.src.project', { dir: BILLING }) : t('mock.rec.mcp.src.connector');
      out.push({
        id: `unused-mcp:demo-${servers.map((x) => x.key).join('+')}`,
        severity: 'warn',
        title: t('mock.rec.mcp.unused.title', { n: servers.length, days: unusedDays }),
        detail: t('mock.rec.mcp.unused.detail', { days: unusedDays }),
        evidence: servers.map((x) => t('mock.rec.mcp.unused.evidence', { name: x.label, source: source(x), last: last(x.last, x.seen), n: num(x.tok) })),
        pages: ['mcp', 'startup'],
        scope: 'history',
        saving: projection(per),
        targets: servers.map((x): InsightTarget => ({ key: x.key, label: x.label, kind: 'mcp', lastUsed: x.last, tokensPerSession: x.tok, note: source(x) })),
        prompts: buildPrompts({
          lang,
          summary: t('mock.rec.mcp.unused.summary', { n: servers.length, days: unusedDays }),
          items: servers.map((x) => {
            const why = t('mock.rec.why', { last: last(x.last, x.seen), n: num(x.tok) });
            if (x.src === 'user') return removeMcpServerItem(lang, { name: x.key, scope: 'user', claudeJson: CLAUDE_JSON, why });
            if (x.src === 'project') return disableMcpJsonServerItem(lang, { name: x.key, dir: BILLING, why });
            return reviewItem({ name: x.label, action: t('mock.rec.mcp.connector.action', { name: x.label.replace(/^claude\.ai /, '') }), why: t('mock.rec.mcp.connector.why', { last: last(x.last, x.seen) }) });
          }),
          verify: ['claude mcp list'],
          notes: servers.some((x) => x.src === 'user') ? [PROMPT_NOTES[lang].mcpRemove(CLAUDE_JSON), PROMPT_NOTES[lang].jq] : [],
        }),
      });
    }
  }

  // B. Failing servers (the selected range).
  {
    const total = Math.max(8, Math.round(days(range) * SESSIONS_PER_DAY * 0.4));
    const linear = { label: 'claude.ai Linear', facts: t('mock.rec.mcp.fail.auth', { n: Math.max(3, Math.round(total * 0.3)) }) };
    const search = { label: 'local-search', facts: t('mock.rec.mcp.fail.failed', { a: Math.max(3, Math.round(total * 0.45)), b: total, err: 'spawn local-search-mcp ENOENT' }) };
    out.push({
      id: 'mcp-failing:demo',
      severity: 'warn',
      title: t('mock.rec.mcp.fail.title'),
      detail: t('mock.rec.mcp.fail.detail'),
      evidence: [`${search.label}: ${search.facts}`, `${linear.label}: ${linear.facts}`],
      pages: ['mcp'],
      scope: 'range',
      targets: [
        { key: 'local-search', label: search.label, kind: 'mcp', note: search.facts },
        { key: 'claude_ai_Linear', label: linear.label, kind: 'mcp', note: linear.facts },
      ],
      prompts: buildPrompts({
        lang,
        summary: t('mock.rec.mcp.fail.summary'),
        items: [
          reviewItem({ name: search.label, action: t('mock.rec.mcp.fail.fixAction', { name: search.label }), why: t('mock.rec.mcp.fail.fixWhy', { facts: search.facts, name: search.label }) }),
          reviewItem({ name: linear.label, action: t('mock.rec.mcp.fail.authAction', { name: linear.label }), why: t('mock.rec.mcp.fail.authWhy', { facts: linear.facts }) }),
        ],
        verify: ['claude mcp list'],
      }),
    });
  }

  // C. Heavy browser results (the selected range).
  {
    const n = Math.max(4, Math.round(days(range) * 1.1));
    const max = 61_000;
    const sum = Math.round(n * 34_000);
    const tip = t('mock.rec.mcp.heavy.tip');
    const period = sum - n * 5000;
    out.push({
      id: 'big-results-mcp:claude-in-chrome',
      severity: sum > 2e6 ? 'high' : sum > 3e5 ? 'warn' : 'info',
      title: t('mock.rec.mcp.heavy.title', { n, max: num(max) }),
      detail: t('mock.rec.mcp.heavy.detail', { sum: num(sum), tip }),
      evidence: [
        t('mock.rec.mcp.heavy.example', { tool: 'computer', n: num(max), project: 'aurora-web' }),
        t('mock.rec.mcp.heavy.example', { tool: 'read_page', n: num(48_000), project: 'aurora-web' }),
        t('mock.rec.mcp.heavy.example', { tool: 'computer', n: num(39_000), project: 'docs-site' }),
      ],
      pages: ['mcp', 'tools'],
      scope: 'range',
      saving: { period, days: days(range), basis: 'range' },
      targets: [
        { key: 'mcp__claude-in-chrome__computer', label: 'computer', kind: 'mcp', note: `${Math.ceil(n * 0.6)}× > 20K` },
        { key: 'mcp__claude-in-chrome__read_page', label: 'read_page', kind: 'mcp', note: `${Math.floor(n * 0.4)}× > 20K` },
      ],
      prompts: buildPrompts({
        lang,
        summary: t('mock.rec.mcp.heavy.summary', { n }),
        items: [reviewItem({ name: 'claude-in-chrome', action: t('mock.rec.mcp.heavy.action'), why: t('mock.rec.mcp.heavy.why', { n, max: num(max), tip }) })],
      }),
    });
  }

  // D. A user-scope server used in one project only.
  {
    const per = 2100;
    const idle = 30 * SESSIONS_PER_DAY * 0.7;
    out.push({
      id: 'mcp-projects:playwright:demo',
      severity: 'warn',
      title: t('mock.rec.mcp.proj.title'),
      detail: t('mock.rec.mcp.proj.detail'),
      evidence: [t('mock.rec.mcp.proj.per', { n: num(per) }), t('mock.rec.mcp.proj.used', { last: last(now - 1 * DAY, 0) }), t('mock.rec.mcp.proj.idle', { n: Math.round(idle) })],
      pages: ['mcp', 'startup'],
      scope: 'history',
      saving: { perSession: per, perSubagent: per, period: Math.round(idle * per * 2.7), days: 30, basis: 'projection', pctStartup: per / STARTUP_PER_SESSION },
      targets: [{ key: 'playwright', label: 'playwright', kind: 'mcp', lastUsed: now - 1 * DAY, tokensPerSession: per, note: t('mock.rec.mcp.src.user') }],
      prompts: buildPrompts({
        lang,
        summary: t('mock.rec.mcp.proj.summary'),
        items: [moveMcpToProjectsItem(lang, { name: 'playwright', dirs: ['~/code/aurora-web'], claudeJson: CLAUDE_JSON, why: t('mock.rec.mcp.proj.why', { n: num(per) }) })],
        verify: ['claude mcp list'],
        notes: [PROMPT_NOTES[lang].mcpRemove(CLAUDE_JSON), PROMPT_NOTES[lang].jq],
      }),
    });
  }

  for (const r of out) r.estSavingTokens = r.saving?.period;
  return out;
}

/** Demo recommendations for the Startup context tab. `at` gives the totals and the skill listing of the demo period. */
export function mockStartupRecommendations(range: Range, at: AttributionReport, skillCards: Insight[]): Insight[] {
  const lang = getLang();
  const out: Insight[] = [];
  const RATIO = 0.4;
  const share = (per: number, perSub = per) => {
    const p = projection(per, perSub);
    return { ...p, perSession: Math.round(per * RATIO), perSubagent: Math.round(perSub * RATIO), period: Math.round(p.period * RATIO), pctStartup: p.pctStartup * RATIO };
  };

  // A. Large instruction files.
  {
    const files = [
      { path: '~/.claude/CLAUDE.md', kind: t('mock.rec.ctx.kind.user'), tok: 3400, sessions: 30 * SESSIONS_PER_DAY, every: 1 },
      { path: '~/code/aurora-web/CLAUDE.md', kind: t('mock.rec.ctx.kind.project'), tok: 2600, sessions: Math.round(30 * SESSIONS_PER_DAY * 0.35), every: 0.35 },
    ];
    const saving = files.map((f) => share(f.tok * f.every));
    const sum = (k: 'perSession' | 'perSubagent' | 'period' | 'pctStartup') => saving.reduce((n, x) => n + (x[k] ?? 0), 0);
    out.push({
      id: 'big-instructions:demo',
      severity: 'warn',
      title: t('mock.rec.ctx.files.title'),
      detail: t('mock.rec.ctx.files.detail'),
      evidence: files.map((f) => t('mock.rec.ctx.files.evidence', { file: f.path, kind: f.kind, n: num(f.tok), s: f.sessions })),
      pages: ['startup'],
      scope: 'history',
      saving: { perSession: Math.round(sum('perSession')), perSubagent: Math.round(sum('perSubagent')), period: Math.round(sum('period')), days: 30, basis: 'projection', pctStartup: sum('pctStartup') },
      targets: files.map((f): InsightTarget => ({ key: f.path, label: f.path, kind: 'file', tokensPerSession: f.tok, note: f.kind })),
      prompts: buildPrompts({
        lang,
        summary: t('mock.rec.ctx.files.summary'),
        items: files.map((f) => compressInstructionsItem(lang, { path: f.path, why: t('mock.rec.ctx.files.why', { kind: f.kind, n: num(f.tok) }) })),
        verify: [`wc -c ${files.map((f) => f.path).join(' ')}`],
        notes: PROMPT_NOTES[lang].compress,
      }),
    });
  }

  // B. A large memory index.
  {
    const file = '~/.claude/projects/-Users-me-code-aurora-web/memory/MEMORY.md';
    const tok = 1600;
    const sessions = Math.round(30 * SESSIONS_PER_DAY * 0.35);
    out.push({
      id: 'big-memory:demo',
      severity: 'info',
      title: t('mock.rec.ctx.mem.title', { n: num(tok) }),
      detail: t('mock.rec.ctx.mem.detail'),
      evidence: [t('mock.rec.ctx.mem.evidence', { file, n: num(tok), s: sessions })],
      pages: ['startup'],
      scope: 'history',
      saving: { ...share(tok * 0.35, 0), perSubagent: undefined },
      targets: [{ key: file, label: file, kind: 'file', tokensPerSession: tok, note: 'aurora-web' }],
      prompts: buildPrompts({
        lang,
        summary: t('mock.rec.ctx.mem.summary'),
        items: [consolidateMemoryItem(lang, { path: file, why: t('mock.rec.ctx.mem.why', { n: num(tok) }) })],
        verify: [`wc -c ${file}`],
        notes: PROMPT_NOTES[lang].memory,
      }),
    });
  }

  // C. A settings hook that prints context at every start.
  {
    const per = 720;
    out.push({
      id: 'hook-event-context:demo',
      severity: 'warn',
      title: t('mock.rec.ctx.hook.title', { n: num(per) }),
      detail: t('mock.rec.ctx.hook.detail'),
      evidence: [t('mock.rec.ctx.hook.evidence', { n: num(per), s: 30 * SESSIONS_PER_DAY })],
      pages: ['startup'],
      scope: 'history',
      saving: projection(per),
      targets: [{ key: 'hook:event:SessionStart', label: 'SessionStart', kind: 'hook', tokensPerSession: per }],
      prompts: buildPrompts({
        lang,
        summary: t('mock.rec.ctx.hook.summary'),
        items: [reviewItem({ name: 'SessionStart', action: t('mock.rec.ctx.hook.action'), why: t('mock.rec.ctx.hook.why', { n: num(per) }) })],
      }),
    });
  }

  // D. The skill listing: handled on the Skills & plugins tab.
  const rows = at.startupContext;
  const listing = rows.find((r) => r.key === 'skills');
  if (listing) {
    const per = Number(listing.extra?.perSession ?? 0);
    const perSub = Number(listing.extra?.perSubagent ?? 0);
    const cards = skillCards.filter((c) => /^(unused-plugins|unused-skills|unused-own-skills):/.test(c.id) && c.saving?.basis === 'projection');
    const act = cards.reduce((n, c) => n + (c.saving?.perSession ?? 0), 0);
    out.push({
      id: 'startup-skill-listing',
      severity: 'warn',
      title: t('mock.rec.ctx.listing.title', { n: num(per), sub: num(perSub) }),
      detail: t('mock.rec.ctx.listing.detail', { total: num(listing.total) }),
      evidence: [
        ...(act ? [t('mock.rec.ctx.listing.actionable', { n: num(act) })] : []),
        t('mock.rec.ctx.listing.evidence', { p: 'superpowers', n: num(listing.total * 0.34) }),
        t('mock.rec.ctx.listing.evidence', { p: 'ui-ux-pro-max', n: num(listing.total * 0.21) }),
        t('mock.rec.ctx.listing.evidence', { p: 'acme-tools', n: num(listing.total * 0.14) }),
      ],
      fix: t('mock.rec.ctx.listing.fix'),
      pages: ['startup'],
      scope: 'range',
      saving: act
        ? {
          perSession: act,
          perSubagent: cards.reduce((n, c) => n + (c.saving?.perSubagent ?? 0), 0) || undefined,
          period: cards.reduce((n, c) => n + (c.saving?.period ?? 0), 0),
          days: 30,
          basis: 'projection',
          pctStartup: act / STARTUP_PER_SESSION,
        }
        : undefined,
      seeAlso: 'skills',
    });
  }

  // E. The startup context as a whole; subagents pay it again.
  {
    const perMain = rows.reduce((n, r) => n + Number(r.extra?.perSession ?? 0), 0);
    const perSub = rows.reduce((n, r) => n + Number(r.extra?.perSubagent ?? 0), 0);
    const total = rows.reduce((n, r) => n + r.total, 0);
    const subs = Math.round(days(range) * SUBAGENTS_PER_DAY);
    const subTotal = subs * perSub;
    const top = [...rows].sort((a, b) => Number(b.extra?.perSession ?? 0) - Number(a.extra?.perSession ?? 0)).slice(0, 5);
    out.push({
      id: 'startup-total',
      severity: 'warn',
      title: t('mock.rec.ctx.total.title', { n: num(subs), total: num(subTotal) }),
      detail: t('mock.rec.ctx.total.detail', { total: num(total) }),
      evidence: [
        t('mock.rec.ctx.total.plain', { main: num(perMain), sub: num(perSub) }),
        t('mock.rec.ctx.total.subs', { n: num(subs), per: num(perSub), total: num(subTotal) }),
        ...top.map((r) => t('mock.rec.ctx.total.row', { label: r.label, per: num(Number(r.extra?.perSession ?? 0)), sub: num(Number(r.extra?.perSubagent ?? 0)) })),
      ],
      fix: t('mock.rec.ctx.total.fix'),
      pages: ['startup', 'overview'],
      scope: 'range',
    });
  }

  for (const r of out) if (r.id !== 'startup-skill-listing') r.estSavingTokens = r.saving?.period;
  return out;
}
