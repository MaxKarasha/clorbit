// Server-side dictionary for human-readable text the API returns (status reasons, startup-context
// labels, session timeline labels). Insight texts live in insights-text.ts. The web sends
// `?lang=en|uk` on every request; English is the default.
import type { ClorbitEvent } from '../shared/api.ts';

export type Lang = 'en' | 'uk';

/** `lang` query parameter → language (default English). */
export function parseLang(q: URLSearchParams | string | null | undefined): Lang {
  const v = typeof q === 'string' || q == null ? q : q.get('lang');
  return v === 'uk' ? 'uk' : 'en';
}

// ---------- number / duration formatting ----------

export function fmtNum(n: number, lang: Lang): string {
  const a = Math.abs(n);
  const dec = (x: number) => (lang === 'uk' ? x.toFixed(1).replace('.', ',') : x.toFixed(1));
  if (lang === 'uk') {
    if (a >= 1e9) return `${dec(n / 1e9)} млрд`;
    if (a >= 1e6) return `${dec(n / 1e6)} млн`;
    if (a >= 1e4) return `${Math.round(n / 1e3)} тис.`;
    if (a >= 1e3) return `${dec(n / 1e3)} тис.`;
    return String(Math.round(n));
  }
  if (a >= 1e9) return `${dec(n / 1e9)}B`;
  if (a >= 1e6) return `${dec(n / 1e6)}M`;
  if (a >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (a >= 1e3) return `${dec(n / 1e3)}K`;
  return String(Math.round(n));
}

export function fmtDuration(ms: number, lang: Lang): string {
  const min = Math.round(ms / 60_000);
  const [s, m, h] = lang === 'uk' ? [' с', ' хв', ' год'] : ['s', 'm', 'h'];
  if (min < 1) return `${Math.round(ms / 1000)}${s}`;
  if (min < 60) return `${min}${m}`;
  const hh = Math.floor(min / 60);
  return min % 60 ? `${hh}${h} ${min % 60}${m}` : `${hh}${h}`;
}

/** Plural form: en uses [one, other]; uk uses [one, few, many] (1 раз, 2 рази, 5 разів). */
export function plural(n: number, lang: Lang, forms: string[]): string {
  if (lang === 'en') return n === 1 ? forms[0] : forms[1] ?? forms[0];
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

// ---------- session status reasons ----------

/** Language-neutral status reason; rendered per request with reasonText(). */
export type Reason =
  | { k: 'sessionStarted' | 'gotPrompt' | 'working' | 'waitingInput' | 'waitingYou' | 'waitingPermissionAny' | 'answerReady' | 'sessionEnded' | 'processEnded' | 'justStarted' }
  | { k: 'running' | 'waitingPermission' | 'probablyPermission'; a: string }
  | { k: 'subagentsWorking'; a: number };

const REASONS: Record<Lang, Record<Reason['k'], string>> = {
  en: {
    sessionStarted: 'Session started',
    gotPrompt: 'Got a prompt',
    working: 'Working',
    waitingInput: 'Waiting for your reply',
    waitingYou: 'Waiting for you',
    waitingPermissionAny: 'Waiting for permission',
    answerReady: 'Answer ready',
    sessionEnded: 'Session ended',
    processEnded: 'Process exited',
    justStarted: 'Session just started',
    running: 'Running: {a}',
    waitingPermission: 'Waiting for permission: {a}',
    probablyPermission: 'Probably waiting for permission: {a}',
    subagentsWorking: 'Subagents working: {a}',
  },
  uk: {
    sessionStarted: 'Сесію розпочато',
    gotPrompt: 'Отримала запит',
    working: 'Працює',
    waitingInput: 'Чекає на твою відповідь',
    waitingYou: 'Чекає на тебе',
    waitingPermissionAny: 'Чекає дозволу',
    answerReady: 'Відповідь готова',
    sessionEnded: 'Сесію завершено',
    processEnded: 'Процес завершено',
    justStarted: 'Сесія щойно запущена',
    running: 'Виконує: {a}',
    waitingPermission: 'Чекає дозволу: {a}',
    probablyPermission: 'Ймовірно, чекає дозволу: {a}',
    subagentsWorking: 'Працюють субагенти: {a}',
  },
};

export function reasonText(r: Reason | null | undefined, lang: Lang): string | null {
  if (!r) return null;
  const s = REASONS[lang][r.k];
  return 'a' in r ? s.replace('{a}', String(r.a)) : s;
}

/** Internal event: like ClorbitEvent, but a status event carries a language-neutral Reason. */
type StatusEvent = Extract<ClorbitEvent, { kind: 'status' }>;
export type ServerEvent = Exclude<ClorbitEvent, StatusEvent> | (Omit<StatusEvent, 'reason'> & { reason: Reason | null });

export function localizeEvent(e: ServerEvent, lang: Lang): ClorbitEvent {
  return e.kind === 'status' ? { ...e, reason: reasonText(e.reason, lang), ...reasonCode(e.reason) } : e;
}

/** Language-neutral code and argument of a reason (for clients that compose their own text). */
export function reasonCode(r: Reason | null | undefined): { code: string | null; arg: string | null } {
  if (!r) return { code: null, arg: null };
  return { code: r.k, arg: 'a' in r ? String(r.a) : null };
}

// ---------- system notifications ----------

const NOTIFY: Record<Lang, Record<string, string>> = {
  en: {
    waitPermissionTool: '{p} is waiting for you: permission for {tool}',
    waitPermission: '{p} is waiting for you: permission',
    waitInput: '{p} is waiting for your reply',
    waitYou: '{p} is waiting for you',
    done: '{p}: answer ready',
    finished: '{p}: {agent} finished',
    finishedMany: '{p}: {n} subagents finished',
    spawned: '{p}: {agent} started',
    compaction: '{p}: context compacted',
    contextHigh: '{p}: context {pct}% full',
    limitHigh: 'Subscription limit ({w}): {pct}% used',
    w5h: '5 h',
    w7d: '7 days',
    subagent: 'a subagent',
    test: 'Test notification: this is how Clorbit will reach you.',
  },
  uk: {
    waitPermissionTool: '{p} чекає на тебе: дозвіл на {tool}',
    waitPermission: '{p} чекає на тебе: дозвіл',
    waitInput: '{p} чекає на твою відповідь',
    waitYou: '{p} чекає на тебе',
    done: '{p}: відповідь готова',
    finished: '{p}: {agent} завершив роботу',
    finishedMany: '{p}: завершено субагентів — {n}',
    spawned: '{p}: запущено {agent}',
    compaction: '{p}: контекст стиснуто',
    contextHigh: '{p}: контекст заповнено на {pct}%',
    limitHigh: 'Ліміт підписки ({w}): використано {pct}%',
    w5h: '5 год',
    w7d: '7 днів',
    subagent: 'субагент',
    test: 'Тестове сповіщення: так Clorbit кликатиме тебе.',
  },
};

/** Text of a notification body: `key` from the dictionary above with {name} placeholders. */
export function notifyText(lang: Lang, key: string, params: Record<string, string | number> = {}): string {
  const s = NOTIFY[lang][key] ?? NOTIFY.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

// ---------- startup context ----------

/**
 * Startup-context keys stored in file summaries. Plain keys name fixed sources;
 * `hook:plugin:<name>` is a plugin's SessionStart hook, `hook:event:<name>` any other hook's extra context.
 */
export const STARTUP = {
  skills: 'skills',
  mcp: 'mcp',
  deferred: 'deferred',
  agents: 'agents',
  claudeMd: 'claudeMd',
  system: 'system',
  toolDefs: 'toolDefs',
  env: 'env',
  other: 'other',
} as const;
export const hookPluginKey = (plugin: string) => `hook:plugin:${plugin}`;
export const hookEventKey = (name: string) => `hook:event:${name}`;
/** skillsByPlugin key for skills that do not belong to a plugin. */
export const OWN_SKILLS = '~own';

const STARTUP_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    skills: 'Skill listing', mcp: 'MCP instructions', deferred: 'Deferred tools', agents: 'Agent listing',
    claudeMd: 'CLAUDE.md', system: 'System prompt', toolDefs: 'Tool definitions', env: 'Environment & system reminders',
    other: 'Other attachments', hookPlugin: 'Plugin hook {a}', hookEvent: 'Hook {a} (additional context)', ownSkills: 'own skills',
  },
  uk: {
    skills: 'Список скілів', mcp: 'Інструкції MCP', deferred: 'Відкладені інструменти', agents: 'Список агентів',
    claudeMd: 'CLAUDE.md', system: 'Системний промпт', toolDefs: 'Визначення інструментів', env: 'Середовище та службові нагадування',
    other: 'Інші вкладення', hookPlugin: 'Хук плагіна {a}', hookEvent: 'Хук {a} (додатковий контекст)', ownSkills: 'власні скіли',
  },
};

// Summaries written by older builds stored Ukrainian labels as keys; map them to the current keys.
const LEGACY_STARTUP: Record<string, string> = {
  'Список скілів': STARTUP.skills, 'Інструкції MCP': STARTUP.mcp, 'Відкладені інструменти': STARTUP.deferred,
  'Список агентів': STARTUP.agents, 'CLAUDE.md': STARTUP.claudeMd, 'Системний промпт': STARTUP.system,
  'Визначення інструментів': STARTUP.toolDefs, 'Середовище та службові нагадування': STARTUP.env, 'Інші вкладення': STARTUP.other,
};

export function normalizeStartupKey(label: string): string {
  if (LEGACY_STARTUP[label]) return LEGACY_STARTUP[label];
  let m = /^Хук плагіна (.+)$/.exec(label);
  if (m) return hookPluginKey(m[1]);
  m = /^Хук ?(.*?) \(додатковий контекст\)$/.exec(label);
  if (m) return hookEventKey(m[1]);
  return label;
}

/** Rewrites legacy (Ukrainian) startup keys of a stored summary in place. */
export function migrateSummaryKeys(s: { startup: Record<string, number>; skillsByPlugin: Record<string, number> }): void {
  if (Object.keys(s.startup).some((k) => normalizeStartupKey(k) !== k)) {
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(s.startup)) {
      const nk = normalizeStartupKey(k);
      next[nk] = (next[nk] ?? 0) + v;
    }
    s.startup = next;
  }
  if ('власні скіли' in s.skillsByPlugin) {
    s.skillsByPlugin[OWN_SKILLS] = (s.skillsByPlugin[OWN_SKILLS] ?? 0) + s.skillsByPlugin['власні скіли'];
    delete s.skillsByPlugin['власні скіли'];
  }
}

