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
}

export interface Limits {
  fiveHourPct: number | null;
  fiveHourResetsAt: number | null;
  sevenDayPct: number | null;
  sevenDayResetsAt: number | null;
  updatedAt: number;
}

/** One recorded change of subscription limits (from the statusline capture). */
export interface LimitsPoint { ts: number; fiveHourPct: number | null; sevenDayPct: number | null }

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
  hooksInstalled: boolean;
  statuslineCapture: boolean;
  scan: { done: boolean; filesTotal: number; filesDone: number };
}

export type ClorbitEvent =
  | { kind: 'tool'; ts: number; sessionId: string; agentId: string; tool: string; label: string }
  | { kind: 'spawn'; ts: number; sessionId: string; parentId: string; agentId: string; agentType: string; description: string | null }
  | { kind: 'finish'; ts: number; sessionId: string; agentId: string; parentId: string; tokens: number }
  | { kind: 'status'; ts: number; sessionId: string; status: SessionStatus; reason: string | null }
  | { kind: 'text'; ts: number; sessionId: string; agentId: string; text: string }
  | { kind: 'prompt'; ts: number; sessionId: string }
  | { kind: 'compact'; ts: number; sessionId: string };

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

// Endpoints (all GET except /api/hook). Every GET accepts `lang=en|uk` (default en):
//   /api/health                                 → HealthInfo (identifies a running Clorbit; used by the CLI)
//   /api/live                                   → LiveSnapshot
//   /api/events                                 → SSE, each message is data: ClorbitEvent
//   /api/analytics/overview?from&to             → AnalyticsOverview
//   /api/analytics/attribution?from&to          → AttributionReport
//   /api/analytics/sessions?from&to&project     → SessionSummary[]
//   /api/session/:id                            → SessionDetail
//   /api/insights?from&to                       → Insight[]
//   /api/limits/history?from&to                 → LimitsPoint[] (from/to: 'YYYY-MM-DD' or epoch ms; default last 7 days)
//   /api/debug/scan, /api/debug/db              → diagnostics (scan stats; SQLite row counts, size, archived files)
//   POST /api/hook                              → accepts Claude Code hook JSON (stored in SQLite, 90-day retention)

/** GET /api/health — cheap identity check used by `clorbit status|start|stop`. */
export interface HealthInfo {
  app: 'clorbit';
  version: string;
  pid: number;
  port: number;
  dataDir: string;
  uptimeMs: number;
}
