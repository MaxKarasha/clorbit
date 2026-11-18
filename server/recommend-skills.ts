// Recommendations for the "Skills & plugins" tab:
//  A. enabled plugins unused for N+ days (whole history) — their skill listing, hook block and MCP instructions;
//  B. plugins whose SessionStart hook injects context into every session but which are used in few of them (range);
//  C. plugins most of whose skills are unused, and own skills unused for N+ days (whole history);
//  D. the same skill name listed more than once (several plugins, or an own skill next to a plugin's).
// One card per issue: a plugin covered by A is left out of B, C and D.
import type { Insight, InsightTarget, Range } from '../shared/api.ts';
import { buildPrompts, disablePluginItem, enablePluginInProjectItem, moveSkillItem, reviewItem, type PromptItem } from '../shared/prompts';
import { Ctx } from './analytics';
import { hookPluginKey, OWN_SKILLS, type Lang } from './i18n';
import { insightText } from './insights-text';
import {
  addSavings, costOf, costWindow, daysBetween, homeDisplay, isPluginMcp, pluginLastUse, publicSaving, rangeWindow,
  severityOf, skillLastUse, stableId, unusedFor, usageIndex, type RecommendEnv,
} from './recommend';
import type { Store } from './store';
import type { FileSummary } from './types';
import { estTokens, localDate } from './util';

/** A hook block smaller than this per session is not worth a card. */
const HOOK_MIN_TOKENS = 300;
/** Rule B needs at least this share of the hook's cost to be avoidable. */
const HOOK_MIN_AVOIDABLE = 0.2;
/** At most this many "enable it in project …" steps in a prompt. */
const MAX_PROJECTS = 6;

const mcpChars = (s: FileSummary, plugin: string) => {
  let n = 0;
  for (const [k, c] of Object.entries(s.mcpBlocks)) if (isPluginMcp(k, plugin)) n += c;
  return n;
};

/** Was the plugin used in this day bucket (attributed turns, its skills, its MCP servers or tools)? */
function usedInBucket(b: FileSummary['days'][string], plugin: string): boolean {
  if (b.plugins[plugin]) return true;
  const pre = plugin + ':';
  for (const k of Object.keys(b.skills)) if (k.startsWith(pre)) return true;
  for (const k of Object.keys(b.skillLoads)) if (k.startsWith(pre)) return true;
  for (const k of Object.keys(b.mcpServers)) if (isPluginMcp(k, plugin)) return true;
  const tp = `mcp__plugin_${plugin}_`;
  for (const [k, a] of Object.entries(b.tools)) if (k.startsWith(tp) && a.calls > 0) return true;
  return false;
}

