// Demo recommendations for the "Skills & plugins" tab. Same shape and prompt builder as the server's rules
// (server/recommend-skills.ts); every plugin, skill and project here is invented. Deterministic for a given
// range, threshold and day.
import type { Insight, InsightTarget, Range } from '@shared/api';
import { buildPrompts, disablePluginItem, enablePluginInProjectItem, moveSkillItem, reviewItem } from '@shared/prompts';
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
