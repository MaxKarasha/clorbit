// Shared contract between the server (server/) and the web app (web/).
// All timestamps are epoch milliseconds. All dates are local 'YYYY-MM-DD'.
// Tokens are taken from message.usage in Claude Code transcripts, deduplicated by requestId.
// Human-readable strings produced by the server follow the `lang` query parameter ('en' | 'uk', default 'en').

export interface Tokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export type AgentStatus = 'working' | 'waiting' | 'idle' | 'done';
export type SessionStatus = 'working' | 'waiting' | 'idle' | 'stopped';

/** Agent tree node. The root is the session's main agent (id 'main', depth 0). */
export interface AgentNode {
  id: string;                 // 'main' or the subagent's agentId (from the agent-<id>.jsonl file name)
  type: string;               // 'main' or agentType from meta ('Explore', 'Plan', 'general-purpose', ...)
  description: string | null; // task given by the parent (meta.description)
  depth: number;              // 0 = main, 1..3 = subagents
  status: AgentStatus;
  model: string | null;       // e.g. 'claude-opus-5-5'
  effort: string | null;      // 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null
  currentTool: string | null; // short label of the latest call, e.g. 'Grep "useAuth"', 'Bash: pnpm test'
  lastText: string | null;    // latest assistant text (not thinking), up to 240 chars
  startedAt: number;
  lastActivity: number;
  tokens: Tokens;
  toolCalls: number;
  finishedChildren: number;   // how many direct subagents have finished
  children: AgentNode[];      // active (unfinished) direct subagents only
}

export interface LiveSession {
  sessionId: string;
  pid: number | null;
  alive: boolean;               // the process is alive (sessions/<pid>.json + pid check)
  title: string | null;         // latest ai-title
  name: string | null;          // name from sessions/<pid>.json
  cwd: string;
  project: string;              // basename(cwd)
  gitBranch: string | null;
  model: string | null;
  effort: string | null;
  permissionMode: string | null;
  status: SessionStatus;
  statusSince: number;
  statusReason: string | null;  // e.g. 'Probably waiting for permission: Bash', 'Answer ready' (localized)
  statusCode?: string | null;   // language-neutral reason code ('waitingPermission', 'answerReady', ...)
  statusArg?: string | null;    // its argument, e.g. the tool name of 'waitingPermission'
  startedAt: number;
  lastActivity: number;
  tokens: Tokens;               // the whole session, subagents included
  tokens24h: number;            // sum of all Tokens fields over the last 24 h
  contextTokens: number | null; // input + cacheRead + cacheWrite of the main agent's latest turn
  contextLimit: number | null;  // 200000 or 1000000 depending on the model / [1m] suffix; null if unknown
  subagentsTotal: number;       // all subagents of the session (finished included)
  subagentsActive: number;
  compactions: number;
  root: AgentNode;
  /** 'automated' for runs nobody types into: `claude -p` from scripts/CI, the Agent SDK, GitHub Actions,
   *  scheduled routines (entrypoint `sdk-*` / `*github-action` / `mcp` / `remote_trigger`, a daemon process, or a
   *  first turn sent by the SDK or a scheduler). Additive: absent from servers older than 0.2.1 (treat as interactive). */
  kind?: SessionKind;
  /** Claude Code's entrypoint of the session ('cli', 'sdk-cli', 'sdk-ts', 'claude-vscode', ...), when known. */
  entrypoint?: string | null;
}

export type SessionKind = 'interactive' | 'automated';

export interface Limits {
  fiveHourPct: number | null;
  fiveHourResetsAt: number | null;
  sevenDayPct: number | null;
  sevenDayResetsAt: number | null;
  updatedAt: number;
}

/** One recorded change of subscription limits (from the statusline capture).
 *  The reset times are additive (absent from servers older than 0.3): they tell windows apart. */
export interface LimitsPoint {
  ts: number;
  fiveHourPct: number | null;
  sevenDayPct: number | null;
  fiveHourResetsAt?: number | null;
  sevenDayResetsAt?: number | null;
}

export type LimitWindow = '5h' | '7d';
export type ForecastConfidence = 'low' | 'medium' | 'high';
/** What a forecast is based on: the limits history itself, transcript tokens calibrated against it, or nothing. */
export type ForecastBasis = 'limits' | 'tokens' | 'none';

