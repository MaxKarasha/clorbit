import type {
  AgentNode,
  AnalyticsOverview,
  AttributionReport,
  DailyPoint,
  Insight,
  LiveSnapshot,
  Range,
  SessionDetail,
  SessionSummary,
  TimelineItem,
  Tokens,
  UsageRow,
} from '@shared/api';
import { locale, t, tp } from '../i18n';
import type enMock from '../i18n/en/mock';
import { rng, type Rng } from './rng';

// Demo data for `?mock=1`. Every project, path and task below is invented.
// Human-readable text is stored as dictionary keys and translated with t()/tp() on each call,
// so the demo follows the current UI language.

type MK = keyof typeof enMock;

// ---------- Dictionaries ----------

const PROJECTS: [string, number][] = [
  ['aurora-web', 9],
  ['billing-service', 7],
  ['docs-site', 6],
  ['mobile-api', 5],
  ['infra-k8s', 4],
  ['data-pipeline', 3],
  ['design-system', 2],
  ['cli-tools', 1.5],
  ['dotfiles', 0.7],
];

const cwdOf = (project: string) => `/home/dev/code/${project}`;

const MODELS: [string, number][] = [
  ['claude-opus-5-5', 6],
  ['claude-sonnet-4-6', 3],
  ['claude-opus-5-5[1m]', 1.2],
  ['claude-haiku-4-5', 0.8],
];

const EFFORTS: [string, number][] = [
  ['high', 5],
  ['xhigh', 2],
  ['medium', 2],
  ['max', 1],
  ['low', 0.5],
];

const TITLES: Record<string, MK[]> = {
  'aurora-web': ['mock.title.aurora.1', 'mock.title.aurora.2', 'mock.title.aurora.3'],
  'billing-service': ['mock.title.billing.1', 'mock.title.billing.2', 'mock.title.billing.3'],
  'docs-site': ['mock.title.docs.1', 'mock.title.docs.2'],
  'mobile-api': ['mock.title.mobile.1', 'mock.title.mobile.2', 'mock.title.mobile.3'],
  'infra-k8s': ['mock.title.infra.1', 'mock.title.infra.2'],
  'data-pipeline': ['mock.title.data.1', 'mock.title.data.2'],
  'design-system': ['mock.title.design.1', 'mock.title.design.2'],
  'cli-tools': ['mock.title.cli.1'],
  dotfiles: ['mock.title.dotfiles.1'],
};
const GENERIC_TITLES: MK[] = ['mock.title.any.1', 'mock.title.any.2'];

const TASKS: MK[] = [
  'mock.task.explore.1',
  'mock.task.explore.2',
  'mock.task.plan.1',
  'mock.task.review.2',
  'mock.task.test.2',
  'mock.task.general.2',
  'mock.task.web.2',
  'mock.task.sql.1',
];
const TEXTS: MK[] = ['mock.text.1', 'mock.text.2', 'mock.text.3', 'mock.text.4'];
const PROMPTS: MK[] = ['mock.prompt.1', 'mock.prompt.2', 'mock.prompt.3', 'mock.prompt.4'];

const SUBAGENT_TYPES = ['Explore', 'general-purpose', 'Plan', 'claude-code-guide', 'web-fetch', 'fork', 'code-reviewer'];
const TOOLS = ['Read', 'Bash', 'Edit', 'Grep', 'Glob', 'Write', 'Agent', 'Skill', 'ToolSearch', 'WebFetch', 'TodoWrite'];

const DAY = 86400000;

function parseDay(d: string): Date {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd);
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysOf(r: Range): string[] {
  const out: string[] = [];
  const end = parseDay(r.to).getTime();
  // step by calendar days, not by 24 h — otherwise a DST switch shifts the dates
  for (const d = parseDay(r.from); d.getTime() <= end; d.setDate(d.getDate() + 1)) out.push(dayKey(d));
  return out.length ? out : [r.to];
}

/** Turn duration in the server's format, e.g. '1m 5s'. */
function fmtSec(sec: number): string {
  return sec >= 60 ? t('mock.dur.minSec', { m: Math.floor(sec / 60), s: sec % 60 }) : t('mock.dur.sec', { s: sec });
}

function splitTokens(total: number, r: Rng): Tokens {
  const cacheRead = total * r.range(0.86, 0.94);
  const cacheWrite = total * r.range(0.04, 0.08);
  const output = total * r.range(0.008, 0.022);
  const input = Math.max(0, total - cacheRead - cacheWrite - output);
  return {
    input: Math.round(input),
    output: Math.round(output),
    cacheRead: Math.round(cacheRead),
    cacheWrite: Math.round(cacheWrite),
  };
}
const tsum = (t: Tokens) => t.input + t.output + t.cacheRead + t.cacheWrite;
function addTok(a: Tokens, b: Tokens): Tokens {
  return { input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite };
}
const zero = (): Tokens => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

