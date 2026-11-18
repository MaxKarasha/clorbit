// Recommendations for the Skills & plugins tab: per-skill listing sizes, last use across the whole history
// (archived summaries included), savings math, duplicates, the page filter, and older summaries after a version bump.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Insight, InsightPage } from '../../shared/api.ts';
import { ClorbitDb } from '../db';
import { overview } from '../analytics';
import { insights } from '../insights';
import { costOf, costWindow, DAY_MS, stableId, type RecommendEnv } from '../recommend';
import { scanText } from '../scanner';
import { SettingsStore } from '../settings';
import { Store } from '../store';
import { SUMMARY_VERSION, type FileSummary } from '../types';
import { estTokens, localDate } from '../util';
import { OWN_SKILLS } from '../i18n';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-recommend-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const NOW = new Date(2026, 10, 18, 12).getTime();
const ago = (d: number, h = 10) => new Date(NOW - d * DAY_MS).setHours(h, 0, 0, 0);
const opts = { knownPlugins: ['hooky', 'alpha', 'beta', 'gamma', 'fresh'] };

const LISTING = [
  'The following skills are available:',
  '- alpha:a1: first alpha skill',
  '- alpha:a2: second alpha skill',
  '  wrapped onto a second line',
  '- alpha:a3: third alpha skill',
  '- alpha:a4: fourth alpha skill',
  '- beta:b1: beta one',
  '- beta:b2: beta two, longer description for beta',
  '- gamma:g1: gamma',
  '- hooky:h1: hooky skill',
  '- fresh:f1: brand new',
  '- mine-used: my skill that I use',
  '- mine-old: my skill that I never use',
  '- builtin-x: a built-in skill (no folder)',
  '- a1: my own copy of a1',
].join('\n');
const lineChars = (re: RegExp) => LISTING.split('\n').filter((l) => re.test(l)).reduce((n, l) => n + l.length + 1, 0);

let seq = 0;
interface Use { skill?: string; load?: string; tool?: string }
function file(o: { sid: string; agent?: string; ts: number; cwd: string; listing?: string; hook?: number; uses?: Use[] }): FileSummary {
  const iso = new Date(o.ts).toISOString();
  const lines: string[] = [];
  if (o.listing) lines.push(JSON.stringify({ type: 'attachment', attachment: { type: 'skill_listing', content: o.listing }, timestamp: iso }));
  if (o.hook) lines.push(JSON.stringify({ type: 'attachment', attachment: { type: 'hook_additional_context', hookName: 'SessionStart', content: ['hooky hooky ' + 'x'.repeat(o.hook)] }, timestamp: iso }));
  const uses = o.uses?.length ? o.uses : [{}];
  for (const u of uses) {
    const blocks: unknown[] = [{ type: 'text', text: 'ok' }];
    if (u.load) blocks.push({ type: 'tool_use', id: `t${seq++}`, name: 'Skill', input: { skill: u.load } });
    if (u.tool) blocks.push({ type: 'tool_use', id: `t${seq++}`, name: u.tool, input: {} });
    const rec: Record<string, unknown> = {
      type: 'assistant', isSidechain: false, requestId: `r${seq++}`, timestamp: iso, sessionId: o.sid, cwd: o.cwd,
      message: { model: 'claude-opus-5-5', id: `m${seq++}`, content: blocks, stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } },
    };
    if (u.skill) rec.attributionSkill = u.skill;
    lines.push(JSON.stringify(rec));
  }
  const p = o.agent ? `/p/-work/${o.sid}/subagents/agent-${o.agent}.jsonl` : `/p/-work/${o.sid}.jsonl`;
  return scanText(p, { sessionId: o.sid, agentId: o.agent ?? null, projectDir: '-work' }, lines.join('\n'), opts);
}

const sid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const store = new Store(path.join(tmp, 'none'), null, opts);
const put = (s: FileSummary) => (store as any).put(s);

