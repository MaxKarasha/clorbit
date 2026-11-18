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
    removeMcpUser: (name: string, file: string) => `Remove the MCP server "${name}" from the user scope (only its entry in ${file}; nothing else is touched)`,
    removeMcpLocal: (name: string, dir: string, file: string) => `Remove the MCP server "${name}" configured for the project ${dir} (local scope: its entry in ${file})`,
    moveMcp: (name: string, dirs: string[]) => `Move the MCP server "${name}" from the user scope to the projects that use it (${dirs.join(', ')}; local scope, not committed)`,
    disableMcpJson: (name: string, file: string) => `Turn off the project MCP server "${name}" for me: add "${name}" to "disabledMcpjsonServers" in ${file} (create the file if it is missing; the project's .mcp.json stays as it is)`,
    undoMcpJson: (name: string) => `remove "${name}" from "disabledMcpjsonServers" again`,
    disableConnectors: (file: string) => `Stop loading claude.ai connectors in Claude Code: set "disableClaudeAiConnectors": true in ${file} (they stay connected on claude.ai and keep working there)`,
    undoConnectors: 'set "disableClaudeAiConnectors" back to false (or remove the key)',
    compress: (file: string) => `Compress ${file} without losing meaning`,
    consolidateMemory: (file: string) => `Consolidate the auto-memory index ${file}`,
    backupOf: (file: string) => `<the backup of ${file}>`,
    allow: (rule: string, file: string) => `Add "${rule}" to "permissions.allow" in ${file} (create the file or the list if missing; keep every other entry)`,
    undoAllow: (rule: string) => `remove "${rule}" from "permissions.allow" again`,
    note: (file: string, section: string, text: string) => `Add one line to the "${section}" section of ${file} (create the section at the end if it is missing): "${text}"`,
    undoNote: 'remove that line again (or restore the backup)',
    agentModel: (name: string, file: string, model: string) => `Run the subagent ${name} on ${model}: set "model: ${model}" in the frontmatter of ${file} (replace an existing model line)`,
    undoAgentModel: 'put the previous model line back (or restore the backup)',
  },
  uk: {
    disablePlugin: (key: string) => `Вимкнути плагін ${key}`,
    enableLocal: (key: string, dir: string) => `Увімкнути плагін ${key} лише в проєкті ${dir} (локально, без коміту)`,
    moveSkill: (name: string, from: string, to: string) => `Перенести мій власний скіл «${name}» з теки скілів (${from} → ${to})`,
    removeMcpUser: (name: string, file: string) => `Прибрати MCP-сервер «${name}» з рівня користувача (лише його запис у ${file}; більше нічого не чіпати)`,
    removeMcpLocal: (name: string, dir: string, file: string) => `Прибрати MCP-сервер «${name}», налаштований для проєкту ${dir} (локальний рівень: його запис у ${file})`,
    moveMcp: (name: string, dirs: string[]) => `Перенести MCP-сервер «${name}» з рівня користувача в проєкти, де він потрібен (${dirs.join(', ')}; локально, без коміту)`,
    disableMcpJson: (name: string, file: string) => `Вимкнути для мене проєктний MCP-сервер «${name}»: додати "${name}" до "disabledMcpjsonServers" у ${file} (створити файл, якщо його немає; .mcp.json проєкту не змінювати)`,
    undoMcpJson: (name: string) => `знову прибрати "${name}" з "disabledMcpjsonServers"`,
    disableConnectors: (file: string) => `Не завантажувати конектори claude.ai у Claude Code: поставити "disableClaudeAiConnectors": true у ${file} (на claude.ai вони лишаються підключеними й працюють)`,
    undoConnectors: 'повернути "disableClaudeAiConnectors" у false (або прибрати ключ)',
    compress: (file: string) => `Стиснути ${file} без втрати змісту`,
    consolidateMemory: (file: string) => `Упорядкувати індекс автопам'яті ${file}`,
    backupOf: (file: string) => `<копія ${file}>`,
    allow: (rule: string, file: string) => `Додати "${rule}" до "permissions.allow" у ${file} (створити файл або список, якщо їх немає; решту записів не чіпати)`,
    undoAllow: (rule: string) => `знову прибрати "${rule}" з "permissions.allow"`,
    note: (file: string, section: string, text: string) => `Додати один рядок у розділ "${section}" файлу ${file} (якщо розділу немає — створити його в кінці): "${text}"`,
    undoNote: 'прибрати цей рядок (або відновити копію)',
    agentModel: (name: string, file: string, model: string) => `Запускати субагента ${name} на ${model}: поставити "model: ${model}" у frontmatter файлу ${file} (замінити наявний рядок model)`,
    undoAgentModel: 'повернути попередній рядок model (або відновити копію)',
  },
};