export function skillRecommendations(store: Store, range: Range, lang: Lang, env: RecommendEnv): Insight[] {
  const T = insightText(lang).rec;
  const idx = usageIndex(store);
  const w = costWindow(store, env.now);
  const out: Insight[] = [];
  const keyOf = new Map<string, string>(); // plugin name → 'name@marketplace' (enabled in the user settings)
  for (const [k, on] of Object.entries(env.enabledPlugins)) if (on) keyOf.set(k.split('@')[0], k);
  const lastText = (last: number | null, seen: number | null | undefined) =>
    last ? T.lastUsed(daysBetween(last, env.now)) : T.never(seen ? localDate(seen) : null);
  const days = env.unusedDays;

  // ---------- A. Plugins unused for N+ days ----------
  const unusedPlugins = new Set<string>();
  const pluginCost = (name: string) =>
    costOf(w, (s) => (s.skillsByPlugin[name] ?? 0) + (s.startup[hookPluginKey(name)] ?? 0) + mcpChars(s, name));
  {
    const rows: { target: InsightTarget; saving: ReturnType<typeof pluginCost>; ev: string; item: PromptItem }[] = [];
    for (const [name, key] of keyOf) {
      const cost = pluginCost(name);
      if (!cost.perSession && !cost.perSubagent) continue; // nothing measurable to save
      const last = pluginLastUse(idx, name);
      const seen = idx.pluginSeen.get(name) ?? null;
      if (!unusedFor(last, seen, env)) continue;
      unusedPlugins.add(name);
      const lt = lastText(last, seen);
      const parts = T.parts({
        skills: costOf(w, (s) => s.skillsByPlugin[name] ?? 0).perSession ?? 0,
        hook: costOf(w, (s) => s.startup[hookPluginKey(name)] ?? 0).perSession ?? 0,
        mcp: costOf(w, (s) => mcpChars(s, name)).perSession ?? 0,
      });
      rows.push({
        target: { key, label: name, kind: 'plugin', lastUsed: last, tokensPerSession: cost.perSession },
        saving: cost,
        ev: T.unusedPlugins.evidence(name, lt, cost.perSession ?? 0, parts),
        item: disablePluginItem(lang, { key, why: T.unusedPlugins.why(lt, cost.perSession ?? 0), settingsFile: env.settingsFile }),
      });
    }
    if (rows.length) {
      rows.sort((a, b) => (b.saving.period ?? 0) - (a.saving.period ?? 0));
      const saving = addSavings(rows.map((r) => r.saving));
      const one = rows.length === 1 ? rows[0] : null;
      out.push({
        id: stableId('unused-plugins', rows.map((r) => r.target.key)),
        severity: severityOf(saving),
        title: one ? T.unusedPlugins.titleOne(one.target.label, lastText(one.target.lastUsed ?? null, idx.pluginSeen.get(one.target.label))) : T.unusedPlugins.titleMany(rows.length, days),
        detail: T.unusedPlugins.detail(days),
        evidence: rows.map((r) => r.ev),
        estSavingTokens: saving.period,
        pages: ['skills', 'startup'],
        scope: 'history',
        saving,
        targets: rows.map((r) => r.target),
        prompts: buildPrompts({ lang, summary: T.unusedPlugins.summary(rows.length, days), items: rows.map((r) => r.item), verify: ['claude plugin list'] }),
      });
    }
  }

  // The skill listing of the last 30 days (B, C and D use it).
  const listed = new Set<string>();
  for (const s of w.mains) for (const k of Object.keys(s.skillsByName ?? {})) listed.add(k);
  for (const s of w.subs) for (const k of Object.keys(s.skillsByName ?? {})) listed.add(k);
  const skillCost = new Map<string, number>();
  const perSkill = (k: string) => {
    let v = skillCost.get(k);
    if (v === undefined) skillCost.set(k, (v = costOf(w, (s) => s.skillsByName?.[k] ?? 0).perSession ?? 0));
    return v;
  };
  const skillUnused = (k: string) => unusedFor(skillLastUse(idx, k), idx.skillSeen.get(k), env);
  // Same name listed more than once (D); their extra copies are not also reported as unused own skills.
  const groups = new Map<string, string[]>();
  for (const k of listed) {
    const i = k.indexOf(':');
    if (i >= 0 && unusedPlugins.has(k.slice(0, i))) continue;
    const name = i < 0 ? k : k.slice(i + 1);
    groups.set(name, [...(groups.get(name) ?? []), k]);
  }
  const dup = [...groups.entries()].filter(([, ks]) => ks.length > 1).sort((a, b) => a[0].localeCompare(b[0]));
  const inDup = new Set(dup.flatMap(([, ks]) => ks));
  const byPlugin = new Map<string, string[]>();
  const own: string[] = [];
  for (const k of [...listed].sort()) {
    const i = k.indexOf(':');
    if (i < 0) own.push(k);
    else byPlugin.set(k.slice(0, i), [...(byPlugin.get(k.slice(0, i)) ?? []), k]);
  }

  // ---------- B. A SessionStart hook in every session, the plugin used in few ----------
  const hookCards = new Set<string>(); // C leaves these plugins to B: one card per plugin and issue
  {
    const rw = rangeWindow(store, range);
    const ctx = new Ctx(store);
    const hookPlugins = new Set<string>();
    for (const s of rw.mains) for (const k of Object.keys(s.startup)) if (k.startsWith('hook:plugin:')) hookPlugins.add(k.slice('hook:plugin:'.length));
    const cwdOf = new Map<string, string>(); // project → a cwd of it
    for (const name of [...hookPlugins].sort()) {
      if (unusedPlugins.has(name)) continue;
      const hk = hookPluginKey(name);
      const withHook = rw.mains.filter((s) => (s.startup[hk] ?? 0) > 0);
      if (!withHook.length) continue;
      const per = Math.round(withHook.reduce((n, s) => n + estTokens(s.startup[hk]), 0) / withHook.length);
      if (per < HOOK_MIN_TOKENS) continue;
      const usedSids = new Set<string>();
      const usedProjects = new Set<string>();
      for (const { s, b } of ctx.days(range)) {
        if (!usedInBucket(b, name)) continue;
        usedSids.add(s.sessionId);
        const p = ctx.project(s);
        usedProjects.add(p);
        const main = store.mainOf(s.sessionId);
        if (main?.cwd && !cwdOf.has(p)) cwdOf.set(p, main.cwd);
      }
      const total = costOf(rw, (s) => s.startup[hk] ?? 0, 'range');
      const avoid = costOf(rw, (s) => (usedProjects.has(ctx.project(s)) ? 0 : s.startup[hk] ?? 0), 'range');
      if (!total.total || avoid.total < total.total * HOOK_MIN_AVOIDABLE) continue;
      const usedIn = withHook.filter((s) => usedSids.has(s.sessionId)).length;
      hookCards.add(name);
      const pluginSkills = byPlugin.get(name) ?? [];
      const unusedSkills = pluginSkills.filter(skillUnused).length;
      const projects = [...usedProjects].sort();
      const saving = publicSaving({ ...avoid, perSession: per, pctStartup: rw.avgStartup ? Math.min(1, per / rw.avgStartup) : undefined });
      const key = keyOf.get(name);
      const items: PromptItem[] = key
        ? [
          disablePluginItem(lang, { key, why: T.hookContext.why(per, usedIn, withHook.length), settingsFile: env.settingsFile }),
          ...projects.filter((p) => cwdOf.has(p)).slice(0, MAX_PROJECTS)
            .map((p) => enablePluginInProjectItem(lang, { key, dir: homeDisplay(cwdOf.get(p)!), why: T.hookContext.whyEnable(p) })),
        ]
        : [];
      out.push({
        id: `hook-context:${name}`,
        severity: severityOf(saving),
        title: T.hookContext.title(name, per),
        detail: T.hookContext.detail(name, usedIn, withHook.length, projects),
        evidence: [
          T.hookContext.perSession(per),
          T.hookContext.sessions(usedIn, withHook.length),
          ...(unusedSkills ? [T.hookContext.skillsUnused(unusedSkills, pluginSkills.length, days)] : []),
        ],
        fix: key ? undefined : T.hookContext.fix(name, `${name}@…`),
        estSavingTokens: saving.period,
        pages: ['skills', 'startup'],
        scope: 'range',
        saving,
        targets: [{ key: key ?? name, label: name, kind: 'plugin', lastUsed: pluginLastUse(idx, name), tokensPerSession: per }],
        prompts: items.length ? buildPrompts({ lang, summary: T.hookContext.summary(name, per), items, verify: ['claude plugin list'] }) : undefined,
      });
    }
  }

  // ---------- C. Skills unused for N+ days ----------
  for (const [plugin, keys] of byPlugin) {
    if (unusedPlugins.has(plugin) || hookCards.has(plugin) || plugin === OWN_SKILLS) continue;
    const key = keyOf.get(plugin);
    if (!key) continue;
    const unused = keys.filter(skillUnused);
    if (unused.length < 2 || unused.length * 2 <= keys.length) continue;
    const used = keys.filter((k) => !unused.includes(k));
    const short = (k: string) => k.slice(plugin.length + 1);
    const usedText = used.map((k) => `${short(k)} (${lastText(skillLastUse(idx, k), idx.skillSeen.get(k))})`).join(', ');
    const cost = pluginCost(plugin);
    const saving = publicSaving(cost);
    const unusedTok = unused.reduce((n, k) => n + perSkill(k), 0);
    const listTok = keys.reduce((n, k) => n + perSkill(k), 0);
    const mcpLast = (() => {
      let last = 0;
      for (const [k, ts] of idx.mcp) if (isPluginMcp(k, plugin) && ts > last) last = ts;
      for (const [k, ts] of idx.tool) if (k.startsWith(`mcp__plugin_${plugin}_`) && ts > last) last = ts;
      return last || null;
    })();
    const targets: InsightTarget[] = unused
      .map((k) => ({ key: k, label: short(k), kind: 'skill' as const, lastUsed: skillLastUse(idx, k), tokensPerSession: perSkill(k) }))
      .sort((a, b) => (b.tokensPerSession ?? 0) - (a.tokensPerSession ?? 0));
    out.push({
      id: stableId(`unused-skills:${plugin}`, unused),
      severity: severityOf(saving),
      title: T.unusedSkills.title(plugin, unused.length, keys.length, days),
      detail: T.unusedSkills.detail(plugin, unusedTok, listTok),
      evidence: [
        used.length ? T.unusedSkills.stillUsed(usedText) : T.unusedSkills.noneUsed,
        ...(mcpLast ? [T.unusedSkills.mcpUsed(lastText(mcpLast, null))] : []),
      ],
      estSavingTokens: saving.period,
      pages: ['skills'],
      scope: 'history',
      saving,
      targets,
      prompts: buildPrompts({
        lang,
        summary: T.unusedSkills.summary(plugin, unused.length, keys.length, days),
        items: [disablePluginItem(lang, { key, why: T.unusedSkills.why(unused.length, keys.length, usedText), settingsFile: env.settingsFile })],
        verify: ['claude plugin list'],
      }),
    });
  }
  {
    const unusedOwn = own.filter((k) => !inDup.has(k) && skillUnused(k) && env.ownSkillExists(k));
    if (unusedOwn.length) {
      const rows = unusedOwn.map((k) => {
        const last = skillLastUse(idx, k);
        const lt = lastText(last, idx.skillSeen.get(k));
        return { k, last, lt, per: perSkill(k) };
      }).sort((a, b) => b.per - a.per);
      const set = new Set(unusedOwn);
      const saving = publicSaving(costOf(w, (s) => {
        let n = 0;
        for (const [k, c] of Object.entries(s.skillsByName ?? {})) if (set.has(k)) n += c;
        return n;
      }));
      out.push({
        id: stableId('unused-own-skills', unusedOwn),
        severity: severityOf(saving),
        title: T.unusedOwn.title(unusedOwn.length, days),
        detail: T.unusedOwn.detail(env.skillsDir),
        evidence: rows.map((r) => T.unusedOwn.evidence(r.k, r.lt, r.per)),
        estSavingTokens: saving.period,
        pages: ['skills'],
        scope: 'history',
        saving,
        targets: rows.map((r) => ({ key: r.k, label: r.k, kind: 'ownSkill' as const, lastUsed: r.last, tokensPerSession: r.per })),
        prompts: buildPrompts({
          lang,
          summary: T.unusedOwn.summary(unusedOwn.length, days),
          items: rows.map((r) => moveSkillItem(lang, { name: r.k, skillsDir: env.skillsDir, why: T.unusedOwn.why(r.lt, r.per) })),
          verify: [`ls ${env.skillsDir}`],
        }),
      });
    }
  }

  // ---------- D. The same skill name more than once ----------
  {
    if (dup.length) {
      const label = (k: string) => (k.includes(':') ? k.split(':')[0] : T.duplicates.own);
      const items: PromptItem[] = [];
      const targets: InsightTarget[] = [];
      const movable = new Set<string>();
      const evidence: string[] = [];
      for (const [name, ks] of dup) {
        // Keep the most recently used copy; with no use at all, keep the plugin's and question the own one.
        const ranked = [...ks].sort((a, b) => (skillLastUse(idx, b) ?? 0) - (skillLastUse(idx, a) ?? 0) || Number(!b.includes(':')) - Number(!a.includes(':')) || a.localeCompare(b));
        const keep = ranked[0];
        const keepLast = lastText(skillLastUse(idx, keep), idx.skillSeen.get(keep));
        evidence.push(T.duplicates.evidence(name, ks.map((k) => T.duplicates.copy(label(k), lastText(skillLastUse(idx, k), idx.skillSeen.get(k)))).join('; ')));
        for (const k of ranked.slice(1)) {
          const isOwn = !k.includes(':');
          targets.push({ key: k, label: `${name} · ${label(k)}`, kind: isOwn ? 'ownSkill' : 'skill', lastUsed: skillLastUse(idx, k), tokensPerSession: perSkill(k), note: `${label(keep)}: ${keepLast}` });
          if (isOwn && env.ownSkillExists(k)) {
            movable.add(k);
            items.push(moveSkillItem(lang, { name: k, skillsDir: env.skillsDir, why: T.duplicates.whyMove(label(keep), keepLast) }));
          } else {
            items.push(reviewItem({ name: k, action: T.duplicates.reviewAction(k, keep), why: T.duplicates.whyReview(isOwn ? label(keep) : label(k)) }));
          }
        }
      }
      const saving = publicSaving(costOf(w, (s) => {
        let n = 0;
        for (const k of movable) n += s.skillsByName?.[k] ?? 0;
        return n;
      }));
      out.push({
        id: stableId('duplicate-skills', dup.flatMap(([, ks]) => ks)),
        severity: saving.period ? severityOf(saving) : 'info',
        title: T.duplicates.title(dup.length),
        detail: T.duplicates.detail,
        evidence,
        estSavingTokens: saving.period || undefined,
        pages: ['skills'],
        scope: 'history',
        saving: saving.perSession ? saving : undefined,
        targets,
        prompts: buildPrompts({ lang, summary: T.duplicates.summary(dup.length), items }),
      });
    }
  }

  return out;
}