// Hourly weights (local time): evening peak, night tail
const HOUR_W = [1.2, 0.8, 0.4, 0.15, 0.05, 0.05, 0.1, 0.3, 0.9, 1.8, 2.6, 3, 2.4, 2.2, 2.8, 3.1, 3.2, 2.9, 2.4, 2.6, 3.4, 3.8, 3.3, 2.2];

// ---------- Sessions ----------

/** A cached session: the title is kept as a dictionary key and translated on output. */
type SessionSeed = Omit<SessionSummary, 'title'> & { titleKey: MK | null };

const sessionCache = new Map<string, SessionSeed[]>();

function sessionsOfDay(day: string): SessionSeed[] {
  const hit = sessionCache.get(day);
  if (hit) return hit;
  const r = rng(`day:${day}`);
  const d = parseDay(day);
  const weekday = (d.getDay() + 6) % 7;
  const base = weekday >= 5 ? 4 : 9;
  const n = Math.max(1, Math.round(base + r.range(-3, 6)));
  const out: SessionSeed[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const hour = r.weighted(HOUR_W.map((w, h) => [h, w] as const));
    const startedAt = d.getTime() + hour * 3600000 + r.int(0, 3599) * 1000;
    if (startedAt > now) continue;
    const durationMs = Math.min(now - startedAt, Math.round(Math.exp(r.range(Math.log(4 * 60000), Math.log(5 * 3600000)))));
    const total = Math.round(Math.exp(r.range(Math.log(400_000), Math.log(42_000_000))) * (durationMs / 3600000 + 0.4));
    const tokens = splitTokens(total, r);
    const project = r.weighted(PROJECTS);
    const model = r.weighted(MODELS);
    const subagents = r.next() < 0.25 ? 0 : Math.round(r.range(1, 26) * (total / 12_000_000 + 0.3));
    const titleRoll = r.next();
    out.push({
      sessionId: `${r.id(8)}-${r.id(4)}-${r.id(4)}-${r.id(4)}-${r.id(12)}`,
      project,
      cwd: cwdOf(project),
      titleKey: titleRoll < 0.06 ? null : titleRoll < 0.2 ? r.pick(GENERIC_TITLES) : r.pick(TITLES[project] ?? GENERIC_TITLES),
      startedAt,
      endedAt: startedAt + durationMs,
      model,
      effort: r.weighted(EFFORTS),
      tokens,
      total: tsum(tokens),
      subagents,
      toolCalls: Math.round(total / r.range(18_000, 40_000)) + subagents * 12,
      compactions: total > 18_000_000 ? r.int(1, 4) : r.next() < 0.1 ? 1 : 0,
      durationMs,
    });
  }
  sessionCache.set(day, out);
  return out;
}

function toSummary({ titleKey, ...rest }: SessionSeed): SessionSummary {
  return { ...rest, title: titleKey ? t(titleKey) : null };
}

export function mockSessions(range: Range, project?: string | null): SessionSummary[] {
  const all = daysOf(range).flatMap(sessionsOfDay);
  const list = project ? all.filter((s) => s.project === project) : all;
  return list.map(toSummary).sort((a, b) => b.startedAt - a.startedAt);
}

// ---------- Overview ----------

function row(key: string, label: string, tokens: Tokens, rest: Partial<UsageRow> = {}): UsageRow {
  return { key, label, tokens, total: tsum(tokens), turns: 0, calls: 0, sessions: 0, ...rest };
}

