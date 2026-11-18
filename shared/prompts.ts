// Prompt builder for recommendations: turns a list of concrete changes into two prompts the user pastes into a
// Claude Code session. "all" — Claude makes every change and reports; "ask" — Claude asks about each item first.
// Clorbit never changes anything itself; the prompts always ask Claude to show the plan, back up every settings
// file it edits, move instead of delete, and report how to undo. Shared by the server (rules) and the demo data.
import type { InsightPrompts } from './api';

export type PromptLang = 'en' | 'uk';

/** One change (or one thing to look at) in a prompt. */
export interface PromptItem {
  /** Short name used in the survey, e.g. 'superpowers@claude-plugins-official'. */
  name: string;
  /** What changes, one line: "Disable the plugin …". */
  action: string;
  /** Why, with the numbers: "unused for 45 days; ≈ 3.2K tokens of context per session". */
  why: string;
  /** Exact shell commands, in order. */
  commands?: string[];
  /** How to revert it. */
  undo?: string[];
  /** Settings files the commands edit: Claude backs them up first. */
  files?: string[];
  /** Nothing to change: Claude only looks and reports back (e.g. two skills with the same name). */
  reviewOnly?: boolean;
}

export interface PromptSpec {
  lang: PromptLang;
  /** One sentence: what Clorbit found. */
  summary: string;
  items: PromptItem[];
  /** Commands that show the result at the end, e.g. 'claude plugin list'. */
  verify?: string[];
  /** Extra rules for Claude. */
  notes?: string[];
}

