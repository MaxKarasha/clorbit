// Insight texts in English and Ukrainian. insights.ts computes the facts; this file words them.
import { fmtDuration, fmtNum, plural, type Lang } from './i18n';

const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

function en() {
  const N = (n: number) => fmtNum(n, 'en');
  const D = (ms: number) => fmtDuration(ms, 'en');
  const times = (n: number) => `${n} ${plural(n, 'en', ['time', 'times'])}`;
  return {
    pct,
    unknownTool: 'unknown tool',
    noPlugin: 'no plugin',
    quote: (s: string) => `“${s}”`,
    toolFix: {
      Read: 'Read large files in chunks (offset/limit) or locate the spot with Grep first, so only the needed fragment lands in context.',
      Bash: 'Limit command output: `| head -n 50`, `| tail -n 50`, `--quiet`/`-q`, `grep` for key lines; for test logs, only failing tests.',
      Grep: 'Narrow searches: `glob`/`type`, `head_limit`, files_with_matches mode instead of content.',
      WebFetch: 'Ask WebFetch for a specific answer rather than the whole page.',
      Agent: 'Ask subagents to return a concise report (findings, paths, short snippets), not raw file dumps.',
    } as Record<string, string>,
    toolFixBrowser: 'For the browser, prefer get_page_text or find over full read_page/screenshots; close extra tabs — the tab list goes into context too.',
    toolFixMcp: (server: string) => `Narrow requests to the ${server} MCP server: filters, limits, only the fields you need.`,
    toolFixGeneric: 'Limit the size of this tool\'s results (filters, limits, a compact format).',

    waits: {
      title: (total: number, longest: number) => `You kept agents waiting for ${D(total)} in this period; the longest wait was ${D(longest)}`,
      detail: (n: number, perm: { n: number; ms: number } | null, input: { n: number; ms: number } | null, where: string, date: string, capH: number) =>
        `According to hooks, sessions waited for you ${times(n)}: ${[
          perm ? `for tool permission ${times(perm.n)} (${D(perm.ms)})` : '',
          input ? `for your reply ${times(input.n)} (${D(input.ms)})` : '',
        ].filter(Boolean).join(', ')}. The longest wait: ${where}, ${date}. A single wait over ${capH} h counts as ${capH} h.`,
      toolLine: (tool: string, n: number, ms: number) => `${tool}: ${n} permission ${plural(n, 'en', ['request', 'requests'])}, ${D(ms)} in total`,
      inputLine: (n: number, ms: number) => `Waiting for your reply: ${times(n)}, ${D(ms)} in total`,
      fixPerm: (allow: string) => `Pre-approve safe, frequent tools: "permissions": { "allow": [${allow}] } in the project's .claude/settings.json (for Bash — specific commands only). Long waits for replies are a reason to enable notifications or give agents longer autonomous tasks.`,
      fixInput: 'Long waits for replies are a reason to enable notifications or give agents longer autonomous tasks with a clear definition of done.',
    },

    startupHook: {
      title: (plugin: string, per: number) => `Plugin ${plugin} adds ~${N(per)} tokens to every session`,
      detail: (plugin: string, per: number, sessions: number, total: number) =>
        `The SessionStart hook of ${plugin} injects a block of text at the start of every session. In this period that is ${N(per)} × ${sessions} sessions ≈ ${N(total)} tokens (estimated from text length), which are then re-read from cache on every turn.`,
      sessions: (sessions: number, days: number) => `${sessions} sessions with this block over ${days} days`,
      perSession: (per: number) => `≈ ${N(per)} tokens per session`,
      listing: (plugin: string, per: number) => `Another ≈ ${N(per)} tokens per session — ${plugin}'s skill descriptions in the skill listing`,
      noListing: (plugin: string) => `No ${plugin} skills found in the listing`,
      fix: (plugin: string, key: string) => `If ${plugin} is not needed in every project, disable it globally in ~/.claude/settings.json: "enabledPlugins": { "${key}": false }, and enable it in the project-level .claude/settings.json where needed.`,
    },

    skillListing: {
      title: (per: number, perSub: number) => `Skill listing: ~${N(per)} tokens per session${perSub ? ` and ~${N(perSub)} per subagent` : ''}`,
      detail: (perSub: boolean, total: number) => `Descriptions of all available skills are injected at the start of every session${perSub ? ' and every subagent' : ''}. In total ≈ ${N(total)} tokens in this period.`,
      evidence: (p: string, tok: number) => `${p}: ≈ ${N(tok)} tokens in total`,
      fix: 'Disable plugins whose skills you do not use (enabledPlugins in ~/.claude/settings.json), remove unneeded skills from ~/.claude/skills, and shorten your own skills\' descriptions to one sentence.',
    },

    startupTotal: {
      title: (perMain: number, perSub: number) => `Startup context: ~${N(perMain)} tokens per session${perSub ? `, ~${N(perSub)} per subagent` : ''}`,
      detail: (total: number) => `Before the first prompt, the context already holds the system prompt, tool definitions, skill and agent listings, CLAUDE.md and more. In total ≈ ${N(total)} tokens in this period (estimated from text length); after that they are read from cache on every turn.`,
      evidence: (label: string, per: number, perSub: number) => `${label}: ≈ ${N(per)} per session${perSub ? `, ≈ ${N(perSub)} per subagent` : ''}`,
      fix: 'The easiest wins: shorten the skill listing (disable unused plugins, remove unneeded skills) and CLAUDE.md; do small tasks without a separate subagent — each subagent pays this startup cost again.',
    },

    unusedPlugin: {
      title: (name: string, days: number) => `Plugin ${name} is enabled but unused for ${days} days`,
      detail: (name: string, hookRuns: number) => `No skill calls, MCP tool calls or attributed turns from ${name} in this period${hookRuns ? `, although its hooks ran ${N(hookRuns)} times` : ''}. It still takes space in the startup context.`,
      skills: (tok: number) => `Its skill descriptions: ≈ ${N(tok)} tokens in this period`,
      noSkills: 'No skills found in the listing',
      hookBlock: (tok: number) => `Hook block at startup: ≈ ${N(tok)} tokens`,
      noHookBlock: 'No startup hook block',
      hookRuns: (n: number) => `Hook runs: ${N(n)}`,
      fix: (key: string) => `In ~/.claude/settings.json: "enabledPlugins": { "${key}": false }`,
    },

    unusedMcp: {
      title: (n: number, days: number) => `${n} MCP ${plural(n, 'en', ['server is', 'servers are'])} connected but had no calls in ${days} days`,
      detail: 'These servers show up in sessions (instructions and/or the deferred tool list), but their tools were never called.',
      evidence: (name: string, n: number, tok: number) => `${name}: in ${n} sessions/subagents${tok ? `, instructions ≈ ${N(tok)} tokens in total` : ''}`,
      fix: 'Disable unneeded servers via /mcp in Claude Code; claude.ai connectors ("claude.ai …") — in Connectors settings on claude.ai.',
    },

    bigResults: {
      example: (label: string, tok: number, project: string) => `${label} — ${N(tok)} tokens (${project})`,
      title: (tool: string, n: number, max: number) => `${tool}: ${n} oversized ${plural(n, 'en', ['result', 'results'])} (up to ${N(max)} tokens)`,
      detail: (sum: number) => `Results over 20K tokens bloat the context at once and are then re-read on every turn. ≈ ${N(sum)} tokens in total in this period.`,
    },

    repeatedReads: {
      title: (n: number) => `Repeated reads: ${n} ${plural(n, 'en', ['file was', 'files were'])} read ≥ 3 times within a session`,
      detail: (sessions: number, extra: number, avg: number) => `In ${sessions} sessions the same files were read again; that is ≈ ${N(extra)} extra Read calls (${N(avg)} tokens each on average).`,
      fix: 'After the first read, keep the needed fragments in notes or the plan, and pass subagents a path and a specific line range. Frequently re-read reference files are worth shortening or splitting.',
    },

    autoCompactions: {
      title: (total: number, sessions: number) => `${total} auto-${plural(total, 'en', ['compaction', 'compactions'])} in ${sessions} ${plural(sessions, 'en', ['session', 'sessions'])}`,
      detail: 'Auto-compaction means the context hit its limit: some details are lost, and the compaction itself costs an extra large turn.',
      fix: (pctEnv: string | undefined) => `Split big tasks into stages: after each stage, write a short summary into the plan file and /clear; hand research and bulk reads to subagents (Explore) so raw results stay out of the main context.${pctEnv ? ` Current threshold: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=${pctEnv}.` : ''}`,
    },

    skillShare: {
      title: (key: string, share: number, loads: number) => `Skill ${key}: ${pct(share)} of all tokens${loads ? `, ${loads} loads` : ''}`,
      detail: (key: string, total: number, sessions: number, perLoad: number | null) => `Turns attributed to ${key} used ≈ ${N(total)} tokens in ${sessions} sessions${perLoad !== null ? ` (≈ ${N(perLoad)} per load)` : ''}. That is not necessarily bad — but make sure the skill does not pull in more than it needs.`,
      turns: (turns: number, sessions: number) => `Turns: ${N(turns)}, sessions: ${sessions}`,
      tokens: (out: number, write: number) => `Output tokens: ${N(out)}, cache writes: ${N(write)}`,
      fix: 'Check SKILL.md: move reference sections into separate files the skill reads only when needed; sharpen the description so the skill does not trigger where it is not needed.',
    },

    skillLoads: {
      title: 'Most frequently loaded skills',
      detail: 'How many times Skill was invoked and what share of tokens the turns under that skill took.',
      evidence: (key: string, loads: number | string, share: number) => `${key}: ${loads}× — ${pct(share)} of tokens`,
    },

    lowCache: {
      title: (n: number, avg: number) => `${n} ${plural(n, 'en', ['day', 'days'])} with a low cache hit rate (average ${pct(avg)})`,
      detail: 'On these days a large part of the context was written to the cache again instead of being read from it. Cache writes cost more than reads and burn through limits faster.',
      evidence: (date: string, rate: number, write: number, input: number) => `${date}: cache ${pct(rate)}, cache writes ${N(write)}, uncached ${N(input)}`,
      fix: 'The prompt cache lives for a limited time: after a long pause, start a new session with a short summary instead of continuing a large one. Do not switch model/effort or change CLAUDE.md or the MCP set in the middle of a long session — that resets the cache.',
    },

    hooks: {
      title: (plugin: string | null, n: number, min: number, err: number | null) => `Hooks ${plugin ? `of plugin ${plugin}` : 'without a plugin'}: ${N(n)} runs, ${min} min of execution${err !== null ? `, ${pct(err)} with an error or stderr` : ''}`,
      detail: (names: string, min: number, err: number | null) => `Hooks (${names}) run as a separate process on every such event; their total execution time is ≈ ${min} min.${err !== null ? ` ${pct(err)} of runs ended with an error or wrote to stderr.` : ''}`,
      runs: (n: number) => `Runs: ${N(n)}`,
      time: (sec: number) => `Total time: ${sec}s`,
      errors: (n: number) => `With error/stderr: ${N(n)}`,
      fix: (plugin: string, key: string) => `If plugin ${plugin} is not needed in this environment, disable it: "enabledPlugins": { "${key}": false } in ~/.claude/settings.json.`,
      fixNoPlugin: 'Review the hook commands in ~/.claude/settings.json: are they needed on every event?',
    },
  };
}

