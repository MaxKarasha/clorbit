// Recommendations for the "Startup context" tab:
//  A. large instruction files (your CLAUDE.md, project CLAUDE.md / CLAUDE.local.md, rules files): compress them;
//  B. a large auto-memory index (MEMORY.md): consolidate it;
//  C. hooks from your settings (not a recognized plugin's) that print context at every start: review them;
//  D. the skill listing — the Skills & plugins tab handles it, this card points there with what its cards would save;
//  E. the startup context as a whole, and what subagents pay for it again.
// Plugin hooks and unused plugins are cards of recommend-skills.ts (also shown here); they are not repeated.
import type { AttributionReport, Insight, InsightSaving, InsightTarget, Range } from '../shared/api.ts';
import { buildPrompts, compressInstructionsItem, consolidateMemoryItem, PROMPT_NOTES, reviewItem, shq } from '../shared/prompts';
import { skillGroupLabel, STARTUP, type Lang } from './i18n';
import { insightText } from './insights-text';
import { addSavings, costOf, costWindow, homeDisplay, publicSaving, rangeWindow, severityOf, stableId, type RecommendEnv } from './recommend';
import type { Store } from './store';
import type { FileSummary } from './types';
import { estTokens, projectOf } from './util';

/** A: an instruction file above this many tokens gets a card; B: the memory index above this. */
export const FILE_MIN_TOKENS = 2000;
export const MEMORY_MIN_TOKENS = 1000;
/** Expected cut from compressing / consolidating (an estimate, said so on the card). */
export const COMPRESS_RATIO = 0.4;
/** C: a hook block smaller than this per session is not worth a card. */
const HOOK_MIN_TOKENS = 300;
/** E: subagents are worth a separate title when they are at least this many and pay more than main sessions. */
const SUBS_MIN = 20;

export type FileKind = 'user' | 'project' | 'local' | 'rules' | 'memory' | 'managed';

/** Which instruction file this is, from Claude Code's memory type and the path. */
export function fileKind(p: string, type: string): FileKind {
  const t = type.toLowerCase();
  if (t === 'automem' || t === 'memory') return 'memory';
  if (t === 'managed') return 'managed';
  if (/[\\/]rules[\\/][^\\/]+\.md$/i.test(p)) return 'rules';
  if (t === 'local' || /CLAUDE\.local\.md$/i.test(p)) return 'local';
  if (t === 'user') return 'user';
  return 'project';
}

const scale = (s: InsightSaving, f: number): InsightSaving => {
  const r = (n?: number) => (n ? Math.round(n * f) : undefined);
  const out: InsightSaving = { ...s, perSession: r(s.perSession), perSubagent: r(s.perSubagent), period: r(s.period), pctStartup: s.pctStartup ? s.pctStartup * f : undefined };
  for (const k of Object.keys(out) as (keyof InsightSaving)[]) if (out[k] === undefined) delete out[k];
  return out;
};