/** Extra rules some prompts add through PromptSpec.notes. */
export const PROMPT_NOTES = {
  en: {
    mcpRemove: (file: string) => `Removing an MCP server's entry with "claude mcp remove" is the one removal allowed here, and only after ${file} is backed up; put each removed server's JSON config into the report so it can be added back.`,
    jq: 'The commands use jq to copy a server\'s JSON config; if jq is missing, copy the JSON by hand from the file.',
    compress: [
      'Keep every rule, fact and instruction: remove repetition, filler and outdated parts, merge overlapping sections, prefer short bullet points.',
      'Move parts needed only now and then (long examples, reference tables, procedures for rare tasks) into separate files next to it and leave one line saying when to read each file (a plain path, not an @import: @imports are loaded at startup too). A procedure Claude follows step by step can become a skill instead.',
      'Show me the before/after size (wc -c) and a short summary of what moved where.',
    ],
    memory: [
      'Keep every memory that is still true. Merge duplicates and near-duplicates, keep one short line per entry in the index, and fix entries that point to missing files.',
      'Move memory files that are clearly outdated into an "archive" folder next to them (do not delete them) and drop their lines from the index; ask me when unsure.',
      'Show me the before/after size of the index (wc -c).',
    ],
    allow: [
      'Edit only the "permissions.allow" lists: keep the rest of each file as it is and keep it valid JSON (check it with jq . or node -e "JSON.parse(require(\'fs\').readFileSync(0, \'utf8\'))" < file).',
      'Add exactly the rules listed, nothing broader: no Bash(*), no rules for commands that delete, move, push, install, publish or download and run code (removing files, git push, sudo, curl … | sh and the like). "deny" rules always win over "allow", so do not touch existing deny rules.',
      'Rules in a project\'s .claude/settings.local.json apply only in that project (and only once the folder is trusted); they are not committed.',
    ],
    note: (file: string) => [
      `Keep the additions to ${file} short: one line per item, no new sections besides the ones named, nothing else in the file changes.`,
    ],
    agentModel: [
      'A subagent\'s "model" field takes sonnet, opus, haiku, fable, inherit or a full model id; a model passed by the Agent call itself still wins over it.',
      'Do not change the agent\'s tools, prompt or description.',
    ],
  },
  uk: {
    mcpRemove: (file: string) => `Прибрати запис MCP-сервера командою "claude mcp remove" — єдине дозволене тут видалення, і лише після копії ${file}; у звіті наведи JSON-конфігурацію кожного прибраного сервера, щоб його можна було повернути.`,
    jq: 'Команди копіюють JSON-конфігурацію сервера через jq; якщо jq немає — скопіюй JSON з файлу вручну.',
    compress: [
      'Збережи кожне правило, факт і вказівку: прибери повтори, «воду» й застаріле, об\'єднай розділи, що перетинаються, віддавай перевагу коротким пунктам.',
      'Те, що потрібно лише зрідка (довгі приклади, довідкові таблиці, процедури для рідкісних задач), винеси в окремі файли поруч і залиш по одному рядку, коли читати кожен файл (простий шлях, не @import: @import теж завантажується на старті). Процедуру, яку Claude виконує крок за кроком, можна зробити скілом.',
      'Покажи розмір до й після (wc -c) і коротко — що куди перенесено.',
    ],
    memory: [
      'Збережи кожен спогад, що досі правдивий. Об\'єднай дублікати й майже дублікати, лиши в індексі по одному короткому рядку на запис, виправ записи, що вказують на відсутні файли.',
      'Явно застарілі файли пам\'яті перенеси в теку "archive" поруч (не видаляй) і прибери їхні рядки з індексу; якщо сумніваєшся — спитай мене.',
      'Покажи розмір індексу до й після (wc -c).',
    ],
    allow: [
      'Змінюй лише списки "permissions.allow": решту кожного файлу лиши як є, JSON має лишитися коректним (перевір через jq . або node -e "JSON.parse(require(\'fs\').readFileSync(0, \'utf8\'))" < файл).',
      'Додай рівно перелічені правила, нічого ширшого: жодного Bash(*), жодних правил для команд, що видаляють, переносять, пушать, встановлюють, публікують або завантажують і запускають код (видалення файлів, git push, sudo, curl … | sh тощо). Правила "deny" завжди сильніші за "allow", тож наявних deny не чіпай.',
      'Правила в .claude/settings.local.json проєкту діють лише в цьому проєкті (і лише коли теці довіряють); їх не комітять.',
    ],
    note: (file: string) => [
      `Додавання в ${file} — коротко: один рядок на пункт, жодних нових розділів, крім названих, решта файлу не змінюється.`,
    ],
    agentModel: [
      'Поле "model" субагента приймає sonnet, opus, haiku, fable, inherit або повний id моделі; модель, передана самим викликом Agent, усе одно має перевагу.',
      'Не змінюй інструменти, промпт чи опис агента.',
    ],
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

// ---------- MCP servers ----------

const jqGet = (name: string, file: string, dirVar = false) =>
  `"$(jq -c${dirVar ? ' --arg d "$PWD"' : ''} --arg n ${shq(name)} '${dirVar ? '.projects[$d].mcpServers[$n]' : '.mcpServers[$n]'}' ${file})"`;

/** `claude mcp remove <name> --scope user|local` (it edits ~/.claude.json, which is backed up first). */
export function removeMcpServerItem(
  lang: PromptLang,
  o: { name: string; scope: 'user' | 'local'; dir?: string; claudeJson: string; why: string },
): PromptItem {
  const A = ACTIONS[lang];
  const backup = A.backupOf(o.claudeJson);
  if (o.scope === 'local' && o.dir) {
    return {
      name: `${o.name} → ${o.dir}`,
      action: A.removeMcpLocal(o.name, o.dir, o.claudeJson),
      why: o.why,
      commands: [`cd ${shq(o.dir)}`, `claude mcp remove ${shq(o.name)} --scope local`],
      undo: [`cd ${shq(o.dir)}`, `claude mcp add-json ${shq(o.name)} ${jqGet(o.name, backup, true)} --scope local`],
      files: [o.claudeJson],
    };
  }
  return {
    name: o.name,
    action: A.removeMcpUser(o.name, o.claudeJson),
    why: o.why,
    commands: [`claude mcp remove ${shq(o.name)} --scope user`],
    undo: [`claude mcp add-json ${shq(o.name)} ${jqGet(o.name, backup)} --scope user`],
    files: [o.claudeJson],
  };
}

/** Copies a user-scope server into each project (local scope) and then removes it from the user scope. */
export function moveMcpToProjectsItem(lang: PromptLang, o: { name: string; dirs: string[]; claudeJson: string; why: string }): PromptItem {
  const A = ACTIONS[lang];
  const n = shq(o.name);
  return {
    name: o.name,
    action: A.moveMcp(o.name, o.dirs),
    why: o.why,
    commands: [
      ...o.dirs.map((d) => `(cd ${shq(d)} && claude mcp add-json ${n} ${jqGet(o.name, shq(o.claudeJson))} --scope local)`),
      `claude mcp remove ${n} --scope user`,
    ],
    undo: [
      ...o.dirs.map((d) => `(cd ${shq(d)} && claude mcp remove ${n} --scope local)`),
      `claude mcp add-json ${n} ${jqGet(o.name, A.backupOf(o.claudeJson))} --scope user`,
    ],
    files: [o.claudeJson],
  };
}

/** A server from a project's .mcp.json, turned off for me via `disabledMcpjsonServers` in the project's local settings. */
export function disableMcpJsonServerItem(lang: PromptLang, o: { name: string; dir: string; why: string }): PromptItem {
  const file = `${o.dir}/.claude/settings.local.json`;
  return { name: `${o.name} → ${o.dir}`, action: ACTIONS[lang].disableMcpJson(o.name, file), why: o.why, undo: [ACTIONS[lang].undoMcpJson(o.name)], files: [file] };
}

/** `"disableClaudeAiConnectors": true` in the user settings: Claude Code stops loading every claude.ai connector. */
export function disableClaudeAiConnectorsItem(lang: PromptLang, o: { settingsFile: string; why: string }): PromptItem {
  return { name: 'disableClaudeAiConnectors', action: ACTIONS[lang].disableConnectors(o.settingsFile), why: o.why, undo: [ACTIONS[lang].undoConnectors], files: [o.settingsFile] };
}

// ---------- instruction files ----------

/** Compress a CLAUDE.md / rules file (backed up first; the rules go into PromptSpec.notes: PROMPT_NOTES.compress). */
export function compressInstructionsItem(lang: PromptLang, o: { path: string; why: string }): PromptItem {
  return {
    name: o.path,
    action: ACTIONS[lang].compress(o.path),
    why: o.why,
    undo: [`cp ${ACTIONS[lang].backupOf(o.path)} ${shq(o.path)}`],
    files: [o.path],
  };
}

/** Consolidate an auto-memory index (MEMORY.md); outdated memory files are moved to an archive folder, never deleted. */
export function consolidateMemoryItem(lang: PromptLang, o: { path: string; why: string }): PromptItem {
  return {
    name: o.path,
    action: ACTIONS[lang].consolidateMemory(o.path),
    why: o.why,
    undo: [`cp ${ACTIONS[lang].backupOf(o.path)} ${shq(o.path)}`],
    files: [o.path],
  };
}

// ---------- permissions, instruction notes, subagent models ----------

/** Adds one allow rule to a settings file's `permissions.allow` (the file is backed up first). The rule is not checked
 *  here: callers pass only rules that passed `isSafeAllowRule` (server/recommend-tools.ts). */
export function allowRuleItem(lang: PromptLang, o: { rule: string; file: string; why: string }): PromptItem {
  return { name: `${o.rule} → ${o.file}`, action: ACTIONS[lang].allow(o.rule, o.file), why: o.why, undo: [ACTIONS[lang].undoAllow(o.rule)], files: [o.file] };
}

/** One line in a named section of an instruction file (CLAUDE.md), backed up first. */
export function instructionNoteItem(lang: PromptLang, o: { name: string; file: string; section: string; text: string; why: string }): PromptItem {
  return { name: o.name, action: ACTIONS[lang].note(o.file, o.section, o.text), why: o.why, undo: [ACTIONS[lang].undoNote], files: [o.file] };
}

/** `model: <model>` in the frontmatter of a user or project subagent file, backed up first. */
export function agentModelItem(lang: PromptLang, o: { name: string; file: string; model: string; why: string }): PromptItem {
  return { name: o.name, action: ACTIONS[lang].agentModel(o.name, o.file, o.model), why: o.why, undo: [ACTIONS[lang].undoAgentModel], files: [o.file] };
}
