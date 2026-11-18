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

/** Whether a subscription window exists: reported by the status line ('present'), known to be absent
 *  ('none' — e.g. plans with only a weekly limit), or not known. */
export type WindowPresence = 'present' | 'none' | 'unknown';

export interface Limits {
  fiveHourPct: number | null;
  fiveHourResetsAt: number | null;
  sevenDayPct: number | null;
  sevenDayResetsAt: number | null;
  updatedAt: number;
  /** Additive (0.3+): 'none' when the status line reports the 7-day window but no 5-hour one. */
  fiveHourWindow?: WindowPresence;
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
  noWindow?: boolean;          // additive (0.3+): the plan has no such window (the status line reports none)
}

/** GET /api/limits/forecast (also LiveSnapshot.limitsForecast). */
export interface LimitsForecast {
  source: 'statusline' | 'none';
  now: number;
  updatedAt: number | null;    // when the status line last wrote the values
  fiveHour: WindowForecast;
  sevenDay: WindowForecast;
}

/** The signed-in Claude subscription, from `oauthAccount` in ~/.claude.json (only the plan fields are read).
 *  Additive (0.3+): absent from older servers; null when Claude Code is not signed in with a subscription. */
export interface Plan {
  name: string | null;   // planDisplayName, e.g. 'Max', 'Pro' (or derived from the organization type)
  tier: string | null;   // rate-limit multiplier from the rate-limit tier, e.g. '20×', '5×'
  type: string | null;   // organizationType, e.g. 'claude_max'
  since: string | null;  // subscriptionCreatedAt (ISO 8601)
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
  /** Additive (0.3+): the subscription plan; null without a signed-in subscription. */
  plan?: Plan | null;
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

// ---------- Replay (time machine) ----------

/**
 * One event of a session replay (GET /api/session/:id/replay). Timestamps are the original ones (epoch ms).
 * The list is time-ordered (see shared/replay.ts `sortReplayEvents`); the state at any moment is a pure
 * function of the list and that moment (`replayStateAt`).
 * - spawn/finish: a subagent is born (from its parent's Agent call) / returns its result (its token total);
 * - tool: a tool call of an agent (short label, as in AgentNode.currentTool); Agent calls appear as spawns;
 * - text: a short assistant text (≤ 160 chars);
 * - prompt: a user prompt of the main agent (≤ 160 chars);
 * - compact: a compaction (auto or manual, tokens before it when known);
 * - status: the session's status changed (working / waiting / idle), with a localized reason and its code;
 * - tokens: one API turn of an agent ([input, output, cacheRead, cacheWrite]); `context` = the main agent's
 *   context size after that turn (input + cacheRead + cacheWrite); on sampled lists a turn may stand for several.
 */
export type ReplayEvent =
  | { kind: 'spawn'; ts: number; agentId: string; parentId: string; agentType: string; description: string | null; model?: string | null; effort?: string | null }
  | { kind: 'finish'; ts: number; agentId: string; tokens: number }
  | { kind: 'tool'; ts: number; agentId: string; label: string }
  | { kind: 'text'; ts: number; agentId: string; text: string }
  | { kind: 'prompt'; ts: number; text: string }
  | { kind: 'compact'; ts: number; auto: boolean; preTokens: number | null }
  | { kind: 'status'; ts: number; status: SessionStatus; reason: string | null; code: string | null; arg: string | null }
  | { kind: 'tokens'; ts: number; agentId: string; t: [number, number, number, number]; context?: number };

export type ReplayEventKind = ReplayEvent['kind'];

/** GET /api/session/:id/replay — everything needed to replay a session in the galaxy. */
export interface SessionReplay {
  sessionId: string;
  project: string;
  cwd: string;
  title: string | null;
  model: string | null;
  effort: string | null;
  /** 200000 or 1000000 (from the model / [1m] / the peak context); null if unknown. */
  contextLimit: number | null;
  startedAt: number;
  /** The last event; for a live session, the moment the replay was built. */
  endedAt: number;
  /** The session's process was alive when the replay was built: it ends at "now" (see generatedAt). */
  live: boolean;
  generatedAt: number;
  /** Every transcript is gone from disk: structure only (agents, their lifetimes, hourly tokens), no fine timeline. */
  archived?: boolean;
  /** Present when the list was capped (REPLAY_MAX_EVENTS): [kept, total] per sampled kind. Structural events are never dropped. */
  sampled?: { tool: [number, number]; text: [number, number]; tokens: [number, number] };
  events: ReplayEvent[];
}

// ---------- Agent changes ("what did this agent change?") ----------

/**
 * A capped diff preview of one change. `lines` start with ' ' (context), '-' (removed) or '+' (added);
 * at most 2 context lines around the change, at most 40 lines (`more` = lines left out), each ≤ 200 chars.
 * Write and NotebookEdit previews hold only '+' lines (the old content is not in the call).
 */
export interface DiffHunk {
  ts: number;
  tool: 'Edit' | 'MultiEdit' | 'Write' | 'NotebookEdit';
  lines: string[];
  more: number;
  replaceAll?: boolean;  // Edit with replace_all: counted once
  mode?: string;         // NotebookEdit edit_mode ('replace' | 'insert' | 'delete')
}

/** A file an agent edited or wrote. Line counts come from the tool calls' inputs; failed calls are not counted. */
export interface FileChange {
  path: string;          // relative to the session's folder; outside it '~/…' or '…/<last segments>'
  name: string;          // basename
  added: number;
  removed: number;       // Write and NotebookEdit add lines only (the replaced content is unknown)
  edits: number;         // successful Edit / MultiEdit / Write / NotebookEdit calls
  failed: number;        // calls whose result was an error (denied, old_string not found, …)
  reads: number;         // successful Read calls of the same file
  lastTs: number;        // last successful change (or last failed attempt when none succeeded)
  /** Written whole by Write: 'created' / 'overwritten' as Claude Code reported it, 'written' when unknown. */
  write: 'created' | 'overwritten' | 'written' | null;
  hunks: DiffHunk[];     // the newest ≤ 8 previews, oldest first
  hunksDropped?: number; // older previews left out
  agents?: string[];     // session-wide view: agents that changed the file ('main' or subagent ids)
}

/** A file the agent only read. */
export interface FileRead { path: string; name: string; count: number; lastTs: number }

/**
 * One step of an agent, oldest first: a tool call (its result folded in: pending / ok / error), a spawn (Agent call)
 * or a short assistant text (≤ 160 chars). Labels are like AgentNode.currentTool ('Edit orders.ts', 'Bash: pnpm test').
 */
export interface AgentStep {
  ts: number;
  kind: 'tool' | 'spawn' | 'text';
  label: string;
  tool?: string;
  status?: 'pending' | 'ok' | 'error';
  endTs?: number;        // when the result arrived
}

/** GET /api/session/:id/agent/:agentId/changes — agentId is a subagent id, 'main', or 'all' (whole session, files only). */
export interface AgentChanges {
  sessionId: string;
  agentId: string;
  cwd: string | null;
  /** Changed files: successful ones newest first, then files whose every attempt failed; at most 300. */
  files: FileChange[];
  filesTotal: number;
  /** Files only read, newest first; at most 30. */
  reads: FileRead[];
  readsTotal: number;
  /** Over files with at least one successful change. */
  totals: { files: number; added: number; removed: number; edits: number; failed: number };
  /** The last ≤ 200 steps, oldest first ('all': none). */
  steps: AgentStep[];
  stepsTotal: number;
  generatedAt: number;
  /** The transcript is gone from disk: nothing to show. */
  archived?: boolean;
}

/**
 * A recommendation ("insight"): what is wrong, the evidence, and what to do about it.
 * The Insights page shows all of them; every analytics tab shows the ones whose `pages` include it.
 * Fields after `estSavingTokens` are additive (0.4+): older servers do not send them.
 */
export interface Insight {
  /** Stable per rule and target set (e.g. 'unused-plugins:1a2b3c4d'): a hidden card stays hidden until its targets change. */
  id: string;
  severity: 'info' | 'warn' | 'high';
  title: string;
  detail: string;
  evidence: string[];
  fix?: string;            // a concrete action / config snippet to copy
  /** Tokens for sorting and the Insights total: `saving.period` when present. */
  estSavingTokens?: number;
  /** Analytics tabs that show this card in their Recommendations strip (the Insights page shows every card). */
  pages?: InsightPage[];
  /** 'history': the rule looks at the whole stored history (e.g. "unused for 30+ days"), not the selected range. */
  scope?: 'range' | 'history';
  /** Estimated savings (tokens, estimated from text length). */
  saving?: InsightSaving;
  /** The concrete items the card is about (plugins, skills, servers…), used by the item list and the prompts. */
  targets?: InsightTarget[];
  /** Ready-to-paste prompts for a Claude Code session, in the request's language. Clorbit itself never changes anything. */
  prompts?: InsightPrompts;
  /** The tab whose recommendations handle this card's items (the card links there instead of repeating them). Additive (0.4+). */
  seeAlso?: InsightPage;
}

/** The analytics tabs a recommendation can be shown on. */
export type InsightPage = 'skills' | 'mcp' | 'startup' | 'tools' | 'subagents' | 'sessions' | 'overview' | 'limits' | 'session';
export const INSIGHT_PAGES: InsightPage[] = ['skills', 'mcp', 'startup', 'tools', 'subagents', 'sessions', 'overview', 'limits', 'session'];

/**
 * Estimated savings of a recommendation. All values are tokens (estimates from text length).
 * - perSession / perSubagent: startup context removed from every new main session / subagent;
 * - period: total over `days` days. basis 'projection' = the observed rate (sessions and subagents per day,
 *   over the last 30 days of history) × `days`; basis 'range' = what the selected range actually cost;
 * - pctStartup: perSession as a share (0..1) of the average startup context of a session.
 */
export interface InsightSaving {
  perSession?: number;
  perSubagent?: number;
  period?: number;
  days?: number;
  basis?: 'projection' | 'range';
  pctStartup?: number;
}

/** One concrete item of a recommendation. */
export interface InsightTarget {
  /** Exact identifier used in commands: 'superpowers@claude-plugins-official', a skill name, a folder path… */
  key: string;
  /** Display name. */
  label: string;
  kind?: 'plugin' | 'skill' | 'ownSkill' | 'mcp' | 'file' | 'hook' | 'other';
  /** Last use (epoch ms) across the whole history; null = never used; absent = not applicable. */
  lastUsed?: number | null;
  /** Context tokens this item adds to every session (estimate). */
  tokensPerSession?: number;
  /** A short extra fact, e.g. "4 of 5 skills unused" or "also in plugin x". */
  note?: string;
}

/** Two prompt variants: `all` — Claude performs every change and reports; `ask` — Claude asks about each item first. */
export interface InsightPrompts {
  all: string;
  ask: string;
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
  /** Recommendations. unusedDays: "consider unused after N days" (RECOMMEND_DAYS in shared/settings.ts);
   *  dismissed: ids of hidden recommendations (a PUT replaces the whole list; at most MAX_DISMISSED). Additive (0.4+). */
  recommendations: { unusedDays: number; dismissed: string[] };
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
  recommendations: { unusedDays: 30, dismissed: [] },
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
  /** Additive (0.3+): the subscription plan; null without a signed-in subscription. */
  plan?: Plan | null;
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
//   /api/session/:id/replay                     → SessionReplay (time-ordered replay events; archived sessions: structure only)
//   /api/session/:id/agent/:agentId/changes     → AgentChanges (files changed + recent steps; agentId 'main', a subagent id or 'all')
//   /api/insights?from&to[&page][&unusedDays]   → Insight[] (page: an InsightPage — only cards for that tab, unknown → [];
//                                                 unusedDays: overrides Settings.recommendations.unusedDays, 7..365)
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