/** Forecast of one subscription window (see shared/forecast.ts). Percentages are 0..100. */
export interface WindowForecast {
  window: LimitWindow;
  pct: number | null;          // latest used % (0 once the reset time has passed)
  resetsAt: number | null;     // null when unknown or already passed
  ratePerHour: number;         // estimated burn, % per hour (>= 0)
  hitsAt: number | null;       // projected time of reaching 100%; null = lasts until the reset (or no forecast)
  pctAtReset: number | null;   // projected % at the reset (capped at 100); null = no forecast
  confidence: ForecastConfidence;
  basis: ForecastBasis;
  points: number;              // limit points of the current window the forecast used
  exhausted?: boolean;         // already at 100%
  reset?: boolean;             // the last known reset time has passed; waiting for fresh data
}

/** GET /api/limits/forecast (also LiveSnapshot.limitsForecast). */
export interface LimitsForecast {
  source: 'statusline' | 'none';
  now: number;
  updatedAt: number | null;    // when the status line last wrote the values
  fiveHour: WindowForecast;
  sevenDay: WindowForecast;
}

export interface LiveSnapshot {
  now: number;
  sessions: LiveSession[];      // live ones + those active within the last 24 h
  totals: {
    tokens24h: Tokens;
    tokensToday: Tokens;
    burnPerMin: number;         // tokens/min (all fields) over the last 10 min
    burnSeries: number[];       // 30 one-minute points, oldest first (sparkline)
    activeSessions: number;     // live processes
    workingSessions: number;
    waitingSessions: number;
    workingSubagents: number;
    finishedSubagents24h: number;
    cacheHitRate24h: number;    // cacheRead / (input + cacheRead + cacheWrite), 0..1
    projects24h: number;
  };
  limits: Limits | null;        // null when there is no source (the status line does not save its input)
  /** Additive (0.3+): the forecast of both windows, so the HUD needs no extra request. */
  limitsForecast?: LimitsForecast | null;
  hooksInstalled: boolean;
  statuslineCapture: boolean;
  scan: { done: boolean; filesTotal: number; filesDone: number };
}

export type ClorbitEvent =
  | { kind: 'tool'; ts: number; sessionId: string; agentId: string; tool: string; label: string }
  | { kind: 'spawn'; ts: number; sessionId: string; parentId: string; agentId: string; agentType: string; description: string | null }
  | { kind: 'finish'; ts: number; sessionId: string; agentId: string; parentId: string; tokens: number }
  | { kind: 'status'; ts: number; sessionId: string; status: SessionStatus; reason: string | null; code?: string | null; arg?: string | null }
  | { kind: 'text'; ts: number; sessionId: string; agentId: string; text: string }
  | { kind: 'prompt'; ts: number; sessionId: string }
  | { kind: 'compact'; ts: number; sessionId: string };

/** Names resolved by the server when an event is emitted, so old console lines stay meaningful
 *  after a session or agent is gone. Additive: SSE events and /api/events/recent carry them. */
export interface EventContext {
  project?: string | null;    // the session's project
  agentName?: string | null;  // type of e.agentId ('main' → null: the manager)
  parentName?: string | null; // spawn/finish: type of e.parentId
  automated?: boolean;        // the session is an automated run (LiveSession.kind === 'automated')
}
export type RecentEvent = ClorbitEvent & EventContext;

/** @deprecated Pre-rename alias of ClorbitEvent. */
export type FleetEvent = ClorbitEvent;

// ---------- Analytics ----------

export interface Range { from: string; to: string } // inclusive, 'YYYY-MM-DD'

export interface DailyPoint {
  date: string;
  tokens: Tokens;
  byModel: Record<string, number>;   // model → token total
  byProject: Record<string, number>; // project → token total
  sessions: number;
  subagents: number;
  toolCalls: number;
}

/** Generic ranking row. total = input + output + cacheRead + cacheWrite. */
export interface UsageRow {
  key: string;
  label: string;
  group?: string;          // e.g. the plugin of a skill, the server of an MCP tool
  tokens: Tokens;
  total: number;
  turns: number;           // API turns
  calls: number;           // tool calls / runs
  sessions: number;        // number of sessions it appeared in
  lastUsed?: number;
  extra?: Record<string, number | string>;
}

export interface AnalyticsOverview {
  range: Range;
  totals: Tokens & { total: number; sessions: number; subagents: number; toolCalls: number; compactions: number; projects: number };
  daily: DailyPoint[];
  projects: UsageRow[];
  models: UsageRow[];
  hourly: number[];                                         // 24 values: token total by hour of day
  heatmap: { weekday: number; hour: number; total: number }[]; // weekday 0 = Monday
}