// An archived session from 60 days ago, written by an older build (no per-skill sizes): beta was used then.
const archived = file({ sid: sid(900), ts: ago(60), cwd: '/work/proj-a', listing: LISTING.replace(/\n- (fresh|gamma).*$/gm, ''), uses: [{ load: 'beta:b1' }] });
delete archived.skillsByName;
archived.v = 5;
put(archived);
store.missing.set(archived.path, NOW - 20 * DAY_MS);
// gamma first appeared 40 days ago and was never used.
put(file({ sid: sid(901), ts: ago(40), cwd: '/work/proj-b', listing: LISTING.replace(/\n- fresh.*$/m, '') }));
// The last 10 days: sessions in two projects, hooky's hook in every one, hooky used in proj-a only.
for (let d = 1; d <= 10; d++) {
  const a = d % 2 === 0;
  const listing = d <= 5 ? LISTING : LISTING.replace(/\n- fresh.*$/m, '');
  const uses: Use[] = [{ load: 'alpha:a1' }];
  if (a) uses.push({ skill: 'hooky:h1' });
  if (d === 1) uses.push({ load: 'mine-used' });
  put(file({ sid: sid(d), ts: ago(d), cwd: a ? '/work/proj-a' : '/work/proj-b', listing, hook: 4000, uses }));
  if (d <= 4) put(file({ sid: sid(d), agent: `sub${d}`, ts: ago(d, 11), cwd: a ? '/work/proj-a' : '/work/proj-b', listing }));
}

const env = (over: Partial<RecommendEnv> = {}): Partial<RecommendEnv> => ({
  now: NOW,
  unusedDays: 30,
  enabledPlugins: { 'alpha@mkt': true, 'beta@mkt': true, 'gamma@mkt': true, 'hooky@mkt': true, 'fresh@mkt': true, 'off@mkt': false },
  settingsFile: '~/.claude/settings.json',
  skillsDir: '~/.claude/skills',
  ownSkillExists: (n) => ['mine-used', 'mine-old', 'a1'].includes(n),
  ...over,
});
const range = { from: localDate(ago(29)), to: localDate(NOW) };
const run = (over: Partial<RecommendEnv> = {}, page?: InsightPage) =>
  insights(store, range, null, 'en', { env: env(over), page });
const byRule = (list: Insight[], rule: string) => list.find((i) => i.id.startsWith(rule));

describe('scanner: per-skill listing size', () => {
  it('records chars per skill; a wrapped line belongs to the skill above; headers stay with own skills', () => {
    const s = file({ sid: sid(500), ts: ago(1), cwd: '/w', listing: LISTING });
    expect(s.v).toBe(SUMMARY_VERSION);
    expect(s.skillsByName!['alpha:a2']).toBe(lineChars(/alpha:a2|wrapped onto/));
    expect(s.skillsByName!['mine-old']).toBe(lineChars(/mine-old/));
    expect(s.skillsByName!['a1']).toBe(lineChars(/^- a1:/));
    expect(s.skillsByPlugin.alpha).toBe(lineChars(/alpha:|wrapped onto/));
    expect(s.skillsByPlugin[OWN_SKILLS]).toBe(lineChars(/^The following|^- (mine|builtin|a1:)/));
    // Per-plugin and per-skill sums agree.
    const alphaSkills = Object.entries(s.skillsByName!).filter(([k]) => k.startsWith('alpha:')).reduce((n, [, c]) => n + c, 0);
    expect(alphaSkills).toBe(s.skillsByPlugin.alpha);
  });
});