export function mockOverview(range: Range): AnalyticsOverview {
  const days = daysOf(range);
  const sessions = mockSessions(range);
  const daily: DailyPoint[] = days.map((date) => ({ date, tokens: zero(), byModel: {}, byProject: {}, sessions: 0, subagents: 0, toolCalls: 0 }));
  const dayIdx = new Map(days.map((d, i) => [d, i]));
  const proj = new Map<string, UsageRow>();
  const mods = new Map<string, UsageRow>();
  const heat = new Map<string, number>();
  const hourly = new Array(24).fill(0);
  let compactions = 0;

  for (const s of sessions) {
    const dp = daily[dayIdx.get(dayKey(new Date(s.startedAt)))!];
    if (!dp) continue;
    dp.tokens = addTok(dp.tokens, s.tokens);
    dp.byModel[s.model!] = (dp.byModel[s.model!] ?? 0) + s.total;
    dp.byProject[s.project] = (dp.byProject[s.project] ?? 0) + s.total;
    dp.sessions++;
    dp.subagents += s.subagents;
    dp.toolCalls += s.toolCalls;
    compactions += s.compactions;
    const turns = Math.round(s.toolCalls * 0.9);
    for (const [map, key] of [[proj, s.project], [mods, s.model!]] as const) {
      const cur = map.get(key) ?? row(key, key, zero());
      cur.tokens = addTok(cur.tokens, s.tokens);
      cur.total = tsum(cur.tokens);
      cur.turns += turns;
      cur.calls += s.toolCalls;
      cur.sessions++;
      cur.lastUsed = Math.max(cur.lastUsed ?? 0, s.endedAt);
      cur.extra = { subagents: Number(cur.extra?.subagents ?? 0) + s.subagents };
      map.set(key, cur);
    }
    // spread the session across hours
    const hours = Math.max(1, Math.ceil(s.durationMs / 3600000));
    for (let h = 0; h < hours; h++) {
      const t = new Date(s.startedAt + h * 3600000);
      const wd = (t.getDay() + 6) % 7;
      const k = `${wd}:${t.getHours()}`;
      heat.set(k, (heat.get(k) ?? 0) + s.total / hours);
      hourly[t.getHours()] += s.total / hours;
    }
  }

  const totals = daily.reduce((acc, d) => addTok(acc, d.tokens), zero());
  const heatmap: AnalyticsOverview['heatmap'] = [];
  for (let wd = 0; wd < 7; wd++) for (let h = 0; h < 24; h++) heatmap.push({ weekday: wd, hour: h, total: Math.round(heat.get(`${wd}:${h}`) ?? 0) });

  return {
    range,
    totals: {
      ...totals,
      total: tsum(totals),
      sessions: sessions.length,
      subagents: daily.reduce((s, d) => s + d.subagents, 0),
      toolCalls: daily.reduce((s, d) => s + d.toolCalls, 0),
      compactions,
      projects: proj.size,
    },
    daily,
    projects: [...proj.values()].sort((a, b) => b.total - a.total),
    models: [...mods.values()].sort((a, b) => b.total - a.total),
    hourly: hourly.map(Math.round),
    heatmap,
  };
}

// ---------- Attribution ----------

interface Def {
  key: string;
  label?: string;
  group?: string;
  weight: number; // share of tokens
  calls: number; // calls per day
  sessions: number; // share of sessions
  extra?: Record<string, number | string>;
}

function rowsFrom(defs: Def[], r: Rng, scale: number, sessionsTotal: number, now: number, dayCount: number): UsageRow[] {
  return defs
    .map((d) => {
      const jitter = r.range(0.75, 1.25);
      const total = Math.round(d.weight * scale * jitter);
      const tokens = total > 0 ? splitTokens(total, r) : zero();
      const calls = Math.round(d.calls * dayCount * jitter);
      return {
        key: d.key,
        label: d.label ?? d.key,
        group: d.group,
        tokens,
        total: tsum(tokens),
        turns: Math.round(calls * r.range(1.1, 2.6)),
        calls,
        sessions: Math.min(sessionsTotal, Math.round(d.sessions * sessionsTotal)),
        lastUsed: calls > 0 ? now - Math.round(r.range(0.02, Math.min(dayCount, 9)) * DAY) : undefined,
        extra: d.extra,
      } satisfies UsageRow;
    })
    .sort((a, b) => b.total - a.total);
}

/** Localized label of a startup-context key (same scheme as the server). */
function ctxLabel(key: string): string {
  if (key.startsWith('hook:plugin:')) return t('mock.ctx.hookPlugin', { name: key.slice('hook:plugin:'.length) });
  if (key.startsWith('hook:event:')) return t('mock.ctx.hookEvent', { name: key.slice('hook:event:'.length) });
  return t(`mock.ctx.${key}` as MK);
}

/** Color category of a startup-context key. */
function ctxKind(key: string): string {
  if (key.startsWith('hook:')) return 'hook';
  switch (key) {
    case 'system':
      return 'system';
    case 'skills':
      return 'skills';
    case 'mcp':
      return 'mcp';
    case 'claudeMd':
      return 'instructions';
    case 'toolDefs':
    case 'deferred':
      return 'tools';
    case 'agents':
      return 'agents';
    default:
      return 'other';
  }
}

