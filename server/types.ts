// Internal server types: the summary of one .jsonl file, persisted in SQLite.
import type { T4 } from './util';

export const SUMMARY_VERSION = 9;
/**
 * The oldest summary version that is still loaded. Older-but-compatible rows of transcripts that still exist are
 * re-parsed on the next scan; archived ones (transcript gone) are kept as they are, so every field added since
 * this version must be optional in FileSummary.
 */
export const MIN_SUMMARY_VERSION = 5;

export interface UsageAgg { t: T4; turns: number; last: number }
export interface ToolAgg {
  calls: number; res: number; resN: number; max: number; last: number;
  /** Results flagged is_error (not counting the user declining a call). Optional: absent before v7. */
  err?: number;
  /** Those errors by kind (ERROR_KINDS in scanner.ts: 'exit', 'notFound', 'notRead', …), no error text. Optional: v8+. */
  errKinds?: Record<string, number>;
}
export interface HookAgg { n: number; ms: number; err: number }

/** Aggregates of one file for one local date. */
export interface DayBucket {
  t: T4;
  turns: number;
  unattributed: number;          // token total of turns without attribution
  models: Record<string, UsageAgg>;
  skills: Record<string, UsageAgg>;
  plugins: Record<string, UsageAgg>;
  mcpServers: Record<string, UsageAgg>;
  mcpTools: Record<string, UsageAgg>; // key 'server\u0001tool'
  tools: Record<string, ToolAgg>;
  skillLoads: Record<string, number>;
  hours: Record<string, T4>;     // local hour → tokens
  toolCalls: number;
  compactions: number;
  autoCompactions: number;
  hooks: Record<string, HookAgg>; // key 'plugin|hookName'
  /** Main chain only, v9+ (optional: older and archived summaries lack them). Turns that wrote the whole context to the
   *  cache again after an idle gap (> 5 min) — the prompt cache had expired: count, those after a gap > 1 h, and the
   *  cache-write tokens of those turns. */
  rebuilds?: { n: number; n60: number; write: number };
  /** A model switch that rebuilt the cache (the cache is per model): count and cache-write tokens. v9+. */
  switches?: { n: number; write: number };
  /** Turns whose context was ≥ 85% of a 200K window (≥ 170K) and of a 1M window (≥ 850K). v9+. */
  ctxHi?: [number, number];
  /** Context size (compactMetadata.preTokens) summed over the auto-compactions of the day. v9+. */
  compactPre?: number;
  /** Prompt rounds (a prompt up to the end of the answer) by effort level: all rounds, simple ones (at most two
   *  requests, no tool calls, a short answer) and the tokens of the simple ones. v9+. */
  effort?: Record<string, EffortAgg>;
}

export interface EffortAgg { rounds: number; simple: number; tok: number }

export interface PendingTool { name: string; label: string; ts: number }

export interface SpawnInfo {
  ts: number; type: string; desc: string | null;
  /** How the subagent ended, from the Agent call's result or a later task notification (background agents):
   *  'ok' completed, 'error' failed, 'stopped' interrupted / killed by the user. Absent: unknown or still running. v8+. */
  res?: 'ok' | 'error' | 'stopped';
}

export interface BigResult { tool: string; label: string; tokens: number; ts: number }

export interface SubagentMeta {
  agentType: string;
  description: string | null;
  spawnDepth: number;
  toolUseId: string | null;
  finished: boolean | null;
  workflow: string | null;
  worktreePath: string | null;
  /** meta.isBuiltIn: a built-in agent type (Explore, general-purpose, …) rather than a user, project or plugin agent. */
  builtIn?: boolean | null;
  /** meta.model: the model the agent was launched with ('opus', 'sonnet', 'haiku', 'inherit', a model id), when recorded. */
  launchModel?: string | null;
}