/** Quotes a path or argument for a POSIX shell. `~/…` stays expandable ("$HOME/…"). */
export function shq(s: string): string {
  if (/^[\w@%+=:,./~-]+$/.test(s)) return s;
  const esc = (x: string) => x.replace(/(["\\$`])/g, '\\$1');
  if (s.startsWith('~/')) return `"$HOME/${esc(s.slice(2))}"`;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

const TEXT = {
  en: {
    intro: 'Clorbit (a read-only dashboard over my Claude Code sessions) suggests a change to my Claude Code setup.',
    found: 'What it found:',
    estimates: 'Its numbers are estimates from my session history. If what you see on disk differs (already disabled, folder missing), trust the disk and tell me.',
    itemsAll: 'Please make these changes:',
    itemsAsk: 'The candidates:',
    run: 'Run',
    undo: 'Undo',
    review: 'Nothing to change automatically — look and tell me what you would do.',
    askHow: [
      'Do not change anything yet. Go through the candidates one at a time and ask me about each — with the AskUserQuestion tool if you have it (one question per item, options "Yes, do it" and "No, keep it"), otherwise in plain text, waiting for my answer before the next one.',
      'In each question say what it is, why it is suggested (the facts above) and what exactly will change.',
    ],
    afterAsk: 'After my last answer:',
    rules: 'How to work:',
    planFirst: 'First show me the full list of changes and every file they will touch, then go ahead.',
    planConfirmed: 'Show me the list of changes I confirmed and every file they will touch, then go ahead.',
    onlyConfirmed: 'Apply only what I confirmed; leave everything else as it is.',
    backup: (files: string[]) => `Before editing any settings file, back it up next to itself with a timestamp${files.length ? `, e.g. ${files.map((f) => `cp ${shq(f)} ${shq(f)}.bak-$(date +%Y%m%d-%H%M%S)`).join('; ')}` : ''}.`,
    noDelete: 'Do not delete anything: folders are moved, not removed.',
    onFail: 'If a step fails or the item no longer exists, skip it and tell me why; do not improvise other changes.',
    report: (verify: string[]) => `At the end${verify.length ? ` check the result (${verify.join('; ')}) and` : ','} show me a short report: what changed, what was skipped, where the backups are and how to undo each change.`,
    newSessions: 'Remind me that the changes apply to new Claude Code sessions: this one and other open sessions keep the old setup until restarted.',
  },
  uk: {
    intro: 'Clorbit (дашборд, що лише читає мої сесії Claude Code) радить змінити налаштування Claude Code.',
    found: 'Що він знайшов:',
    estimates: 'Його числа — оцінки за історією моїх сесій. Якщо на диску інакше (вже вимкнено, теки немає) — вір диску і скажи мені.',
    itemsAll: 'Зроби, будь ласка, такі зміни:',
    itemsAsk: 'Кандидати:',
    run: 'Команда',
    undo: 'Скасувати',
    review: 'Автоматично нічого не змінюй — подивись і скажи, що б ти зробив.',
    askHow: [
      'Поки нічого не змінюй. Пройдися по кандидатах по одному й спитай мене про кожен — інструментом AskUserQuestion, якщо він у тебе є (одне питання на пункт, варіанти «Так, зроби» і «Ні, залиш»), інакше звичайним текстом, дочекавшись відповіді перед наступним.',
      'У кожному питанні скажи, що це, чому радять (факти вище) і що саме зміниться.',
    ],
    afterAsk: 'Після моєї останньої відповіді:',
    rules: 'Як працювати:',
    planFirst: 'Спершу покажи повний список змін і всі файли, яких вони торкнуться, потім виконуй.',
    planConfirmed: 'Покажи список змін, які я підтвердив, і всі файли, яких вони торкнуться, потім виконуй.',
    onlyConfirmed: 'Застосуй лише те, що я підтвердив; усе інше залиш як є.',
    backup: (files: string[]) => `Перед зміною будь-якого файлу налаштувань зроби його копію поруч із позначкою часу${files.length ? `, наприклад ${files.map((f) => `cp ${shq(f)} ${shq(f)}.bak-$(date +%Y%m%d-%H%M%S)`).join('; ')}` : ''}.`,
    noDelete: 'Нічого не видаляй: теки переносимо, а не стираємо.',
    onFail: 'Якщо крок не вдався або пункту вже немає — пропусти його й поясни чому; інших змін від себе не вигадуй.',
    report: (verify: string[]) => `Наприкінці${verify.length ? ` перевір результат (${verify.join('; ')}) і` : ''} покажи короткий звіт: що змінено, що пропущено, де копії і як скасувати кожну зміну.`,
    newSessions: 'Нагадай мені, що зміни діють у нових сесіях Claude Code: ця й інші відкриті сесії працюють зі старими налаштуваннями до перезапуску.',
  },
};

function itemLines(it: PromptItem, i: number, T: (typeof TEXT)['en']): string[] {
  const out = [`${i + 1}. ${it.action} — ${it.why}`];
  if (it.reviewOnly) out.push(`   ${T.review}`);
  if (it.commands?.length) out.push(`   ${T.run}: ${it.commands.join(' && ')}`);
  if (it.undo?.length) out.push(`   ${T.undo}: ${it.undo.join(' && ')}`);
  return out;
}

/** Builds both prompt variants. Every item's exact commands and the backup rule are in both. */
export function buildPrompts(spec: PromptSpec): InsightPrompts {
  const T = TEXT[spec.lang] ?? TEXT.en;
  const files = [...new Set(spec.items.flatMap((i) => i.files ?? []))];
  const verify = spec.verify ?? [];
  const head = [T.intro, '', `${T.found} ${spec.summary}`, T.estimates, ''];
  const rules = (planLine: string, extra: string[]) => [
    planLine,
    ...extra,
    T.backup(files),
    T.noDelete,
    T.onFail,
    ...(spec.notes ?? []),
    T.report(verify),
    T.newSessions,
  ].map((l) => `- ${l}`);
  const items = spec.items.flatMap((it, i) => itemLines(it, i, T));
  const all = [...head, T.itemsAll, ...items, '', T.rules, ...rules(T.planFirst, [])].join('\n');
  const ask = [...head, ...T.askHow, '', T.itemsAsk, ...items, '', T.afterAsk, ...rules(T.planConfirmed, [T.onlyConfirmed])].join('\n');
  return { all, ask };
}

// ---------- item factories (wording per language) ----------

const ACTIONS = {
  en: {
    disablePlugin: (key: string) => `Disable the plugin ${key}`,
    enableLocal: (key: string, dir: string) => `Enable the plugin ${key} only in the project ${dir} (local scope, not committed)`,
    moveSkill: (name: string, from: string, to: string) => `Move my own skill "${name}" out of the skills folder (${from} → ${to})`,
  },
  uk: {
    disablePlugin: (key: string) => `Вимкнути плагін ${key}`,
    enableLocal: (key: string, dir: string) => `Увімкнути плагін ${key} лише в проєкті ${dir} (локально, без коміту)`,
    moveSkill: (name: string, from: string, to: string) => `Перенести мій власний скіл «${name}» з теки скілів (${from} → ${to})`,
  },
};

/** `claude plugin disable <name>@<marketplace> --scope user` (it edits the user settings file, which is backed up first). */
export function disablePluginItem(lang: PromptLang, o: { key: string; why: string; settingsFile: string }): PromptItem {
  return {
    name: o.key,
    action: ACTIONS[lang].disablePlugin(o.key),
    why: o.why,
    commands: [`claude plugin disable ${shq(o.key)} --scope user`],
    undo: [`claude plugin enable ${shq(o.key)} --scope user`],
    files: [o.settingsFile],
  };
}

/** `claude plugin enable … --scope local` inside a project folder (writes its .claude/settings.local.json). */
export function enablePluginInProjectItem(lang: PromptLang, o: { key: string; dir: string; why: string }): PromptItem {
  return {
    name: `${o.key} → ${o.dir}`,
    action: ACTIONS[lang].enableLocal(o.key, o.dir),
    why: o.why,
    commands: [`cd ${shq(o.dir)}`, `claude plugin enable ${shq(o.key)} --scope local`],
    undo: [`cd ${shq(o.dir)}`, `claude plugin disable ${shq(o.key)} --scope local`],
    files: [`${o.dir}/.claude/settings.local.json`],
  };
}

/** Moves `<skillsDir>/<name>` to `<skillsDir>-disabled/<name>` — never deletes. */
export function moveSkillItem(lang: PromptLang, o: { name: string; skillsDir: string; why: string }): PromptItem {
  const from = `${o.skillsDir}/${o.name}`;
  const toDir = `${o.skillsDir}-disabled`;
  const to = `${toDir}/${o.name}`;
  return {
    name: o.name,
    action: ACTIONS[lang].moveSkill(o.name, from, to),
    why: o.why,
    commands: [`mkdir -p ${shq(toDir)}`, `mv ${shq(from)} ${shq(to)}`],
    undo: [`mv ${shq(to)} ${shq(from)}`],
  };
}

/** Something to look at, with no change made automatically. */
export function reviewItem(o: { name: string; action: string; why: string }): PromptItem {
  return { ...o, reviewOnly: true };
}