describe('unused plugins (whole history)', () => {
  it('flags plugins unused for N days by their last use across all summaries, archived ones included', () => {
    const card = byRule(run(), 'unused-plugins:')!;
    expect(card).toBeDefined();
    expect(card.scope).toBe('history');
    expect(card.pages).toEqual(expect.arrayContaining(['skills']));
    expect(card.targets!.map((t) => t.key).sort()).toEqual(['beta@mkt', 'gamma@mkt']);
    const beta = card.targets!.find((t) => t.key === 'beta@mkt')!;
    expect(beta.lastUsed).toBeGreaterThanOrEqual(ago(60, 0));
    expect(beta.lastUsed).toBeLessThan(ago(59, 0));
    expect(card.targets!.find((t) => t.key === 'gamma@mkt')!.lastUsed).toBeNull();
    expect(card.title).toContain('2 enabled plugins');
    expect(card.id).toBe(stableId('unused-plugins', ['beta@mkt', 'gamma@mkt']));
  });

  it('respects the threshold and leaves plugins that are too new alone', () => {
    // 45 days: beta (60 d) stays, gamma (first seen 40 d ago, never used) is too new.
    const c45 = byRule(run({ unusedDays: 45 }), 'unused-plugins:')!;
    expect(c45.targets!.map((t) => t.key)).toEqual(['beta@mkt']);
    expect(c45.title).toMatch(/^Plugin beta is enabled but last used 60 days ago/);
    expect(byRule(run({ unusedDays: 90 }), 'unused-plugins:')).toBeUndefined();
    // fresh (first seen 5 days ago) and disabled plugins never show up.
    const keys = run({ unusedDays: 7 }).flatMap((i) => i.targets ?? []).map((t) => t.key);
    expect(keys).not.toContain('fresh@mkt');
    expect(keys).not.toContain('off@mkt');
  });

  it('computes savings from measured listing sizes and observed sessions and subagents', () => {
    const card = byRule(run({ unusedDays: 45 }), 'unused-plugins:')!;
    const per = estTokens(lineChars(/^- beta:/));
    // Every main session and subagent in the last 30 days carries the same listing.
    const w = costWindow(store, NOW);
    expect(w.mains.length).toBe(10);
    expect(w.subs.length).toBe(4);
    const span = (NOW - ago(10)) / DAY_MS;
    expect(card.saving).toMatchObject({ perSession: per, perSubagent: per, days: 30, basis: 'projection' });
    expect(card.saving!.period).toBe(Math.round((14 * per * 30) / span));
    expect(card.estSavingTokens).toBe(card.saving!.period);
    expect(card.saving!.pctStartup).toBeCloseTo(per / w.avgStartup, 5);
    expect(card.prompts!.all).toContain('claude plugin disable beta@mkt --scope user');
  });

  it('costOf: averages over files that had the context, scales a short history to 30 days', () => {
    const w = { mains: [{ startup: { x: 1 } }, { startup: { x: 1 } }] as unknown as FileSummary[], subs: [] as FileSummary[], spanDays: 10, avgStartup: 100 };
    const c = costOf(w, () => 360);
    expect(c).toMatchObject({ perSession: 100, period: 600, days: 30, basis: 'projection', pctStartup: 1 });
    expect(c.perSubagent).toBeUndefined();
    expect(costOf(w, () => 360, 'range')).toMatchObject({ period: 200, days: 10, basis: 'range' });
  });
});

describe('hook context vs. use (selected range)', () => {
  it('suggests disabling globally and enabling where it is used', () => {
    const card = run().find((i) => i.id === 'hook-context:hooky')!;
    expect(card).toBeDefined();
    expect(card.scope).toBe('range');
    expect(card.saving!.basis).toBe('range');
    const hookTok = estTokens('hooky hooky '.length + 4000);
    expect(card.saving!.perSession).toBe(hookTok);
    // Only proj-b sessions (odd days: 5 of them) would lose the block.
    expect(card.saving!.period).toBe(5 * hookTok);
    expect(card.evidence.join('\n')).toContain('5 of 10');
    expect(card.prompts!.all).toContain('claude plugin disable hooky@mkt --scope user');
    expect(card.prompts!.all).toContain('cd /work/proj-a && claude plugin enable hooky@mkt --scope local');
    expect(card.prompts!.all).not.toContain('proj-b &&');
  });
});

describe('unused skills', () => {
  it('a plugin most of whose skills are unused: one card, the whole plugin', () => {
    const card = byRule(run(), 'unused-skills:alpha:')!;
    expect(card.targets!.map((t) => t.key).sort()).toEqual(['alpha:a2', 'alpha:a3', 'alpha:a4']);
    expect(card.targets!.find((t) => t.key === 'alpha:a2')!.tokensPerSession).toBe(estTokens(lineChars(/alpha:a2|wrapped onto/)));
    expect(card.evidence[0]).toContain('a1');
    expect(card.prompts!.ask).toContain('claude plugin disable alpha@mkt --scope user');
    // Plugins already flagged as unused are not repeated here.
    expect(run().some((i) => i.id.startsWith('unused-skills:beta:'))).toBe(false);
  });

  it('own skills: only folders that exist, moved rather than deleted', () => {
    const card = byRule(run(), 'unused-own-skills:')!;
    expect(card.targets!.map((t) => t.key)).toEqual(['mine-old']); // builtin-x has no folder; a1 is a duplicate
    expect(card.prompts!.all).toContain('mkdir -p ~/.claude/skills-disabled && mv ~/.claude/skills/mine-old ~/.claude/skills-disabled/mine-old');
    expect(card.prompts!.all).not.toMatch(/\brm\b/);
  });

  it('duplicates: the own copy next to a used plugin skill', () => {
    const card = byRule(run(), 'duplicate-skills:')!;
    expect(card.targets!.map((t) => t.key)).toEqual(['a1']);
    expect(card.evidence[0]).toMatch(/^a1: /);
    expect(card.prompts!.all).toContain('mv ~/.claude/skills/a1 ~/.claude/skills-disabled/a1');
  });
});