export function mockAttribution(range: Range): AttributionReport {
  const r = rng(`attr:${range.from}:${range.to}`);
  const ov = mockOverview(range);
  const T = ov.totals.total;
  const S = Math.max(1, ov.totals.sessions);
  const dc = daysOf(range).length;
  const now = Date.now();

  const skills = rowsFrom(
    [
      { key: 'superpowers:brainstorming', group: 'superpowers', weight: 0.052, calls: 1.6, sessions: 0.22, extra: { loads: 0 } },
      { key: 'frontend-design', weight: 0.041, calls: 0.9, sessions: 0.12 },
      { key: 'superpowers:writing-plans', group: 'superpowers', weight: 0.033, calls: 0.8, sessions: 0.1 },
      { key: 'superpowers:subagent-driven-development', group: 'superpowers', weight: 0.029, calls: 0.5, sessions: 0.07 },
      { key: 'hyperframes:hyperframes', group: 'hyperframes', weight: 0.024, calls: 0.35, sessions: 0.05 },
      { key: 'acme-tools:api-conventions', group: 'acme-tools', weight: 0.019, calls: 0.6, sessions: 0.09 },
      { key: 'claude-api', weight: 0.012, calls: 0.4, sessions: 0.06 },
      { key: 'dataviz', weight: 0.011, calls: 0.3, sessions: 0.05 },
      { key: 'ui-ux-pro-max:ui-ux-pro-max', group: 'ui-ux-pro-max', weight: 0.009, calls: 0.25, sessions: 0.04 },
      { key: 'release-notes', weight: 0.008, calls: 0.12, sessions: 0.02 },
      { key: 'superpowers:systematic-debugging', group: 'superpowers', weight: 0.007, calls: 0.3, sessions: 0.04 },
      { key: 'caveman:caveman', group: 'caveman', weight: 0.004, calls: 0.2, sessions: 0.03 },
      { key: 'acme-tools:db-migrations', group: 'acme-tools', weight: 0.003, calls: 0.08, sessions: 0.01 },
      { key: 'superpowers:verification-before-completion', group: 'superpowers', weight: 0.002, calls: 0.2, sessions: 0.03 },
      { key: 'cowork-plugin-management:create-cowork-plugin', group: 'cowork-plugin-management', weight: 0, calls: 0, sessions: 0 },
    ],
    r,
    T,
    S,
    now,
    dc,
  ).map((s) => ({ ...s, extra: { ...s.extra, loads: s.calls } }));

  const pluginDefs: Def[] = [
    { key: 'superpowers', weight: 0.13, calls: 3.6, sessions: 0.4 },
    { key: 'hyperframes', weight: 0.026, calls: 0.4, sessions: 0.05 },
    { key: 'ui-ux-pro-max', weight: 0.01, calls: 0.25, sessions: 0.04 },
    { key: 'caveman', weight: 0.005, calls: 0.2, sessions: 0.03 },
    { key: 'acme-tools', weight: 0.023, calls: 0.7, sessions: 0.1 },
    { key: 'claude-in-chrome', weight: 0.058, calls: 6, sessions: 0.08 },
    { key: 'github', weight: 0.006, calls: 0.6, sessions: 0.03 },
    { key: 'andrej-karpathy-skills', weight: 0.0005, calls: 0.02, sessions: 0.01 },
    { key: 'cowork-plugin-management', weight: 0, calls: 0, sessions: 0 },
  ];
  const plugins = rowsFrom(pluginDefs, r, T, S, now, dc);

  const mcpServers = rowsFrom(
    [
      { key: 'claude-in-chrome', weight: 0.058, calls: 6, sessions: 0.08 },
      { key: 'figma', weight: 0.021, calls: 1.4, sessions: 0.04 },
      { key: 'playwright', weight: 0.004, calls: 0.3, sessions: 0.01 },
      { key: 'github', weight: 0.006, calls: 0.6, sessions: 0.03 },
      { key: 'context7', weight: 0.005, calls: 0.7, sessions: 0.05 },
      { key: 'claude.ai Google Drive', weight: 0.002, calls: 0.2, sessions: 0.01 },
      { key: 'claude.ai Miro', weight: 0, calls: 0, sessions: 0 },
      { key: 'claude.ai Canva', weight: 0, calls: 0, sessions: 0 },
    ],
    r,
    T,
    S,
    now,
    dc,
  ).map((m) => ({ ...m, extra: { resultTokens: Math.round(m.total * r.range(0.04, 0.12)) } }));

  const mcpToolDefs: [string, string, number, number][] = [
    ['claude-in-chrome', 'computer', 0.022, 2.6],
    ['claude-in-chrome', 'read_page', 0.016, 1.2],
    ['claude-in-chrome', 'navigate', 0.007, 1.1],
    ['claude-in-chrome', 'find', 0.006, 0.6],
    ['claude-in-chrome', 'tabs_create_mcp', 0.002, 0.3],
    ['claude-in-chrome', 'read_console_messages', 0.005, 0.2],
    ['figma', 'get_design_context', 0.012, 0.6],
    ['figma', 'get_screenshot', 0.006, 0.5],
    ['figma', 'use_figma', 0.003, 0.3],
    ['playwright', 'browser_snapshot', 0.0025, 0.2],
    ['playwright', 'browser_click', 0.0015, 0.1],
    ['context7', 'get-library-docs', 0.004, 0.5],
    ['context7', 'resolve-library-id', 0.001, 0.2],
    ['github', 'search_code', 0.003, 0.3],
    ['github', 'get_pull_request', 0.003, 0.3],
    ['claude.ai Google Drive', 'read_file_content', 0.002, 0.2],
  ];
  const mcpTools = rowsFrom(
    mcpToolDefs.map(([server, tool, w, c]) => ({ key: `mcp__${server}__${tool}`, label: tool, group: server, weight: w, calls: c, sessions: c / 40 })),
    r,
    T,
    S,
    now,
    dc,
  );

  const toolDefs: [string, number, number, number, number][] = [
    // name, weight, calls/day, avgResult, maxResult
    ['Read', 0.21, 140, 2400, 26000],
    ['Bash', 0.16, 120, 1700, 48000],
    ['Edit', 0.09, 70, 380, 2200],
    ['Grep', 0.06, 55, 900, 31000],
    ['Agent', 0.12, 9, 2900, 14000],
    ['Glob', 0.02, 30, 300, 9000],
    ['Write', 0.03, 12, 160, 900],
    ['Skill', 0.04, 3, 4200, 11000],
    ['ToolSearch', 0.015, 6, 1900, 6400],
    ['WebFetch', 0.02, 4, 6100, 22000],
    ['TodoWrite', 0.006, 14, 120, 400],
    ['mcp__claude-in-chrome__computer', 0.022, 2.6, 1400, 3800],
    ['mcp__claude-in-chrome__read_page', 0.016, 1.2, 9800, 41000],
    ['mcp__figma__get_design_context', 0.012, 0.6, 12400, 38000],
  ];
  const tools = toolDefs
    .map(([name, w, cpd, avg, max]) => {
      const calls = Math.max(1, Math.round(cpd * dc * r.range(0.8, 1.2)));
      const tokens = splitTokens(Math.round(w * T * r.range(0.8, 1.2)), r);
      const a = Math.round(avg * r.range(0.85, 1.15));
      return {
        key: name,
        label: name,
        group: name.startsWith('mcp__') ? name.split('__')[1] : undefined,
        tokens,
        total: tsum(tokens),
        turns: Math.round(calls * 1.05),
        calls,
        sessions: Math.min(S, Math.round(S * Math.min(1, cpd / 20))),
        lastUsed: now - Math.round(r.range(0.01, 2) * DAY),
        extra: { resultTokens: a * calls, avgResult: a, maxResult: Math.round(max * r.range(0.8, 1.2)) },
      } satisfies UsageRow;
    })
    .sort((a, b) => b.total - a.total);

  const subDefs: [string, number, number, number, number][] = [
    // type, runs/day, avgTokens, avgDurationMs, maxDepth
    ['Explore', 14, 1_900_000, 140_000, 2],
    ['general-purpose', 9, 4_800_000, 420_000, 3],
    ['Plan', 2.5, 2_600_000, 260_000, 1],
    ['fork', 3, 7_400_000, 610_000, 2],
    ['claude-code-guide', 0.8, 900_000, 95_000, 1],
    ['web-fetch', 2.2, 380_000, 38_000, 2],
    ['code-reviewer', 1.1, 3_100_000, 330_000, 1],
    ['statusline-setup', 0.1, 260_000, 52_000, 1],
  ];
  const subagentTypes = subDefs
    .map(([type, rpd, avgT, avgD, depth]) => {
      const runs = Math.max(1, Math.round(rpd * dc * r.range(0.7, 1.3)));
      const avgTokens = Math.round(avgT * r.range(0.8, 1.2));
      const tokens = splitTokens(avgTokens * runs, r);
      return {
        key: type,
        label: type,
        tokens,
        total: tsum(tokens),
        turns: Math.round(runs * r.range(14, 60)),
        calls: runs,
        sessions: Math.min(S, Math.round(runs * r.range(0.25, 0.6))),
        lastUsed: now - Math.round(r.range(0.01, 3) * DAY),
        extra: { avgTokens, avgDurationMs: Math.round(avgD * r.range(0.8, 1.2)), maxDepth: depth },
      } satisfies UsageRow;
    })
    .sort((a, b) => b.total - a.total);

  const startupDefs: [string, number, number][] = [
    // key, tokens per session, share of sessions
    ['toolDefs', 11100, 1],
    ['skills', 6800, 1],
    ['mcp', 5800, 1],
    ['deferred', 4400, 1],
    ['hook:plugin:superpowers', 3900, 1],
    ['system', 3100, 1],
    ['claudeMd', 1650, 1],
    ['env', 1400, 1],
    ['agents', 1100, 1],
    ['hook:plugin:caveman', 900, 0.9],
    ['hook:plugin:acme-tools', 450, 0.6],
    ['hook:event:UserPromptSubmit', 300, 0.3],
    ['other', 250, 0.4],
  ];
  const startupContext = startupDefs
    .map(([key, per, share]) => {
      const sessions = Math.max(1, Math.round(S * share));
      const perSession = Math.round(per * r.range(0.95, 1.05));
      // every turn re-reads the startup context from the cache, so the real cost scales with turns
      const turnsPerSession = r.range(70, 110);
      const write = perSession * sessions;
      const read = perSession * sessions * turnsPerSession;
      const tokens: Tokens = { input: 0, output: 0, cacheRead: Math.round(read), cacheWrite: Math.round(write) };
      return {
        key,
        label: ctxLabel(key),
        group: key.startsWith('hook:plugin:') ? key.slice('hook:plugin:'.length) : undefined,
        tokens,
        total: tsum(tokens),
        turns: Math.round(sessions * turnsPerSession),
        calls: 0,
        sessions,
        extra: { perSession, kind: ctxKind(key) },
      } satisfies UsageRow;
    })
    .sort((a, b) => b.total - a.total);

  const attributed = [...skills, ...plugins.filter((p) => p.key === 'claude-in-chrome')].reduce((s, x) => s + x.total, 0);
  return {
    range,
    skills,
    plugins,
    mcpServers,
    mcpTools,
    tools,
    subagentTypes,
    startupContext,
    unattributedTotal: Math.max(0, T - attributed),
  };
}

