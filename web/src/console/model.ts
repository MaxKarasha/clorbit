// The event console: lines built from live events, filtering and merging. Pure functions.
import type { AgentNode, LiveSnapshot, RecentEvent } from '@shared/api';

export type LineKind = 'tool' | 'spawn' | 'finish' | 'wait' | 'prompt' | 'compact';
export const LINE_KINDS: LineKind[] = ['tool', 'spawn', 'finish', 'wait', 'prompt', 'compact'];
/** Glyph per kind (text presentation, so they take the line's color). */
export const KIND_GLYPH: Record<LineKind, string> = { tool: '✦', spawn: '☄︎', finish: '↩︎', wait: '⧗', prompt: '✎︎', compact: '◌' };

export interface ConsoleLine {
  key: string;
  ts: number;
  kind: LineKind;
  sessionId: string;
  project: string;
  /** The acting agent ('main' for the manager); for a spawn — the new agent. */
  agentId: string;
  /** Its type; null when unknown or the manager (agentId 'main'). */
  agentName: string | null;
  /** spawn: who spawned it; finish: whom it reports to. */
  parentId?: string;
  parentName?: string | null;
  /** Tool label, task description, or waiting reason. */
  text: string;
  tokens?: number;
  /** The session is an automated run (claude -p, SDK, CI): grouped unless automated sessions are shown. */
  automated?: boolean;
}

function findNode(n: AgentNode, id: string): AgentNode | null {
  if (n.id === id) return n;
  for (const c of n.children) {
    const r = findNode(c, id);
    if (r) return r;
  }
  return null;
}

/** A console line for an event, or null for events the console does not show. Names come from the
 *  server's context when present, otherwise from the latest snapshot (demo mode). */
export function toLine(e: RecentEvent, snap: LiveSnapshot | null): ConsoleLine | null {
  const sess = snap?.sessions.find((s) => s.sessionId === e.sessionId);
  const project = e.project ?? sess?.project ?? e.sessionId.slice(0, 8);
  const nameOf = (id: string | undefined, given: string | null | undefined): string | null => {
    if (!id || id === 'main') return null;
    if (given !== undefined && given !== null) return given;
    return (sess && findNode(sess.root, id)?.type) || null;
  };
  const automated = e.automated ?? sess?.kind === 'automated';
  const base = { ts: e.ts, sessionId: e.sessionId, project, ...(automated ? { automated: true } : {}) };
  let line: Omit<ConsoleLine, 'key'>;
  switch (e.kind) {
    case 'tool':
      line = { ...base, kind: 'tool', agentId: e.agentId, agentName: nameOf(e.agentId, e.agentName), text: e.label };
      break;
    case 'spawn':
      line = { ...base, kind: 'spawn', agentId: e.agentId, agentName: e.agentType, parentId: e.parentId, parentName: nameOf(e.parentId, e.parentName), text: e.description ?? '' };
      break;
    case 'finish':
      line = { ...base, kind: 'finish', agentId: e.agentId, agentName: nameOf(e.agentId, e.agentName), parentId: e.parentId, parentName: nameOf(e.parentId, e.parentName), text: '', tokens: e.tokens };
      break;
    case 'status':
      if (e.status !== 'waiting') return null;
      line = { ...base, kind: 'wait', agentId: 'main', agentName: null, text: e.reason ?? '' };
      break;
    case 'prompt':
      line = { ...base, kind: 'prompt', agentId: 'main', agentName: null, text: '' };
      break;
    case 'compact':
      line = { ...base, kind: 'compact', agentId: 'main', agentName: null, text: '' };
      break;
    default:
      return null;
  }
  return { ...line, key: `${line.ts}|${line.kind}|${line.sessionId}|${line.agentId}|${line.text}` };
}

/** Adds lines (deduplicated by key), keeps them sorted by time and caps the history. */
export function mergeLines(cur: ConsoleLine[], add: ConsoleLine[], max = 1000): ConsoleLine[] {
  if (!add.length) return cur;
  const seen = new Set(cur.map((l) => l.key));
  const fresh = add.filter((l) => !seen.has(l.key) && (seen.add(l.key), true));
  if (!fresh.length) return cur;
  const lastTs = cur.length ? cur[cur.length - 1].ts : -Infinity;
  const inOrder = fresh.every((l, i) => l.ts >= (i ? fresh[i - 1].ts : lastTs));
  const all = inOrder ? [...cur, ...fresh] : [...cur, ...fresh].sort((a, b) => a.ts - b.ts);
  return all.length > max ? all.slice(all.length - max) : all;
}

export interface LineFilter {
  /** Empty means every project. */
  projects: string[];
  /** Empty means every kind. */
  kinds: LineKind[];
  q: string;
  /** "Clear view": lines up to and including this time are hidden. */
  clearedAt: number;
}

export const NO_FILTER: LineFilter = { projects: [], kinds: [], q: '', clearedAt: 0 };

export function filterLines(lines: ConsoleLine[], f: LineFilter): ConsoleLine[] {
  const q = f.q.trim().toLowerCase();
  return lines.filter(
    (l) =>
      l.ts > f.clearedAt &&
      (!f.projects.length || f.projects.includes(l.project)) &&
      (!f.kinds.length || f.kinds.includes(l.kind)) &&
      (!q || [l.project, l.agentName ?? '', l.parentName ?? '', l.text].some((s) => s.toLowerCase().includes(q))),
  );
}

/** Projects in the history, most recent first (for the filter chips). */
export function projectsOf(lines: ConsoleLine[]): { project: string; sessionId: string }[] {
  const out = new Map<string, string>();
  for (let i = lines.length - 1; i >= 0; i--) if (!out.has(lines[i].project)) out.set(lines[i].project, lines[i].sessionId);
  return [...out].map(([project, sessionId]) => ({ project, sessionId }));
}

/** A display item: a line, or a collapsible group of one project's automated events. */
export type ConsoleItem =
  | { t: 'line'; line: ConsoleLine }
  | { t: 'group'; key: string; project: string; sessionId: string; count: number; lastTs: number; open: boolean; lines: ConsoleLine[] };

/**
 * Folds the automated lines of each project into one group row, placed where its newest line is (so an
 * active pipeline's row stays at the bottom). An open group lists its lines right after the row.
 * With `group` off every line stays as it is.
 */
export function groupAutomated(lines: ConsoleLine[], open: ReadonlySet<string>, group = true): ConsoleItem[] {
  if (!group) return lines.map((line) => ({ t: 'line', line }));
  const byProject = new Map<string, ConsoleLine[]>();
  for (const l of lines) {
    if (!l.automated) continue;
    const arr = byProject.get(l.project);
    if (arr) arr.push(l);
    else byProject.set(l.project, [l]);
  }
  const lastOf = new Map<string, string>();
  for (const [p, arr] of byProject) lastOf.set(arr[arr.length - 1].key, p);
  const out: ConsoleItem[] = [];
  for (const l of lines) {
    if (!l.automated) { out.push({ t: 'line', line: l }); continue; }
    const p = lastOf.get(l.key);
    if (p === undefined) continue;
    const arr = byProject.get(p)!;
    const key = `auto:${p}`;
    out.push({ t: 'group', key, project: p, sessionId: arr[arr.length - 1].sessionId, count: arr.length, lastTs: l.ts, open: open.has(key), lines: arr });
  }
  return out;
}