describe('page filter', () => {
  it('returns only the cards of the asked tab', () => {
    const skills = run({}, 'skills');
    expect(skills.length).toBeGreaterThanOrEqual(4);
    expect(skills.every((i) => i.pages?.includes('skills'))).toBe(true);
    const mcp = run({}, 'mcp');
    expect(mcp.some((i) => i.id.startsWith('unused-plugins:'))).toBe(false);
    // Every card says which tabs it belongs to.
    expect(run().every((i) => Array.isArray(i.pages))).toBe(true);
  });

  it('Ukrainian prompts and wording', () => {
    const card = byRule(insights(store, range, null, 'uk', { env: env() }), 'unused-plugins:')!;
    expect(card.title).toContain('плагіни');
    expect(card.prompts!.ask).toContain('AskUserQuestion');
    expect(card.prompts!.ask).toContain('claude plugin disable gamma@mkt --scope user');
  });
});

describe('older summaries after a version bump', () => {
  it('loads archived rows of the previous version as they are and re-parses the ones still on disk', async () => {
    const projectsDir = path.join(tmp, 'projects-bump');
    const live = path.join(projectsDir, '-work', `${sid(1)}.jsonl`);
    fs.mkdirSync(path.dirname(live), { recursive: true });
    const text = [
      JSON.stringify({ type: 'attachment', attachment: { type: 'skill_listing', content: '- alpha:a1: x' }, timestamp: new Date(ago(3)).toISOString() }),
      JSON.stringify({ type: 'assistant', requestId: 'r1', timestamp: new Date(ago(3)).toISOString(), sessionId: sid(1), cwd: '/work', message: { model: 'm', id: 'm1', content: [], stop_reason: 'end_turn', usage: { input_tokens: 5, output_tokens: 5 } } }),
    ].join('\n') + '\n';
    fs.writeFileSync(live, text);
    const st = fs.statSync(live);
    const oldLive = { ...scanText(live, { sessionId: sid(1), agentId: null, projectDir: '-work' }, text, opts), v: 5, size: st.size, mtimeMs: st.mtimeMs };
    delete oldLive.skillsByName;
    const oldArchived = { ...archived, path: path.join(projectsDir, '-work', `${sid(900)}.jsonl`) };
    const dbFile = path.join(tmp, 'bump', 'clorbit.db');
    const db = ClorbitDb.open(dbFile);
    db.upsertSummaries([{ summary: oldLive, missingSince: null }, { summary: oldArchived, missingSince: NOW - DAY_MS }]);
    const s = new Store(projectsDir, db, opts);
    s.loadCache();
    expect(s.files.size).toBe(2);
    await s.coldScan(0);
    const now = s.files.get(live)!;
    expect(now.v).toBe(SUMMARY_VERSION);
    expect(now.skillsByName).toEqual({ 'alpha:a1': '- alpha:a1: x'.length + 1 });
    const arch = s.files.get(oldArchived.path)!;
    expect(arch.v).toBe(5);
    expect(s.isMissing(oldArchived.path)).toBe(true);
    const day = localDate(ago(60));
    expect(overview(s, { from: day, to: day }).totals.total).toBe(2);
    db.close();
  });
});

describe('hidden recommendations persist', () => {
  it('saves the dismissed ids and the threshold with the settings', () => {
    const dbFile = path.join(tmp, 'settings', 'clorbit.db');
    const a = new SettingsStore(ClorbitDb.open(dbFile));
    a.update({ recommendations: { unusedDays: 45, dismissed: ['unused-plugins:1a2b3c4d', 'hook-context:hooky', 'bad id with spaces'] } });
    const b = new SettingsStore(ClorbitDb.open(dbFile));
    expect(b.get().recommendations).toEqual({ unusedDays: 45, dismissed: ['unused-plugins:1a2b3c4d', 'hook-context:hooky'] });
    expect(b.update({ recommendations: { dismissed: ['hook-context:hooky'] } }).recommendations.dismissed).toEqual(['hook-context:hooky']);
  });
});
