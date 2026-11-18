// Where MCP servers are configured, by name only (read-only), so a recommendation can name the right command:
// - user scope: `mcpServers` of Claude Code's ~/.claude.json;
// - local scope: `projects[<folder>].mcpServers` of the same file;
// - project scope: `mcpServers` of a project's .mcp.json.
// Only the server names are kept: commands, URLs, headers and environment (which may hold secrets) are dropped at once,
// and nothing from these files is logged or returned beyond the names.
import fs from 'node:fs';
import path from 'node:path';
import { CLAUDE_JSON_FILES } from './config';

export interface McpConfig {
  /** User-scope servers (~/.claude.json mcpServers). */
  user: string[];
  /** Local-scope servers: absolute project folder → names (~/.claude.json projects[…].mcpServers). */
  local: Record<string, string[]>;
  /** Project-scope servers of a folder's .mcp.json (empty when there is none). */
  projectFile: (dir: string) => string[];
}

const names = (v: unknown): string[] =>
  v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).filter((k) => k.length > 0 && k.length <= 120) : [];

/** Names from a parsed ~/.claude.json (exported for tests). */
export function mcpNamesFrom(j: unknown): { user: string[]; local: Record<string, string[]> } {
  const o = j && typeof j === 'object' ? (j as Record<string, unknown>) : {};
  const local: Record<string, string[]> = {};
  const projects = o.projects && typeof o.projects === 'object' ? (o.projects as Record<string, unknown>) : {};
  for (const [dir, p] of Object.entries(projects)) {
    const n = names((p as { mcpServers?: unknown } | null)?.mcpServers);
    if (n.length && path.isAbsolute(dir)) local[dir] = n;
  }
  return { user: names(o.mcpServers), local };
}

let cache: { file: string; mtime: number; size: number; v: { user: string[]; local: Record<string, string[]> } } | null = null;

function readClaudeJson(files: string[]): { user: string[]; local: Record<string, string[]> } {
  for (const file of files) {
    let st: fs.Stats;
    try { st = fs.statSync(file); } catch { continue; }
    if (cache && cache.file === file && cache.mtime === st.mtimeMs && cache.size === st.size) return cache.v;
    try {
      const v = mcpNamesFrom(JSON.parse(fs.readFileSync(file, 'utf8')));
      cache = { file, mtime: st.mtimeMs, size: st.size, v };
      return v;
    } catch {
      // Mid-write or not JSON: keep what was known (no details are logged — the file is private).
      if (cache && cache.file === file) return cache.v;
      return { user: [], local: {} };
    }
  }
  return { user: [], local: {} };
}

const projectCache = new Map<string, { mtime: number; v: string[] }>();

/** Server names of `<dir>/.mcp.json` (cached by mtime). */
export function mcpJsonServers(dir: string): string[] {
  const file = path.join(dir, '.mcp.json');
  let st: fs.Stats;
  try { st = fs.statSync(file); } catch { return []; }
  const hit = projectCache.get(file);
  if (hit && hit.mtime === st.mtimeMs) return hit.v;
  let v: string[] = [];
  try { v = names((JSON.parse(fs.readFileSync(file, 'utf8')) as { mcpServers?: unknown })?.mcpServers); } catch { /* not JSON */ }
  projectCache.set(file, { mtime: st.mtimeMs, v });
  if (projectCache.size > 500) projectCache.delete(projectCache.keys().next().value!);
  return v;
}

export function readMcpConfig(files: string[] = CLAUDE_JSON_FILES): McpConfig {
  return { ...readClaudeJson(files), projectFile: mcpJsonServers };
}