export function startupRecommendations(
  store: Store, range: Range, lang: Lang, env: RecommendEnv, o: { attr: AttributionReport; skillCards: Insight[] },
): Insight[] {
  const TT = insightText(lang);
  const T = TT.rec;
  const w = costWindow(store, env.now);
  const out: Insight[] = [];
  const pct = Math.round(COMPRESS_RATIO * 100);

  // ---------- A + B. Instruction files and the memory index ----------
  {
    // The latest size of each file (the newest session that loaded it), and how many sessions loaded it.
    const files = new Map<string, { kind: FileKind; chars: number; at: number; sessions: number; project: string }>();
    for (const s of [...w.mains, ...w.subs]) {
      for (const [p, f] of Object.entries(s.memoryFiles ?? {})) {
        const kind = fileKind(p, f.type);
        const cur = files.get(p) ?? { kind, chars: f.chars, at: s.firstTs, sessions: 0, project: projectOf(s.cwd, s.projectDir) };
        if (s.firstTs >= cur.at) { cur.chars = f.chars; cur.at = s.firstTs; cur.kind = kind; cur.project = projectOf(s.cwd, s.projectDir); }
        if (s.agentId === null) cur.sessions++;
        files.set(p, cur);
      }
    }
    const big = (want: (k: FileKind) => boolean, min: number) =>
      [...files.entries()].filter(([, f]) => want(f.kind) && estTokens(f.chars) > min)
        .map(([p, f]) => ({ p, show: homeDisplay(p), ...f, tok: estTokens(f.chars), saving: scale(publicSaving(costOf(w, (s: FileSummary) => s.memoryFiles?.[p]?.chars ?? 0)), COMPRESS_RATIO) }))
        .sort((a, b) => b.tok - a.tok || a.p.localeCompare(b.p));
    const kindLabel = (k: FileKind) => T.fileKind[k] ?? T.fileKind.project;

    const instr = big((k) => k !== 'memory' && k !== 'managed', FILE_MIN_TOKENS);
    if (instr.length) {
      const saving = addSavings(instr.map((f) => f.saving));
      const one = instr.length === 1 ? instr[0] : null;
      out.push({
        id: stableId('big-instructions', instr.map((f) => f.p)),
        severity: severityOf(saving),
        title: one ? T.bigInstructions.titleOne(one.show, one.tok) : T.bigInstructions.titleMany(instr.length, FILE_MIN_TOKENS),
        detail: T.bigInstructions.detail(pct),
        evidence: instr.map((f) => T.bigInstructions.evidence(f.show, kindLabel(f.kind), f.tok, f.sessions)),
        estSavingTokens: saving.period || undefined,
        pages: ['startup'],
        scope: 'history',
        saving,
        targets: instr.map((f): InsightTarget => ({ key: f.p, label: f.show, kind: 'file', tokensPerSession: f.tok, note: kindLabel(f.kind) })),
        prompts: buildPrompts({
          lang,
          summary: T.bigInstructions.summary(instr.length),
          items: instr.map((f) => compressInstructionsItem(lang, { path: f.show, why: T.bigInstructions.why(kindLabel(f.kind), f.tok) })),
          verify: [`wc -c ${instr.map((f) => shq(f.show)).join(' ')}`],
          notes: PROMPT_NOTES[lang].compress,
        }),
      });
    }

    const mem = big((k) => k === 'memory', MEMORY_MIN_TOKENS);
    if (mem.length) {
      const saving = addSavings(mem.map((f) => f.saving));
      const tok = Math.max(...mem.map((f) => f.tok));
      out.push({
        id: stableId('big-memory', mem.map((f) => f.p)),
        severity: severityOf(saving),
        title: T.bigMemory.title(tok),
        detail: T.bigMemory.detail(pct),
        evidence: mem.map((f) => T.bigMemory.evidence(f.show, f.tok, f.sessions)),
        estSavingTokens: saving.period || undefined,
        pages: ['startup'],
        scope: 'history',
        saving,
        targets: mem.map((f): InsightTarget => ({ key: f.p, label: f.show, kind: 'file', tokensPerSession: f.tok, note: f.project })),
        prompts: buildPrompts({
          lang,
          summary: T.bigMemory.summary(mem.length),
          items: mem.map((f) => consolidateMemoryItem(lang, { path: f.show, why: T.bigMemory.why(f.tok) })),
          verify: [`wc -c ${mem.map((f) => shq(f.show)).join(' ')}`],
          notes: PROMPT_NOTES[lang].memory,
        }),
      });
    }
  }

  // ---------- C. Hooks from the settings that print context at every start ----------
  {
    const keys = new Set<string>();
    for (const s of [...w.mains, ...w.subs]) for (const k of Object.keys(s.startup)) if (k.startsWith('hook:event:')) keys.add(k);
    const rows: { key: string; name: string; per: number; sessions: number; saving: ReturnType<typeof costOf> }[] = [];
    for (const key of [...keys].sort()) {
      const withIt = w.mains.filter((s) => (s.startup[key] ?? 0) > 0);
      const subsWith = w.subs.filter((s) => (s.startup[key] ?? 0) > 0);
      const pool = withIt.length ? withIt : subsWith;
      if (!pool.length) continue;
      const per = Math.round(pool.reduce((n, s) => n + estTokens(s.startup[key]), 0) / pool.length);
      if (per < HOOK_MIN_TOKENS) continue;
      rows.push({ key, name: key.slice('hook:event:'.length) || T.hookEvent.unnamed, per, sessions: withIt.length, saving: costOf(w, (s) => s.startup[key] ?? 0) });
    }
    if (rows.length) {
      rows.sort((a, b) => b.per - a.per);
      const saving = publicSaving(addSavings(rows.map((r) => r.saving)));
      const per = rows.reduce((n, r) => n + r.per, 0);
      out.push({
        id: stableId('hook-event-context', rows.map((r) => r.key)),
        severity: severityOf(saving),
        title: rows.length === 1 ? T.hookEvent.titleOne(rows[0].name, rows[0].per) : T.hookEvent.titleMany(rows.length, per),
        detail: T.hookEvent.detail,
        evidence: rows.map((r) => T.hookEvent.evidence(r.name, r.per, r.sessions)),
        estSavingTokens: saving.period || undefined,
        pages: ['startup'],
        scope: 'history',
        saving,
        targets: rows.map((r): InsightTarget => ({ key: r.key, label: r.name, kind: 'hook', tokensPerSession: r.per })),
        prompts: buildPrompts({
          lang,
          summary: T.hookEvent.summary(rows.length),
          items: rows.map((r) => reviewItem({ name: r.name, action: T.hookEvent.action(r.name), why: T.hookEvent.why(r.per, env.settingsFile) })),
        }),
      });
    }
  }

  // ---------- D. The skill listing: handled on the Skills & plugins tab ----------
  const rows = o.attr.startupContext;
  const skillRow = rows.find((r) => r.key === STARTUP.skills);
  if (skillRow && skillRow.total > 0) {
    const rw = rangeWindow(store, range);
    const byPlugin = new Map<string, number>();
    for (const s of [...rw.mains, ...rw.subs]) for (const [p, c] of Object.entries(s.skillsByPlugin)) byPlugin.set(p, (byPlugin.get(p) ?? 0) + c);
    const top = [...byPlugin.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const per = Number(skillRow.extra?.perSession ?? 0);
    const perSub = Number(skillRow.extra?.perSubagent ?? 0);
    // What the listing cards of the Skills & plugins tab would save (not added to the Insights total twice).
    const listing = o.skillCards.filter((c) => /^(unused-plugins|unused-skills|unused-own-skills):/.test(c.id) && c.saving?.basis === 'projection');
    const actionable = listing.length ? addSavings(listing.map((c) => c.saving!)) : null;
    out.push({
      id: 'startup-skill-listing',
      pages: ['startup'],
      severity: skillRow.total > 5e6 ? 'high' : 'warn',
      title: TT.skillListing.title(per, perSub),
      detail: TT.skillListing.detail(perSub > 0, skillRow.total),
      evidence: [
        ...(actionable?.perSession ? [T.skillListing.actionable(actionable.perSession)] : []),
        ...top.map(([p, c]) => TT.skillListing.evidence(skillGroupLabel(p, lang), estTokens(c))),
      ],
      fix: TT.skillListing.fix,
      scope: 'range',
      saving: actionable?.perSession ? actionable : undefined,
      seeAlso: 'skills',
    });
  }

  // ---------- E. The startup context as a whole; subagents pay it again ----------
  {
    const perMain = rows.reduce((n, r) => n + Number(r.extra?.perSession ?? 0), 0);
    const perSub = rows.reduce((n, r) => n + Number(r.extra?.perSubagent ?? 0), 0);
    const startupTotal = rows.reduce((n, r) => n + r.total, 0);
    if (perMain > 0) {
      const rw = rangeWindow(store, range);
      const subTotal = rows.reduce((n, r) => n + Number(r.extra?.subagentTokens ?? 0), 0);
      const mainTotal = startupTotal - subTotal;
      const subs = rw.subs.length;
      const heavySubs = subs >= SUBS_MIN && subTotal > mainTotal;
      const top = [...rows].sort((a, b) => Number(b.extra?.perSession ?? 0) - Number(a.extra?.perSession ?? 0)).slice(0, 5);
      out.push({
        id: 'startup-total',
        pages: ['startup'],
        severity: heavySubs ? 'warn' : 'info',
        title: heavySubs ? T.startupTotal.titleSubs(subs, subTotal) : TT.startupTotal.title(perMain, perSub),
        detail: TT.startupTotal.detail(startupTotal),
        evidence: [
          ...(heavySubs ? [TT.startupTotal.title(perMain, perSub)] : []),
          ...(subs && perSub ? [T.startupTotal.subagents(subs, perSub, subTotal)] : []),
          ...top.map((r) => TT.startupTotal.evidence(r.label, Number(r.extra?.perSession ?? 0), Number(r.extra?.perSubagent ?? 0))),
        ],
        fix: TT.startupTotal.fix,
        scope: 'range',
      });
    }
  }

  return out;
}
