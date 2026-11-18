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

    // Recommendations (recommend-*.ts). Prompt items reuse `why` lines, so they read well on their own.
    rec: {
      lastUsed: (days: number) => (days === 0 ? 'last used today' : `last used ${days} ${plural(days, 'en', ['day', 'days'])} ago`),
      never: (since: string | null) => (since ? `never used (listed since ${since})` : 'never used'),
      perSession: (tok: number) => `≈ ${N(tok)} tokens of context per session`,
      parts: (p: { skills: number; hook: number; mcp: number }) => [
        p.skills ? `skill descriptions ${N(p.skills)}` : '',
        p.hook ? `SessionStart hook ${N(p.hook)}` : '',
        p.mcp ? `MCP instructions ${N(p.mcp)}` : '',
      ].filter(Boolean).join(' + '),
      unusedPlugins: {
        titleOne: (name: string, last: string) => `Plugin ${name} is enabled but ${last}`,
        titleMany: (n: number, days: number) => `${n} enabled plugins have not been used for ${days}+ days`,
        detail: (days: number) => `No skill calls, MCP tool calls or attributed turns in the whole stored history for at least ${days} days (archived sessions included). They still load into every new session and every subagent that gets the skill listing.`,
        evidence: (name: string, last: string, per: number, parts: string) => `${name}: ${last}; ≈ ${N(per)} tokens per session${parts ? ` (${parts})` : ''}`,
        why: (last: string, per: number) => `${last}; ≈ ${N(per)} tokens of context per session`,
        summary: (n: number, days: number) => `${n} enabled ${plural(n, 'en', ['plugin has', 'plugins have'])} not been used for ${days}+ days but still add to the startup context of every session.`,
      },
      hookContext: {
        title: (plugin: string, per: number) => `Plugin ${plugin} adds ~${N(per)} tokens to every session, also where it is not used`,
        detail: (plugin: string, used: number, total: number, projects: string[]) =>
          `Its SessionStart hook injects a block of text at the start of every session, yet the skills or tools of ${plugin} were used in ${used} of ${total} such sessions in this period${projects.length ? ` (projects: ${projects.join(', ')})` : ''}. Disable it globally and enable it only where you use it.`,
        sessions: (used: number, total: number) => `Used in ${used} of ${total} sessions that carried the hook block`,
        perSession: (per: number) => `Hook block: ≈ ${N(per)} tokens per session`,
        why: (per: number, used: number, total: number) => `its SessionStart hook adds ≈ ${N(per)} tokens to every session, but it was used in ${used} of ${total} sessions`,
        whyEnable: (project: string) => `you use it in ${project}`,
        skillsUnused: (n: number, total: number, days: number) => `${n} of its ${total} skills not used for ${days}+ days`,
        summary: (plugin: string, per: number) => `plugin ${plugin} injects ≈ ${N(per)} tokens into every session through its SessionStart hook, but is used only in a few projects.`,
        fix: (plugin: string, key: string) => `If ${plugin} is not needed in every project, disable it globally (claude plugin disable ${key} --scope user) and enable it where you use it (claude plugin enable ${key} --scope local inside that project).`,
      },
      unusedSkills: {
        title: (plugin: string, n: number, total: number, days: number) => `Plugin ${plugin}: ${n} of ${total} skills not used for ${days}+ days`,
        detail: (plugin: string, unusedTok: number, totalTok: number) =>
          `Their descriptions take ≈ ${N(unusedTok)} of the ≈ ${N(totalTok)} listing tokens of ${plugin} in every session. A plugin's skills cannot be turned off one by one, so the choice is the whole plugin: disable it if you can do without the skills you still use.`,
        stillUsed: (list: string) => `Still in use: ${list}`,
        noneUsed: 'None of its listed skills was used recently; only its hooks or MCP tools were',
        mcpUsed: (last: string) => `Its MCP tools: ${last}`,
        why: (n: number, total: number, used: string) => `${n} of its ${total} skills not used recently${used ? `; still in use: ${used}` : ''}`,
        summary: (plugin: string, n: number, total: number, days: number) => `${n} of the ${total} skills of plugin ${plugin} have not been used for ${days}+ days.`,
      },
      unusedOwn: {
        title: (n: number, days: number) => `${n} of your own ${plural(n, 'en', ['skills has', 'skills have'])} not been used for ${days}+ days`,
        detail: (dir: string) => `Skills in ${dir} are listed in every session and every subagent that gets the skill listing. Moving a folder to a "-disabled" folder next to it takes it out of the listing and keeps it safe to bring back.`,
        evidence: (name: string, last: string, per: number) => `${name}: ${last}; ≈ ${N(per)} tokens per session`,
        why: (last: string, per: number) => `${last}; ≈ ${N(per)} tokens of context per session`,
        summary: (n: number, days: number) => `${n} of my own ${plural(n, 'en', ['skills has', 'skills have'])} not been used for ${days}+ days.`,
      },
      duplicates: {
        title: (n: number) => `${n} ${plural(n, 'en', ['skill name appears', 'skill names appear'])} more than once in the skill listing`,
        detail: 'The same name in several plugins, or your own skill next to a plugin skill of the same name: both descriptions are paid for in every session, and the model may pick the wrong one.',
        own: 'your own',
        copy: (label: string, last: string) => `${label} — ${last}`,
        evidence: (name: string, copies: string) => `${name}: ${copies}`,
        whyMove: (keep: string, keepLast: string) => `the same skill also comes from ${keep} (${keepLast})`,
        reviewAction: (key: string, keep: string) => `Compare the skill ${key} with ${keep}`,
        whyReview: (plugin: string) => `a plugin skill cannot be turned off alone; tell me whether disabling ${plugin} as a whole makes sense, and which copy to keep`,
        summary: (n: number) => `${n} skill ${plural(n, 'en', ['name is', 'names are'])} listed more than once.`,
      },
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

    rec: {
      lastUsed: (days) => (days === 0 ? 'востаннє використано сьогодні' : `востаннє використано ${days} ${plural(days, 'uk', ['день', 'дні', 'днів'])} тому`),
      never: (since) => (since ? `жодного разу не використано (у списку з ${since})` : 'жодного разу не використано'),
      perSession: (tok) => `≈ ${N(tok)} токенів контексту на сесію`,
      parts: (p) => [
        p.skills ? `описи скілів ${N(p.skills)}` : '',
        p.hook ? `хук SessionStart ${N(p.hook)}` : '',
        p.mcp ? `інструкції MCP ${N(p.mcp)}` : '',
      ].filter(Boolean).join(' + '),
      unusedPlugins: {
        titleOne: (name, last) => `Плагін ${name} увімкнено, але ${last}`,
        titleMany: (n, days) => `${n} ${plural(n, 'uk', ['увімкнений плагін не використовувався', 'увімкнені плагіни не використовувались', 'увімкнених плагінів не використовувались'])} ${days}+ дн.`,
        detail: (days) => `Жодного виклику скілів, MCP-інструментів чи атрибутованих ходів за всю збережену історію щонайменше ${days} дн. (з архівними сесіями). Проте вони й далі завантажуються в кожну нову сесію і кожного субагента, що отримує список скілів.`,
        evidence: (name, last, per, parts) => `${name}: ${last}; ≈ ${N(per)} токенів на сесію${parts ? ` (${parts})` : ''}`,
        why: (last, per) => `${last}; ≈ ${N(per)} токенів контексту на сесію`,
        summary: (n, days) => `${n} ${plural(n, 'uk', ['увімкнений плагін не використовувався', 'увімкнені плагіни не використовувались', 'увімкнених плагінів не використовувались'])} ${days}+ дн., але й далі додають стартовий контекст у кожну сесію.`,
      },
      hookContext: {
        title: (plugin, per) => `Плагін ${plugin} додає ~${N(per)} токенів у кожну сесію, навіть там, де він не потрібен`,
        detail: (plugin, used, total, projects) =>
          `Його хук SessionStart вставляє блок тексту на старті кожної сесії, а скіли чи інструменти ${plugin} знадобились у ${used} з ${total} таких сесій за період${projects.length ? ` (проєкти: ${projects.join(', ')})` : ''}. Вимкни його глобально й увімкни лише там, де він потрібен.`,
        sessions: (used, total) => `Використано в ${used} з ${total} сесій із блоком хука`,
        perSession: (per) => `Блок хука: ≈ ${N(per)} токенів на сесію`,
        why: (per, used, total) => `його хук SessionStart додає ≈ ${N(per)} токенів у кожну сесію, а використано його в ${used} з ${total} сесій`,
        whyEnable: (project) => `він потрібен у ${project}`,
        skillsUnused: (n, total, days) => `${n} з ${total} його скілів не використовувались ${days}+ дн.`,
        summary: (plugin, per) => `плагін ${plugin} через хук SessionStart вставляє ≈ ${N(per)} токенів у кожну сесію, але потрібен лише в кількох проєктах.`,
        fix: (plugin, key) => `Якщо ${plugin} потрібен не в кожному проєкті — вимкни його глобально (claude plugin disable ${key} --scope user) і увімкни там, де він потрібен (claude plugin enable ${key} --scope local у теці проєкту).`,
      },
      unusedSkills: {
        title: (plugin, n, total, days) => `Плагін ${plugin}: ${n} з ${total} скілів не використовувались ${days}+ дн.`,
        detail: (plugin, unusedTok, totalTok) =>
          `Їхні описи займають ≈ ${N(unusedTok)} з ≈ ${N(totalTok)} токенів списку скілів ${plugin} у кожній сесії. Скіли плагіна не вимикаються поодинці, тож вибір — увесь плагін: вимкни його, якщо обійдешся без скілів, якими ще користуєшся.`,
        stillUsed: (list) => `Ще використовуються: ${list}`,
        noneUsed: 'Жоден зі скілів у списку останнім часом не використовувався — лише хуки чи MCP-інструменти',
        mcpUsed: (last) => `Його MCP-інструменти: ${last}`,
        why: (n, total, used) => `${n} з ${total} його скілів давно не використовувались${used ? `; ще використовуються: ${used}` : ''}`,
        summary: (plugin, n, total, days) => `${n} з ${total} скілів плагіна ${plugin} не використовувались ${days}+ дн.`,
      },
      unusedOwn: {
        title: (n, days) => `${n} ${plural(n, 'uk', ['власний скіл не використовувався', 'власні скіли не використовувались', 'власних скілів не використовувались'])} ${days}+ дн.`,
        detail: (dir) => `Скіли з ${dir} потрапляють у список скілів кожної сесії та кожного субагента, що його отримує. Якщо перенести теку в сусідню теку «-disabled», скіл зникне зі списку, а повернути його буде просто.`,
        evidence: (name, last, per) => `${name}: ${last}; ≈ ${N(per)} токенів на сесію`,
        why: (last, per) => `${last}; ≈ ${N(per)} токенів контексту на сесію`,
        summary: (n, days) => `${n} ${plural(n, 'uk', ['мій власний скіл не використовувався', 'мої власні скіли не використовувались', 'моїх власних скілів не використовувались'])} ${days}+ дн.`,
      },
      duplicates: {
        title: (n) => `${n} ${plural(n, 'uk', ['назва скіла трапляється', 'назви скілів трапляються', 'назв скілів трапляються'])} у списку скілів більше одного разу`,
        detail: 'Та сама назва в кількох плагінах або власний скіл поруч зі скілом плагіна з тією ж назвою: обидва описи оплачуються в кожній сесії, і модель може обрати не той.',
        own: 'власний',
        copy: (label, last) => `${label} — ${last}`,
        evidence: (name, copies) => `${name}: ${copies}`,
        whyMove: (keep, keepLast) => `той самий скіл є і в ${keep} (${keepLast})`,
        reviewAction: (key, keep) => `Порівняти скіл ${key} з ${keep}`,
        whyReview: (plugin) => `скіл плагіна не вимикається окремо; скажи, чи є сенс вимкнути ${plugin} повністю і яку копію залишити`,
        summary: (n) => `${n} ${plural(n, 'uk', ['назва скіла трапляється', 'назви скілів трапляються', 'назв скілів трапляються'])} у списку більше одного разу.`,
      },
    },
  };
}

const cache: Partial<Record<Lang, InsightText>> = {};
export function insightText(lang: Lang): InsightText {
  return (cache[lang] ??= lang === 'uk' ? uk() : en());
}