export function startupLabel(key: string, lang: Lang): string {
  const L = STARTUP_LABELS[lang];
  if (key.startsWith('hook:plugin:')) return L.hookPlugin.replace('{a}', key.slice('hook:plugin:'.length));
  if (key.startsWith('hook:event:')) return L.hookEvent.replace('{a}', key.slice('hook:event:'.length)).replace('  ', ' ');
  return L[key] ?? key;
}

/** Category used by the web for colors: system, skills, hook, mcp, instructions, tools, agents, other. */
export function startupKind(key: string): string {
  if (key.startsWith('hook:')) return 'hook';
  switch (key) {
    case STARTUP.system: return 'system';
    case STARTUP.skills: return 'skills';
    case STARTUP.mcp: return 'mcp';
    case STARTUP.claudeMd: return 'instructions';
    case STARTUP.deferred:
    case STARTUP.toolDefs: return 'tools';
    case STARTUP.agents: return 'agents';
    default: return 'other';
  }
}

export function skillGroupLabel(key: string, lang: Lang): string {
  return key === OWN_SKILLS ? STARTUP_LABELS[lang].ownSkills : key;
}

// ---------- session detail ----------

const DETAIL = {
  en: {
    autoCompact: 'Context auto-compaction',
    compact: 'Context compaction',
    turnDone: (sec: number) => `Turn finished in ${sec >= 60 ? Math.floor(sec / 60) + 'm ' : ''}${sec % 60}s`,
    finished: (type: string | null) => `Finished: ${type ?? 'subagent'}`,
  },
  uk: {
    autoCompact: 'Автокомпакція контексту',
    compact: 'Компакція контексту',
    turnDone: (sec: number) => `Хід завершено за ${sec >= 60 ? Math.floor(sec / 60) + ' хв ' : ''}${sec % 60} с`,
    finished: (type: string | null) => `Завершено: ${type ?? 'субагент'}`,
  },
};

export function detailText(lang: Lang) {
  return DETAIL[lang];
}

/** Generic API error messages. */
const ERRORS = {
  en: { badSession: 'Invalid session id', notFound: 'Session not found', getOnly: 'GET only', unknownRoute: 'Unknown route', tooLarge: 'Request too large', forbidden: 'Only a local page can change settings', jsonOnly: 'Send JSON (content-type: application/json)', badJson: 'Invalid JSON' },
  uk: { badSession: 'Некоректний id сесії', notFound: 'Сесію не знайдено', getOnly: 'Лише GET', unknownRoute: 'Невідомий маршрут', tooLarge: 'Завеликий запит', forbidden: 'Змінювати налаштування може лише локальна сторінка', jsonOnly: 'Надішли JSON (content-type: application/json)', badJson: 'Некоректний JSON' },
};

export function errorText(lang: Lang) {
  return ERRORS[lang];
}
