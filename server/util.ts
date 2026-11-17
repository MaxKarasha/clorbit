// Small helpers: dates, tokens, tool labels.
import path from 'node:path';
import type { Tokens } from '../shared/api.ts';

/** Compact tokens: [input, output, cacheRead, cacheWrite]. */
export type T4 = [number, number, number, number];

export const zeroT4 = (): T4 => [0, 0, 0, 0];
export const sumT4 = (t: T4): number => t[0] + t[1] + t[2] + t[3];
export function addT4(into: T4, t: T4): T4 {
  into[0] += t[0]; into[1] += t[1]; into[2] += t[2]; into[3] += t[3];
  return into;
}
export const toTokens = (t: T4): Tokens => ({ input: t[0], output: t[1], cacheRead: t[2], cacheWrite: t[3] });
export const tokensTotal = (t: Tokens): number => t.input + t.output + t.cacheRead + t.cacheWrite;

/** Token estimate from a character count (≈ 3.6 chars per token). */
export const estTokens = (chars: number): number => Math.round(chars / 3.6);

// Cache of "epoch hour → local date/hour" so we do not format a date for every record.
const hourCache = new Map<number, { date: string; hour: number }>();
export function localDateHour(ts: number): { date: string; hour: number } {
  const h = Math.floor(ts / 3_600_000);
  let v = hourCache.get(h);
  if (!v) {
    const d = new Date(h * 3_600_000);
    v = { date: fmtDate(d), hour: d.getHours() };
    if (hourCache.size > 200_000) hourCache.clear();
    hourCache.set(h, v);
  }
  return v;
}

export function fmtDate(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
}

export const localDate = (ts: number): string => localDateHour(ts).date;

/** Weekday of 'YYYY-MM-DD': 0 = Monday. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

export function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return fmtDate(new Date(y, m - 1, d + delta));
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 4000; d = addDays(d, 1)) out.push(d);
  return out;
}

export function parseTs(s: unknown): number | null {
  if (typeof s !== 'string') return typeof s === 'number' ? s : null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export function trimText(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/** MCP server from a tool name: mcp__<server>__<tool>. */
export function mcpSplit(name: string): { server: string; tool: string } | null {
  if (!name.startsWith('mcp__')) return null;
  const rest = name.slice(5);
  const i = rest.indexOf('__');
  if (i < 0) return { server: rest, tool: '' };
  return { server: rest.slice(0, i), tool: rest.slice(i + 2) };
}

/** Normalizes an MCP server's display name to the form used in tool names. */
export const mcpKey = (display: string): string => display.replace(/[^a-zA-Z0-9_-]/g, '_');

/** Short human label of a tool call. */
export function toolLabel(name: string, input: any): string {
  const inp = input && typeof input === 'object' ? input : {};
  const base = (p: unknown) => (typeof p === 'string' && p ? path.basename(p) : '');
  const short = (s: unknown, n = 40) => (typeof s === 'string' ? trimText(s.split('\n')[0], n) : '');
  switch (name) {
    case 'Read': return `Read ${base(inp.file_path)}`.trim();
    case 'Write': return `Write ${base(inp.file_path)}`.trim();
    case 'Edit':
    case 'MultiEdit': return `Edit ${base(inp.file_path)}`.trim();
    case 'NotebookEdit': return `Edit ${base(inp.notebook_path)}`.trim();
    case 'Grep': return inp.pattern ? `Grep "${short(inp.pattern, 40)}"` : 'Grep';
    case 'Glob': return inp.pattern ? `Glob ${short(inp.pattern, 40)}` : 'Glob';
    case 'Bash': return inp.command ? `Bash: ${short(inp.command, 40)}` : 'Bash';
    case 'Agent':
    case 'Task': return `Agent → ${inp.subagent_type || 'general-purpose'}`;
    case 'Skill': return inp.skill ? `Skill ${inp.skill}` : 'Skill';
    case 'WebFetch': {
      try { return `WebFetch ${new URL(inp.url).host}`; } catch { return 'WebFetch'; }
    }
    case 'WebSearch': return inp.query ? `WebSearch "${short(inp.query, 40)}"` : 'WebSearch';
    case 'ToolSearch': return inp.query ? `ToolSearch ${short(inp.query, 40)}` : 'ToolSearch';
    case 'TodoWrite': return 'TodoWrite';
  }
  const m = mcpSplit(name);
  if (m) return `${m.server} · ${m.tool}`;
  return name;
}

/** Text length of a tool result's content (a string or an array of blocks). */
export function resultChars(content: unknown): number {
  if (typeof content === 'string') return content.length;
  if (!Array.isArray(content)) return content == null ? 0 : JSON.stringify(content).length;
  let n = 0;
  for (const b of content) {
    if (!b || typeof b !== 'object') continue;
    if (typeof b.text === 'string') n += b.text.length;
    // Images: roughly ~1500 tokens ≈ 5400 chars.
    else if (b.type === 'image') n += 5400;
    else n += JSON.stringify(b).length;
  }
  return n;
}

export function projectOf(cwd: string | null | undefined, fallbackDir?: string): string {
  if (cwd) return path.basename(cwd) || cwd;
  if (fallbackDir) {
    const parts = fallbackDir.split('-').filter(Boolean);
    return parts[parts.length - 1] ?? fallbackDir;
  }
  return 'unknown';
}

export function contextLimitFor(model: string | null, requestedModel: string | null, maxCtx: number): number | null {
  if (!model && !requestedModel && !maxCtx) return null;
  if ((model && model.endsWith('[1m]')) || (requestedModel && requestedModel.endsWith('[1m]')) || maxCtx > 200_000) return 1_000_000;
  return 200_000;
}
