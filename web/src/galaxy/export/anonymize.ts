// Privacy for shared clips (pure): a replay with nothing that identifies the project or what was worked on.
// The project becomes "project", the session title, prompts, agent tasks and texts are dropped, tool labels are
// cut to the tool's name (no paths, commands, patterns, queries or URLs), agent types are kept only when they look
// like a plain identifier, and ids are renumbered. Timestamps, models, tokens and the structure stay, so the
// anonymized clip moves exactly like the original.
import type { ReplayEvent, SessionReplay } from '@shared/api';

const IDENT = /^[A-Za-z][\w:-]{0,39}$/;

/** A plain identifier (agent type, tool name) or `fallback`: no paths, dots, spaces or anything longer than 40. */
export function safeIdent(s: string | null | undefined, fallback: string): string {
  const x = (s ?? '').trim();
  return IDENT.test(x) ? x : fallback;
}

/**
 * The tool name of a tool label (as the server writes them: `Read webhook.ts`, `Bash: pnpm test`,
 * `Grep "x"`, `WebFetch host`, `Agent → Explore`, `server · tool` for MCP, or a bare name).
 */
export function toolNameOf(label: string | null | undefined): string {
  const s = (label ?? '').trim();
  const agent = /^(?:Agent|Task)\s*→\s*(.+)$/.exec(s);
  if (agent) return `Agent → ${safeIdent(agent[1], 'agent')}`;
  const mcp = /^([A-Za-z][\w-]{0,39}) · ([A-Za-z][\w-]{0,39})$/.exec(s);
  if (mcp) return `${mcp[1]} · ${mcp[2]}`;
  const m = /^[A-Za-z][\w-]*/.exec(s);
  if (!m || m[0].length > 40) return 'tool';
  // A bare word followed by a path, a dot or a scheme (e.g. "README.md", "src/x", "C:\\x", "https://…") is not a tool.
  const rest = s.slice(m[0].length);
  if (/^(?:[./\\]|:\S)/.test(rest)) return 'tool';
  return m[0];
}

export const ANON_PROJECT = 'project';
export const ANON_SESSION = 'session';

export function anonymizeReplay(r: SessionReplay): SessionReplay {
  const ids = new Map<string, string>([['main', 'main']]);
  const id = (x: string) => {
    let v = ids.get(x);
    if (!v) { v = `agent-${ids.size}`; ids.set(x, v); }
    return v;
  };
  const events: ReplayEvent[] = r.events.map((e): ReplayEvent => {
    switch (e.kind) {
      case 'spawn': return { kind: 'spawn', ts: e.ts, agentId: id(e.agentId), parentId: id(e.parentId), agentType: safeIdent(e.agentType, 'agent'), description: null, model: e.model ?? null, effort: e.effort ?? null };
      case 'finish': return { kind: 'finish', ts: e.ts, agentId: id(e.agentId), tokens: e.tokens };
      case 'tool': return { kind: 'tool', ts: e.ts, agentId: id(e.agentId), label: toolNameOf(e.label) };
      case 'text': return { kind: 'text', ts: e.ts, agentId: id(e.agentId), text: '' };
      case 'prompt': return { kind: 'prompt', ts: e.ts, text: '' };
      case 'compact': return { kind: 'compact', ts: e.ts, auto: e.auto, preTokens: e.preTokens };
      case 'status': return { kind: 'status', ts: e.ts, status: e.status, reason: null, code: e.code, arg: e.arg ? toolNameOf(e.arg) : null };
      case 'tokens': return e.context === undefined ? { kind: 'tokens', ts: e.ts, agentId: id(e.agentId), t: [...e.t] } : { kind: 'tokens', ts: e.ts, agentId: id(e.agentId), t: [...e.t], context: e.context };
    }
  });
  return {
    sessionId: ANON_SESSION, project: ANON_PROJECT, cwd: '', title: null, model: r.model, effort: r.effort, contextLimit: r.contextLimit,
    startedAt: r.startedAt, endedAt: r.endedAt, live: r.live, generatedAt: r.generatedAt,
    ...(r.archived ? { archived: true } : {}), ...(r.sampled ? { sampled: r.sampled } : {}), events,
  };
}