// ---------- Session detail ----------

export function mockSessionDetail(id: string, range: Range): SessionDetail {
  const known = mockSessions(range).find((s) => s.sessionId === id);
  const r = rng(`session:${id}`);
  const now = Date.now();
  const summary: SessionSummary = known ?? {
    sessionId: id,
    project: 'aurora-web',
    cwd: cwdOf('aurora-web'),
    title: t('mock.title.aurora.1'),
    startedAt: now - 3 * 3600000,
    endedAt: now - 10 * 60000,
    model: 'claude-opus-5-5',
    effort: 'xhigh',
    tokens: splitTokens(28_400_000, r),
    total: 28_400_000,
    subagents: 14,
    toolCalls: 920,
    compactions: 2,
    durationMs: 3 * 3600000 - 10 * 60000,
  };
  const { startedAt, endedAt } = summary;
  const span = Math.max(60000, endedAt - startedAt);

  // agent tree; tasks are dealt in order from a random offset so siblings rarely repeat
  let counter = 0;
  const taskOffset = r.int(0, TASKS.length - 1);
  const mkNode = (depth: number, type: string, parentStart: number, budget: number): AgentNode => {
    const start = depth === 0 ? startedAt : parentStart + r.range(0.02, 0.6) * span;
    const dur = depth === 0 ? span : r.range(0.04, 0.22) * span;
    const tokens = splitTokens(budget, r);
    const node: AgentNode = {
      id: depth === 0 ? 'main' : `a${r.id(7)}`,
      type,
      description:
        depth === 0
          ? null
          : t(TASKS[(taskOffset + counter) % TASKS.length]),
      depth,
      status: 'done',
      model: depth === 0 ? summary.model : r.pick(['claude-opus-5-5', 'claude-sonnet-4-6', 'claude-haiku-4-5']),
      effort: depth === 0 ? summary.effort : r.pick(['medium', 'high', null]),
      currentTool: null,
      lastText: null,
      startedAt: Math.round(start),
      lastActivity: Math.round(Math.min(endedAt, start + dur)),
      tokens,
      toolCalls: Math.round(budget / r.range(20_000, 45_000)),
      finishedChildren: 0,
      children: [],
    };
    counter++;
    if (depth < 3) {
      const kids = depth === 0 ? Math.min(9, summary.subagents) : depth === 1 ? r.int(0, 3) : r.next() < 0.25 ? 1 : 0;
      for (let i = 0; i < kids && counter < 40; i++) {
        node.children.push(mkNode(depth + 1, depth === 0 ? r.pick(SUBAGENT_TYPES) : r.pick(['Explore', 'general-purpose', 'web-fetch']), start, budget * r.range(0.05, 0.22)));
      }
      node.finishedChildren = node.children.length;
    }
    return node;
  };
  const tree = mkNode(0, 'main', startedAt, summary.total * 0.55);

  // main-agent turns
  const turns = Math.max(24, Math.min(220, Math.round(summary.toolCalls / 4)));
  const limit = summary.model?.includes('[1m]') ? 1_000_000 : 200_000;
  const tokensSeries: SessionDetail['tokensSeries'] = [];
  let ctx = 24_000;
  let cum = 0;
  const compactAt = new Set<number>();
  for (let c = 0; c < summary.compactions; c++) compactAt.add(Math.round(((c + 1) / (summary.compactions + 1)) * turns));
  for (let i = 0; i < turns; i++) {
    const ts = startedAt + (span * i) / turns;
    if (compactAt.has(i)) ctx = r.range(18_000, 34_000);
    ctx = Math.min(limit * 0.96, ctx + r.range(200, 6_500) * (r.next() < 0.08 ? 6 : 1));
    cum += ctx + r.range(300, 2400);
    tokensSeries.push({ ts: Math.round(ts), total: Math.round(cum), context: Math.round(ctx) });
  }

  // timeline
  const timeline: TimelineItem[] = [];
  const agents: AgentNode[] = [];
  const walk = (n: AgentNode) => {
    agents.push(n);
    n.children.forEach(walk);
  };
  walk(tree);
  const nEvents = Math.min(2000, Math.max(120, summary.toolCalls + turns));
  let compI = 0;
  const compTs = [...compactAt].map((i) => tokensSeries[i]?.ts ?? 0);
  for (let i = 0; i < nEvents; i++) {
    const ts = Math.round(startedAt + (span * i) / nEvents);
    const ag = r.next() < 0.6 ? tree : r.pick(agents);
    const roll = r.next();
    if (compI < compTs.length && ts >= compTs[compI]) {
      timeline.push({ ts, agentId: 'main', kind: 'compact', label: t('mock.tl.autoCompact') });
      compI++;
      continue;
    }
    if (i === 0 || roll < 0.03) {
      timeline.push({ ts, agentId: 'main', kind: 'prompt', label: t(r.pick(PROMPTS)) });
    } else if (roll < 0.1) {
      timeline.push({ ts, agentId: ag.id, kind: 'turn', label: t('mock.tl.turnDone', { d: fmtSec(r.int(6, 260)) }), tokens: Math.round(r.range(20_000, 180_000)) });
    } else if (roll < 0.17) {
      timeline.push({ ts, agentId: ag.id, kind: 'text', label: t(r.pick(TEXTS)) });
    } else if (roll < 0.19 && ag.children.length) {
      const ch = r.pick(ag.children);
      timeline.push({ ts, agentId: ag.id, kind: 'spawn', label: `${ch.type}: ${ch.description ?? ''}` });
    } else if (roll < 0.21 && ag.depth > 0) {
      timeline.push({ ts, agentId: ag.id, kind: 'finish', label: t('mock.tl.finished', { type: ag.type }), tokens: tsum(ag.tokens) });
    } else {
      const tool = r.weighted([['Read', 5], ['Bash', 4], ['Edit', 3], ['Grep', 2], ['Glob', 1], ['Write', 0.6], ['Agent', 0.4]] as const);
      const arg =
        tool === 'Bash'
          ? `: ${r.pick(['pnpm build', 'pnpm test', 'git status', 'npx tsc --noEmit -p .', 'ls src/webhooks'])}`
          : tool === 'Grep'
            ? ` "${r.pick(['useAuth', 'rateLimit', 'idempotencyKey', 'retryAfter'])}"`
            : ` ${r.pick(['src/webhooks/stripe.ts', 'src/lib/api-client.ts', 'src/app/checkout/page.tsx', 'src/middleware/rate-limit.ts', 'package.json'])}`;
      timeline.push({ ts, agentId: ag.id, kind: 'tool', label: `${tool}${arg}` });
    }
  }

  const context = (
    [
      ['toolDefs', 11100],
      ['skills', 6800],
      ['mcp', 5800],
      ['deferred', 4400],
      ['hook:plugin:superpowers', 3900],
      ['system', 3100],
      ['claudeMd', 2000],
      ['env', 1400],
      ['agents', 1100],
    ] as const
  ).map(([key, tokens]) => ({ key, label: ctxLabel(key), tokens }));

  const toolRows: UsageRow[] = TOOLS.map((t) => {
    const calls = r.int(1, Math.max(2, Math.round(summary.toolCalls / 4)));
    const tokens = splitTokens(calls * r.range(8_000, 40_000), r);
    const avg = Math.round(r.range(150, 5000));
    return {
      key: t,
      label: t,
      tokens,
      total: tsum(tokens),
      turns: calls,
      calls,
      sessions: 1,
      lastUsed: endedAt - r.int(0, 3600) * 1000,
      extra: { resultTokens: avg * calls, avgResult: avg, maxResult: Math.round(avg * r.range(2, 9)) },
    };
  }).sort((a, b) => b.calls - a.calls);

  return { summary, tree, timeline, context, tools: toolRows, tokensSeries };
}