/** Minimal state needed to resume parsing where it stopped. */
export interface Carry {
  recentReq: string[];                    // recent requestIds (deduplication)
  pending: Record<string, PendingTool>;   // tool_use blocks without a result yet
  toolNames: Record<string, string>;      // id → name of recent calls (for late results)
  lastStop: string | null;
  lastTool: string | null;
  lastToolName: string | null;
  lastToolTs: number;
  lastText: string | null;
  lastTextTs: number;
  lastCtx: number;
  maxCtx: number;
  lastPromptTs: number;
  sessionStartPlugin: string | null;
  startupDone: boolean;
  /** v9+: the last main-chain turn (0 after a compaction) and its model, for idle-gap and model-switch rebuilds. */
  lastTurnTs?: number;
  lastModel?: string | null;
  /** v9+: the open prompt round (see DayBucket.effort). */
  round?: { reqs: number; out: number; tools: number; tok: number; effort: string | null } | null;
}

export interface FileSummary {
  v: number;
  path: string;
  size: number;
  mtimeMs: number;
  offset: number;
  sessionId: string;
  agentId: string | null;     // null for the main transcript
  projectDir: string;         // folder name under ~/.claude/projects
  meta: SubagentMeta | null;
  cwd: string | null;
  gitBranch: string | null;
  title: string | null;
  permissionMode: string | null;
  model: string | null;
  requestedModel: string | null;
  effort: string | null;
  /** Claude Code's `entrypoint` ('cli', 'sdk-cli', ...). Optional: summaries written before 0.2.1 lack it. */
  entrypoint?: string | null;
  /** `turnOrigin` / `promptSource` of the first user prompt ('human', 'sdk', 'scheduled', ...). Optional, as above. */
  promptOrigin?: string | null;
  firstTs: number;
  lastTs: number;
  lastAssistantTs: number;
  total: T4;
  turns: number;
  toolCalls: number;
  compactions: number;
  autoCompactions: number;
  turnDurMs: number;
  days: Record<string, DayBucket>;
  minutes: Record<string, number>;      // epoch minute → tokens (last hour of activity only)
  startup: Record<string, number>;      // startup key (see i18n.ts STARTUP) → chars, until the first assistant reply
  skillsByPlugin: Record<string, number>; // chars in the skill listing per plugin ('~own' = not from a plugin)
  /** Chars in the skill listing per skill: 'plugin:skill' or an own skill's name. Optional: absent before v6. */
  skillsByName?: Record<string, number>;
  mcpBlocks: Record<string, number>;      // chars of MCP instructions per server
  mcpSeen: string[];                      // MCP server keys (as in mcp__<key>__)
  /** Startup only: chars of MCP tool definitions per server key (prompt_snapshot tools: name, description, schema). v7+. */
  mcpToolDefs?: Record<string, number>;
  /** Startup only: chars of deferred MCP tool entries per server key (with tool search on, only names are listed). v7+. */
  mcpToolNames?: Record<string, number>;
  /** MCP servers reported as failed to connect or needing authentication (deferred tools attachments), by display name. v7+. */
  mcpIssues?: Record<string, McpIssue>;
  /** Startup only: instruction files (CLAUDE.md, CLAUDE.local.md, rules, auto-memory) by path. v7+. */
  memoryFiles?: Record<string, MemoryFile>;
  spawns: Record<string, SpawnInfo>;      // toolUseId of an Agent call → info
  /** How background tasks ended, from their task notifications, by task id (a background subagent's id is its
   *  agentId): 'ok' | 'error' | 'stopped'. At most MAX_TASK_ENDS entries. v8+. */
  taskEnds?: Record<string, 'ok' | 'error' | 'stopped'>;
  reads: Record<string, number>;          // path → how many times it was Read
  bigResults: BigResult[];
  carry: Carry;
}

export interface McpIssue {
  failed: number;          // reports of a failed connection in this file
  auth: number;            // reports of "needs authentication"
  last: number;            // the latest report
  error?: string;          // the latest error text (≤ 80 chars)
}

export interface MemoryFile {
  /** Claude Code's memory type: 'User' | 'Project' | 'Local' | 'Managed' | 'AutoMem' (or the lowercase kind). */
  type: string;
  chars: number;
}

export interface ScanOptions {
  knownPlugins: string[];                // plugin names used to recognize hooks
}

export type ScanEvent =
  | { kind: 'tool'; ts: number; name: string; label: string }
  | { kind: 'text'; ts: number; text: string }
  | { kind: 'prompt'; ts: number }
  | { kind: 'compact'; ts: number }
  | { kind: 'end'; ts: number };
