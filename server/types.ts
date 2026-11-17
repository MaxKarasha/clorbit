// Internal server types: the summary of one .jsonl file, persisted in SQLite.
import type { T4 } from './util';

export const SUMMARY_VERSION = 5;

export interface UsageAgg { t: T4; turns: number; last: number }
export interface ToolAgg { calls: number; res: number; resN: number; max: number; last: number }
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
}

export interface PendingTool { name: string; label: string; ts: number }

export interface SpawnInfo { ts: number; type: string; desc: string | null }

export interface BigResult { tool: string; label: string; tokens: number; ts: number }

export interface SubagentMeta {
  agentType: string;
  description: string | null;
  spawnDepth: number;
  toolUseId: string | null;
  finished: boolean | null;
  workflow: string | null;
  worktreePath: string | null;
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
  mcpBlocks: Record<string, number>;      // chars of MCP instructions per server
  mcpSeen: string[];                      // MCP server keys (as in mcp__<key>__)
  spawns: Record<string, SpawnInfo>;      // toolUseId of an Agent call → info
  reads: Record<string, number>;          // path → how many times it was Read
  bigResults: BigResult[];
  carry: Carry;
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