// ---------- Insights ----------

export function mockInsights(range: Range): Insight[] {
  const at = mockAttribution(range);
  const S = mockOverview(range).totals.sessions;
  const num = (n: number) => Math.round(n).toLocaleString(locale());
  const sp = at.startupContext.find((x) => x.key === 'hook:plugin:superpowers');
  const mcp = at.startupContext.find((x) => x.key === 'mcp');
  const PLAYWRIGHT_PER_SESSION = 2100; // playwright's share of the MCP instructions
  const mcpShare = mcp ? PLAYWRIGHT_PER_SESSION / Math.max(1, Number(mcp.extra?.perSession ?? 5800)) : 0;
  const bash = at.tools.find((x) => x.key === 'Bash');
  return [
    {
      id: 'startup-superpowers',
      severity: 'high',
      title: t('mock.ins.superpowers.title'),
      detail: t('mock.ins.superpowers.detail'),
      evidence: [
        tp('mock.ins.superpowers.loaded', S, { a: sp?.sessions ?? S }),
        tp('mock.ins.superpowers.used', at.plugins.find((p) => p.key === 'superpowers')?.sessions ?? 0),
        t('mock.ins.superpowers.reread'),
      ],
      fix: `// ~/.claude/settings.json — ${t('mock.ins.superpowers.fixComment')}\n{\n  "enabledPlugins": {\n    "superpowers@claude-plugins-official": false\n  }\n}`,
      estSavingTokens: sp ? Math.round(sp.total * 0.6) : undefined,
    },
    {
      id: 'mcp-playwright-rare',
      severity: 'high',
      title: t('mock.ins.mcpRare.title'),
      detail: t('mock.ins.mcpRare.detail'),
      evidence: [
        t('mock.ins.mcpRare.perSession', { n: num(PLAYWRIGHT_PER_SESSION) }),
        t('mock.ins.mcpRare.calls', { n: num(at.mcpServers.find((m) => m.key === 'playwright')?.calls ?? 0) }),
      ],
      fix: `claude mcp remove playwright --scope user\n# ${t('mock.ins.mcpRare.fixComment')}\nclaude mcp add playwright --scope project …`,
      estSavingTokens: mcp ? Math.round(mcp.total * mcpShare * 0.9) : undefined,
    },
    {
      id: 'mcp-unused',
      severity: 'warn',
      title: t('mock.ins.mcpUnused.title'),
      detail: t('mock.ins.mcpUnused.detail'),
      evidence: [t('mock.ins.mcpUnused.calls', { name: 'claude.ai Miro' }), t('mock.ins.mcpUnused.calls', { name: 'claude.ai Canva' })],
      fix: t('mock.ins.mcpUnused.fix'),
      estSavingTokens: Math.round(400 * S * 80),
    },
    {
      id: 'bash-results',
      severity: 'warn',
      title: t('mock.ins.bash.title'),
      detail: t('mock.ins.bash.detail'),
      evidence: [
        t('mock.ins.bash.max', { n: num(Number(bash?.extra?.maxResult ?? 48000)) }),
        t('mock.ins.bash.avg', { n: num(Number(bash?.extra?.avgResult ?? 1700)) }),
        t('mock.ins.bash.often'),
      ],
      fix: 'pnpm build 2>&1 | tail -40\ngit diff --stat && git diff -- path/to/file',
      estSavingTokens: 2_400_000,
    },
    {
      id: 'compactions',
      severity: 'warn',
      title: t('mock.ins.compact.title', { project: 'aurora-web' }),
      detail: t('mock.ins.compact.detail'),
      evidence: [tp('mock.ins.compact.count', 9), t('mock.ins.compact.avg')],
      fix: t('mock.ins.compact.fix'),
    },
    {
      id: 'reread',
      severity: 'info',
      title: t('mock.ins.reread.title'),
      detail: t('mock.ins.reread.detail'),
      evidence: [
        tp('mock.ins.reread.reads', 46, { file: 'src/lib/api-client.ts' }),
        tp('mock.ins.reread.reads', 31, { file: 'src/app/layout.tsx' }),
        tp('mock.ins.reread.reads', 28, { file: 'package.json' }),
      ],
    },
    {
      id: 'cache',
      severity: 'info',
      title: t('mock.ins.cache.title'),
      detail: t('mock.ins.cache.detail'),
      evidence: [t('mock.ins.cache.share')],
    },
  ];
}

// ---------- Live snapshot ----------

const bootAt = Date.now();
export function mockLive(simulateScan: boolean): LiveSnapshot {
  const now = Date.now();
  const total = 1430;
  const filesDone = simulateScan ? Math.min(total, Math.round(((now - bootAt) / 60000) * total)) : total;
  const t = splitTokens(186_000_000, rng('live'));
  return {
    now,
    sessions: [],
    totals: {
      tokens24h: t,
      tokensToday: t,
      burnPerMin: 182_000,
      burnSeries: Array.from({ length: 30 }, (_, i) => 120_000 + Math.sin(i / 3) * 60_000),
      activeSessions: 4,
      workingSessions: 2,
      waitingSessions: 1,
      workingSubagents: 5,
      finishedSubagents24h: 212,
      cacheHitRate24h: 0.918,
      projects24h: 5,
    },
    limits: null,
    hooksInstalled: false,
    statuslineCapture: false,
    scan: { done: filesDone >= total, filesTotal: total, filesDone },
  };
}