export interface AttributionReport {
  range: Range;
  skills: UsageRow[];          // by attributionSkill; extra.loads = how many times Skill was invoked
  plugins: UsageRow[];         // by attributionPlugin (+ the plugin's skills/MCP)
  mcpServers: UsageRow[];      // by attributionMcpServer; extra.resultTokens
  mcpTools: UsageRow[];        // group = server
  tools: UsageRow[];           // all tools; extra.resultTokens, avgResult, maxResult
  subagentTypes: UsageRow[];   // extra.avgTokens, avgDurationMs, maxDepth
  /** Startup context. key: 'system' | 'toolDefs' | 'skills' | 'mcp' | 'deferred' | 'agents' | 'claudeMd' | 'env' | 'other'
   *  | 'hook:plugin:<name>' | 'hook:event:<name>'; label is localized; extra.perSession / perSubagent are token estimates;
   *  extra.kind is a color category (system, skills, hook, mcp, instructions, tools, agents, other); group = plugin of a hook row. */
  startupContext: UsageRow[];
  unattributedTotal: number;   // tokens without attribution (regular work)
}

export interface SessionSummary {
  sessionId: string;
  project: string;
  cwd: string;
  title: string | null;
  startedAt: number;
  endedAt: number;
  model: string | null;
  effort: string | null;
  tokens: Tokens;
  total: number;
  subagents: number;
  toolCalls: number;
  compactions: number;
  durationMs: number;
}

export interface TimelineItem {
  ts: number;
  agentId: string;
  kind: 'prompt' | 'tool' | 'spawn' | 'finish' | 'text' | 'compact' | 'turn';
  label: string;
  tokens?: number;
}

export interface SessionDetail {
  summary: SessionSummary;
  tree: AgentNode;              // full tree, finished agents included (status 'done')
  timeline: TimelineItem[];     // up to the 2000 latest events
  context: { label: string; tokens: number; key?: string }[]; // startup context breakdown (estimate); key as in startupContext
  tools: UsageRow[];
  tokensSeries: { ts: number; total: number; context: number }[]; // per main-agent turn
  /** true when every transcript of the session is gone from disk (Claude Code's cleanup):
   *  summary, tree, context and tools come from stored summaries; timeline and tokensSeries are empty. */
  archived?: boolean;
}

export interface Insight {
  id: string;
  severity: 'info' | 'warn' | 'high';
  title: string;
  detail: string;
  evidence: string[];
  fix?: string;            // a concrete action / config snippet to copy
  estSavingTokens?: number;
}

// ---------- Settings & notifications ----------

/** Events Clorbit can notify about. */
export type NotifyEventType =
  | 'session_waiting'   // a session waits for you: permission prompt / question
  | 'session_done'      // the main agent finished its turn (answer ready)
  | 'subagent_finished'
  | 'subagent_spawned'
  | 'compaction'
  | 'context_high'      // context fill crossed 85%
  | 'limit_high'        // subscription 5 h or 7 d window crossed 80%
  | 'limit_forecast';   // the forecast says the 5 h window runs out well before its reset

export const NOTIFY_EVENTS: NotifyEventType[] = ['session_waiting', 'session_done', 'subagent_finished', 'subagent_spawned', 'compaction', 'context_high', 'limit_high', 'limit_forecast'];

export type NotifyChannel = 'sound' | 'browser' | 'toast' | 'system';

/** Channels per event. `system` is shown by the server itself (osascript / notify-send). */
export interface NotifyRule {
  sound: boolean;
  browser: boolean;
  /** Browser notification only while the Clorbit tab is hidden. */
  browserHiddenOnly: boolean;
  toast: boolean;
  system: boolean;
}

export type SoundTheme = 'orbit' | 'minimal' | 'retro';
export const SOUND_THEMES: SoundTheme[] = ['orbit', 'minimal', 'retro'];