export type InsightText = ReturnType<typeof en>;

function uk(): InsightText {
  const N = (n: number) => fmtNum(n, 'uk');
  const D = (ms: number) => fmtDuration(ms, 'uk');
  const times = (n: number) => `${n} ${plural(n, 'uk', ['раз', 'рази', 'разів'])}`;
  return {
    pct,
    unknownTool: 'невідомий інструмент',
    noPlugin: 'без плагіна',
    quote: (s: string) => `«${s}»`,
    toolFix: {
      Read: 'Читай великі файли частинами (параметри offset/limit) або спершу знайди потрібне місце через Grep — тоді в контекст потрапляє лише потрібний фрагмент.',
      Bash: 'Обмежуй вивід команд: `| head -n 50`, `| tail -n 50`, `--quiet`/`-q`, `grep` по ключових рядках; для логів тестів — лише невдалі тести.',
      Grep: 'Звужуй пошук: `glob`/`type`, `head_limit`, режим files_with_matches замість content.',
      WebFetch: 'Проси в запиті WebFetch конкретну відповідь, а не весь вміст сторінки.',
      Agent: 'Проси субагентів повертати стислий звіт (висновки, шляхи, короткі фрагменти), а не сирі дампи файлів.',
    },
    toolFixBrowser: 'Для браузера бери get_page_text або find замість повного read_page/скриншотів; закривай зайві вкладки — список вкладок теж іде в контекст.',
    toolFixMcp: (server) => `Звузь запити до MCP-сервера ${server}: фільтри, ліміти, лише потрібні поля.`,
    toolFixGeneric: 'Обмеж обсяг результату цього інструмента (фільтри, ліміти, стислий формат).',

    waits: {
      title: (total, longest) => `Ти тримав агентів у очікуванні ${D(total)} за період, найдовше — ${D(longest)}`,
      detail: (n, perm, input, where, date, capH) =>
        `За даними хуків сесії чекали на тебе ${times(n)}: ${[
          perm ? `дозволу на інструмент — ${times(perm.n)} (${D(perm.ms)})` : '',
          input ? `на відповідь — ${times(input.n)} (${D(input.ms)})` : '',
        ].filter(Boolean).join(', ')}. Найдовше очікування — ${where}, ${date}. Окреме очікування понад ${capH} год рахується як ${capH} год.`,
      toolLine: (tool, n, ms) => `${tool}: ${n} ${plural(n, 'uk', ['запит', 'запити', 'запитів'])} дозволу, разом ${D(ms)}`,
      inputLine: (n, ms) => `Очікування відповіді: ${times(n)}, разом ${D(ms)}`,
      fixPerm: (allow) => `Дозволь безпечні часті інструменти заздалегідь: "permissions": { "allow": [${allow}] } у .claude/settings.json проєкту (для Bash — лише конкретні команди). Довгі очікування відповіді — привід увімкнути сповіщення або давати агентам довші автономні задачі.`,
      fixInput: 'Довгі очікування відповіді — привід увімкнути сповіщення або давати агентам довші автономні задачі з чітким критерієм готовності.',
    },

    startupHook: {
      title: (plugin, per) => `Плагін ${plugin} додає ~${N(per)} токенів у кожну сесію`,
      detail: (plugin, per, sessions, total) =>
        `Хук SessionStart плагіна ${plugin} вставляє блок тексту на старті кожної сесії. За період це ${N(per)} × ${sessions} сесій ≈ ${N(total)} токенів (оцінка за довжиною тексту), які потім щоходу перечитуються з кешу.`,
      sessions: (sessions, days) => `${sessions} сесій з цим блоком за ${days} дн.`,
      perSession: (per) => `≈ ${N(per)} токенів на сесію`,
      listing: (plugin, per) => `Ще ≈ ${N(per)} токенів на сесію — описи скілів ${plugin} у списку скілів`,
      noListing: (plugin) => `Скілів ${plugin} у списку не знайдено`,
      fix: (plugin, key) => `Якщо ${plugin} потрібен не в кожному проєкті — вимкни його глобально в ~/.claude/settings.json: "enabledPlugins": { "${key}": false }, а в потрібних проєктах увімкни в .claude/settings.json проєкту.`,
    },

    skillListing: {
      title: (per, perSub) => `Список скілів: ~${N(per)} токенів на сесію${perSub ? ` і ~${N(perSub)} на кожного субагента` : ''}`,
      detail: (perSub, total) => `Описи всіх доступних скілів вставляються на старті кожної сесії${perSub ? ' і кожного субагента' : ''}. Разом за період ≈ ${N(total)} токенів.`,
      evidence: (p, tok) => `${p}: ≈ ${N(tok)} токенів сумарно`,
      fix: 'Вимкни плагіни, скілами яких не користуєшся (enabledPlugins у ~/.claude/settings.json), прибери зайві скіли з ~/.claude/skills, а описи (description) власних скілів скороти до одного речення.',
    },

    startupTotal: {
      title: (perMain, perSub) => `Стартовий контекст: ~${N(perMain)} токенів на сесію${perSub ? `, ~${N(perSub)} на субагента` : ''}`,
      detail: (total) => `Ще до першого запиту в контекст потрапляють системний промпт, визначення інструментів, списки скілів і агентів, CLAUDE.md тощо. Разом за період ≈ ${N(total)} токенів (оцінка за довжиною тексту); далі вони щоходу читаються з кешу.`,
      evidence: (label, per, perSub) => `${label}: ≈ ${N(per)} на сесію${perSub ? `, ≈ ${N(perSub)} на субагента` : ''}`,
      fix: 'Найпростіше скоротити список скілів (вимкнути зайві плагіни, прибрати непотрібні скіли) і CLAUDE.md; дрібні задачі краще робити без окремого субагента — кожен субагент платить цей стартовий внесок заново.',
    },

    unusedPlugin: {
      title: (name, days) => `Плагін ${name} увімкнено, але не використовувався ${days} дн.`,
      detail: (name, hookRuns) => `Жодного виклику скілів, MCP-інструментів чи атрибутованих ходів плагіна ${name} за період${hookRuns ? `, хоча його хуки спрацювали ${N(hookRuns)} разів` : ''}. Він однаково займає місце в стартовому контексті.`,
      skills: (tok) => `Описи його скілів: ≈ ${N(tok)} токенів за період`,
      noSkills: 'Скілів у списку не знайдено',
      hookBlock: (tok) => `Блок хука на старті: ≈ ${N(tok)} токенів`,
      noHookBlock: 'Стартового блоку хука немає',
      hookRuns: (n) => `Запусків хуків: ${N(n)}`,
      fix: (key) => `У ~/.claude/settings.json: "enabledPlugins": { "${key}": false }`,
    },

    unusedMcp: {
      title: (n, days) => `${n} MCP-серверів підключено, але жодного виклику за ${days} дн.`,
      detail: 'Ці сервери з\'являються в сесіях (інструкції та/або список відкладених інструментів), але їхні інструменти жодного разу не викликались.',
      evidence: (name, n, tok) => `${name}: у ${n} сесіях/субагентах${tok ? `, інструкції ≈ ${N(tok)} токенів сумарно` : ''}`,
      fix: 'Вимкни непотрібні сервери через /mcp у Claude Code; конектори claude.ai («claude.ai …») — у налаштуваннях Connectors на claude.ai.',
    },

    bigResults: {
      example: (label, tok, project) => `${label} — ${N(tok)} токенів (${project})`,
      title: (tool, n, max) => `${tool}: ${n} завеликих результатів (до ${N(max)} токенів)`,
      detail: (sum) => `Результати понад 20 тис. токенів одразу роздувають контекст і далі перечитуються щоходу. Разом ≈ ${N(sum)} токенів за період.`,
    },

    repeatedReads: {
      title: (n) => `Повторні читання: ${n} файлів читались ≥ 3 разів у межах сесії`,
      detail: (sessions, extra, avg) => `У ${sessions} сесіях ті самі файли перечитувались; це ≈ ${N(extra)} зайвих викликів Read (у середньому ${N(avg)} токенів кожен).`,
      fix: 'Після першого читання тримай потрібні фрагменти в нотатках/плані, а субагентам передавай шлях і конкретний діапазон рядків. Часто перечитувані довідкові файли варто скоротити або розбити.',
    },

    autoCompactions: {
      title: (total, sessions) => `${total} автокомпакцій у ${sessions} сесіях`,
      detail: 'Автокомпакція означає, що контекст дійшов до межі: частина подробиць губиться, а сама компакція коштує окремого великого ходу.',
      fix: (pctEnv) => `Розбивай великі задачі на етапи: після етапу — короткий підсумок у файл плану і /clear; дослідження та масові читання віддавай субагентам (Explore), щоб сирі результати не потрапляли в головний контекст.${pctEnv ? ` Поріг зараз: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=${pctEnv}.` : ''}`,
    },

    skillShare: {
      title: (key, share, loads) => `Скіл ${key}: ${pct(share)} усіх токенів${loads ? `, ${loads} завантажень` : ''}`,
      detail: (key, total, sessions, perLoad) => `Ходи під атрибуцією скіла ${key} забрали ≈ ${N(total)} токенів у ${sessions} сесіях${perLoad !== null ? ` (≈ ${N(perLoad)} на одне завантаження)` : ''}. Це не обов'язково погано — але варто переконатися, що скіл не тягне зайвого.`,
      turns: (turns, sessions) => `Ходів: ${N(turns)}, сесій: ${sessions}`,
      tokens: (out, write) => `Вихідних токенів: ${N(out)}, запис у кеш: ${N(write)}`,
      fix: 'Перевір SKILL.md: довідкові розділи винеси в окремі файли, які скіл читає лише за потреби; уточни description, щоб скіл не спрацьовував там, де не потрібен.',
    },

    skillLoads: {
      title: 'Найчастіше завантажувані скіли',
      detail: 'Скільки разів викликали Skill і яку частку токенів дали ходи під цим скілом.',
      evidence: (key, loads, share) => `${key}: ${loads}× — ${pct(share)} токенів`,
    },

    lowCache: {
      title: (n, avg) => `${n} дн. з низькою часткою кешу (середня ${pct(avg)})`,
      detail: 'У ці дні значна частина контексту записувалась у кеш заново замість читання з нього. Запис у кеш дорожчий за читання і швидше з\'їдає ліміт.',
      evidence: (date, rate, write, input) => `${date}: кеш ${pct(rate)}, запис у кеш ${N(write)}, без кешу ${N(input)}`,
      fix: 'Кеш промпта живе обмежений час: після довгої паузи краще почати нову сесію з коротким підсумком, ніж продовжувати велику. Не перемикай модель/ефорт і не змінюй CLAUDE.md чи набір MCP посеред довгої сесії — це скидає кеш.',
    },

    hooks: {
      title: (plugin, n, min, err) => `Хуки ${plugin ? `плагіна ${plugin}` : 'без плагіна'}: ${N(n)} запусків, ${min} хв виконання${err !== null ? `, ${pct(err)} з помилкою чи stderr` : ''}`,
      detail: (names, min, err) => `Хуки (${names}) запускаються окремим процесом на кожну таку подію; сумарний час їх виконання ≈ ${min} хв.${err !== null ? ` ${pct(err)} запусків завершились з помилкою або писали в stderr.` : ''}`,
      runs: (n) => `Запусків: ${N(n)}`,
      time: (sec) => `Сумарний час: ${sec} с`,
      errors: (n) => `З помилкою/stderr: ${N(n)}`,
      fix: (plugin, key) => `Якщо плагін ${plugin} не потрібен у цьому середовищі — вимкни: "enabledPlugins": { "${key}": false } у ~/.claude/settings.json.`,
      fixNoPlugin: 'Перевір команди хуків у ~/.claude/settings.json: чи вони потрібні на кожну подію.',
    },
  };
}

const cache: Partial<Record<Lang, InsightText>> = {};
export function insightText(lang: Lang): InsightText {
  return (cache[lang] ??= lang === 'uk' ? uk() : en());
}