export interface Settings {
  notifications: Record<NotifyEventType, NotifyRule>;
  sound: { enabled: boolean; volume: number; theme: SoundTheme }; // volume 0..1
  dnd: {
    enabled: boolean;                                         // silence now (until turned off)
    quietHours: { enabled: boolean; from: string; to: string }; // local 'HH:MM'; may cross midnight
    mutedUntil: number | null;                                // "mute for 1 h" from a toast (epoch ms)
  };
  /** showAutomated: automated sessions (claude -p, SDK, CI) are separate stars and may notify;
   *  off (default) — they join their project's cluster, are grouped in the console and never notify. */
  interface: { lang: 'en' | 'uk'; autoTour: boolean; reduceMotion: boolean; showAutomated: boolean };
  /** Galaxy layout. gravity: working and waiting sessions drift to the centre (default on).
   *  pins: bodies the user dragged into place, keyed 'star:<project>:<sessionId>' or 'cluster:<project>';
   *  positions are fractions (0..1) of the galaxy's width and height, so they do not depend on the screen.
   *  A PUT replaces the whole pins map (that is how a pin is removed); at most MAX_PINS (shared/settings.ts). */
  layout: { gravity: boolean; pins: Record<string, LayoutPin> };
}

/** A pinned body's position: fractions of the galaxy's width and height. */
export interface LayoutPin { x: number; y: number }

const rule = (sound: boolean, browser: boolean, toast: boolean, browserHiddenOnly = false): NotifyRule => ({ sound, browser, browserHiddenOnly, toast, system: false });

/** Defaults: waiting → sound + browser + toast; done → sound + toast + browser when the tab is hidden;
 *  a finished subagent → a soft sound; everything else off; system notifications off. */
export const DEFAULT_SETTINGS: Settings = {
  notifications: {
    session_waiting: rule(true, true, true),
    session_done: rule(true, true, true, true),
    subagent_finished: rule(true, false, false),
    subagent_spawned: rule(false, false, false),
    compaction: rule(false, false, false),
    context_high: rule(false, false, false),
    limit_high: rule(false, false, false),
    limit_forecast: rule(true, false, true),
  },
  sound: { enabled: true, volume: 0.6, theme: 'orbit' },
  dnd: { enabled: false, quietHours: { enabled: false, from: '22:00', to: '08:00' }, mutedUntil: null },
  interface: { lang: 'en', autoTour: false, reduceMotion: false, showAutomated: false },
  layout: { gravity: true, pins: {} },
};

/** GET /api/about — read-only facts for the Connection section of the settings panel. */
export interface AboutInfo {
  version: string;
  dataDir: string;
  hooks: { pluginEnabled: boolean; eventsReceived: boolean; lastEventAt: number | null };
  limits: { capture: boolean; updatedAt: number | null };
  store: { enabled: boolean; fileSummaries: number; archived: number; hookEvents: number; limits: number };
  /** Whether the server can show system notifications on this machine. */
  system: { available: boolean; tool: 'osascript' | 'notify-send' | null; platform: string };
}

// Endpoints (all GET except /api/hook, PUT /api/settings and POST /api/notify/test). Every GET accepts `lang=en|uk` (default en):
//   /api/health                                 → HealthInfo (identifies a running Clorbit; used by the CLI)
//   /api/live                                   → LiveSnapshot
//   /api/events                                 → SSE, each message is data: ClorbitEvent (& EventContext)
//   /api/events/recent?limit=                   → RecentEvent[] (oldest first; the last ≤ 500 console-worthy events, in memory)
//   /api/analytics/overview?from&to             → AnalyticsOverview
//   /api/analytics/attribution?from&to          → AttributionReport
//   /api/analytics/sessions?from&to&project     → SessionSummary[]
//   /api/session/:id                            → SessionDetail
//   /api/insights?from&to                       → Insight[]
//   /api/limits/history?from&to                 → LimitsPoint[] (from/to: 'YYYY-MM-DD' or epoch ms; default last 7 days)
//   /api/limits/forecast                        → LimitsForecast (source 'none' without the status-line capture)
//   /api/debug/scan, /api/debug/db              → diagnostics (scan stats; SQLite row counts, size, archived files)
//   POST /api/hook                              → accepts Claude Code hook JSON (stored in SQLite, 90-day retention)
//   /api/settings                               → Settings (defaults merged with what was saved)
//   PUT /api/settings                           → body: a (partial) Settings; validated, clamped, unknown keys dropped → Settings
//   /api/about                                  → AboutInfo
//   POST /api/notify/test                       → shows one test system notification ({ ok, error? })

/** GET /api/health — cheap identity check used by `clorbit status|start|stop`. */
export interface HealthInfo {
  app: 'clorbit';
  version: string;
  pid: number;
  port: number;
  dataDir: string;
  uptimeMs: number;
}
