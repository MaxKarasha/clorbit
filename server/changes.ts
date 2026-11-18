// "What did this agent change?": the files an agent edited or wrote and its recent steps, parsed on demand from
// its transcript. One ChangesSink per transcript is cached and resumed from its byte offset when the file grows,
// so a live agent costs only its new lines. Tool results are byte-scanned (never JSON-parsed when large): only
// their tool_use_id, is_error and timestamp matter. Diff previews are capped while parsing, not after.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentChanges, AgentStep, DiffHunk, FileChange, FileRead } from '../shared/api.ts';
import { readLines, parseLine, type LineSink } from './lines';
import type { Store } from './store';
import type { FileSummary } from './types';
import { parseTs, toolLabel, trimText } from './util';

export const CHANGE_LIMITS = {
  /** Steps kept per transcript (newest). */
  steps: 200,
  /** Diff previews kept per file (newest). */
  hunksPerFile: 8,
  /** Lines per diff preview. */
  linesPerHunk: 40,
  /** Characters per previewed line. */
  lineChars: 200,
  /** Files returned (newest first). */
  files: 300,
  /** Read-only files returned. */
  reads: 30,
  /** Calls waiting for their result (a transcript cut short never resolves some). */
  pending: 2000,
  /** Largest old × new middle (in lines) that gets an exact LCS; bigger edits count every line. */
  lcsCells: 250_000,
  /** A result line shorter than this is JSON-parsed; longer ones are byte-scanned. */
  parseResultBelow: 64 * 1024,
};

/** Tools whose successful calls change a file. */
export const CHANGE_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);

// Byte patterns. Inside a JSON string every quote is escaped, so `"key":` never matches string content.
const TOOL_USE_ID = Buffer.from('"tool_use_id":"');
const IS_ERROR = Buffer.from('"is_error":true');
const TIMESTAMP = Buffer.from('"timestamp":"');
const TUR = Buffer.from(',"toolUseResult":');
const ASSISTANT = Buffer.from('"type":"assistant"');
const SIDECHAIN = Buffer.from('"isSidechain":true');

function stringAt(buf: Buffer, at: number): string | null {
  const end = buf.indexOf(0x22, at);
  return end > at ? buf.toString('latin1', at, end) : null;
}

/* ---------------- line diff ---------------- */

function splitLines(s: unknown): string[] {
  if (typeof s !== 'string' || s === '') return [];
  const out = s.split('\n');
  if (out[out.length - 1] === '') out.pop();
  return out;
}

const clip = (s: string) => (s.length > CHANGE_LIMITS.lineChars ? s.slice(0, CHANGE_LIMITS.lineChars - 1) + '…' : s);

/** Ops of a line diff: ' ' context, '-' removed, '+' added (each followed by the line). */
export function diffOps(a: string[], b: string[]): string[] {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const am = a.slice(p, a.length - s);
  const bm = b.slice(p, b.length - s);
  const mid: string[] = [];
  if (am.length && bm.length && am.length * bm.length <= CHANGE_LIMITS.lcsCells) {
    // LCS table from the end, then walk it forwards.
    const n = am.length, m = bm.length;
    const w = m + 1;
    const L = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        L[i * w + j] = am[i] === bm[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (am[i] === bm[j]) { mid.push(' ' + am[i]); i++; j++; }
      else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) mid.push('-' + am[i++]);
      else mid.push('+' + bm[j++]);
    }
    while (i < n) mid.push('-' + am[i++]);
    while (j < m) mid.push('+' + bm[j++]);
  } else {
    for (const x of am) mid.push('-' + x);
    for (const x of bm) mid.push('+' + x);
  }
  return [...a.slice(0, p).map((x) => ' ' + x), ...mid, ...a.slice(a.length - s).map((x) => ' ' + x)];
}

/** Line counts and a capped preview (at most 2 context lines around the change) of one old → new replacement. */
export function lineDiff(oldText: unknown, newText: unknown): { added: number; removed: number; lines: string[]; more: number } {
  const ops = diffOps(splitLines(oldText), splitLines(newText));
  let added = 0, removed = 0, first = -1, last = -1;
  ops.forEach((o, i) => {
    if (o[0] === ' ') return;
    if (o[0] === '+') added++; else removed++;
    if (first < 0) first = i;
    last = i;
  });
  const view = first < 0 ? [] : ops.slice(Math.max(0, first - 2), last + 3);
  const max = CHANGE_LIMITS.linesPerHunk;
  return { added, removed, lines: view.slice(0, max).map(clip), more: Math.max(0, view.length - max) };
}

/** The change one successful call makes: line counts and diff previews. Null for other tools. */
export function changeOf(name: string, input: any, ts: number): { path: string; added: number; removed: number; hunks: DiffHunk[]; write: boolean } | null {
  if (!CHANGE_TOOLS.has(name) || !input || typeof input !== 'object') return null;
  const p = name === 'NotebookEdit' ? input.notebook_path : input.file_path;
  if (typeof p !== 'string' || !p) return null;
  const max = CHANGE_LIMITS.linesPerHunk;
  if (name === 'Write') {
    const lines = splitLines(input.content);
    return { path: p, added: lines.length, removed: 0, write: true, hunks: [{ ts, tool: 'Write', lines: lines.slice(0, max).map((x) => clip('+' + x)), more: Math.max(0, lines.length - max) }] };
  }
  if (name === 'NotebookEdit') {
    // The old cell source is not in the call: only added lines are known.
    const mode = typeof input.edit_mode === 'string' ? input.edit_mode : 'replace';
    const lines = mode === 'delete' ? [] : splitLines(input.new_source);
    return { path: p, added: lines.length, removed: 0, write: false, hunks: [{ ts, tool: 'NotebookEdit', mode, lines: lines.slice(0, max).map((x) => clip('+' + x)), more: Math.max(0, lines.length - max) }] };
  }
  const edits: any[] = name === 'MultiEdit' ? (Array.isArray(input.edits) ? input.edits : []) : [input];
  let added = 0, removed = 0;
  const hunks: DiffHunk[] = [];
  for (const e of edits) {
    if (!e || typeof e !== 'object') continue;
    const d = lineDiff(e.old_string, e.new_string);
    added += d.added; removed += d.removed;
    const h: DiffHunk = { ts, tool: name as DiffHunk['tool'], lines: d.lines, more: d.more };
    if (e.replace_all === true) h.replaceAll = true;
    hunks.push(h);
  }
  return { path: p, added, removed, hunks, write: false };
}

/* ---------------- transcript sink ---------------- */

interface Pending {
  ts: number;
  name: string;
  step: AgentStep;
  change: ReturnType<typeof changeOf>;
  read: string | null;
}

/** Per-file accumulator (absolute path). */
export interface FileAcc {
  abs: string;
  added: number;
  removed: number;
  edits: number;
  failed: number;
  reads: number;
  lastTs: number;
  write: FileChange['write'];
  hunks: DiffHunk[];
  hunksDropped: number;
}

export class ChangesSink implements LineSink {
  files = new Map<string, FileAcc>();
  steps: AgentStep[] = [];
  stepsTotal = 0;
  lastTs = 0;
  private pend = new Map<string, Pending>();
  constructor(private isMain: boolean) {}

  skipped() { /* service blobs are not needed */ }

  private file(abs: string): FileAcc {
    let f = this.files.get(abs);
    if (!f) this.files.set(abs, (f = { abs, added: 0, removed: 0, edits: 0, failed: 0, reads: 0, lastTs: 0, write: null, hunks: [], hunksDropped: 0 }));
    return f;
  }

  private step(s: AgentStep) {
    this.stepsTotal++;
    this.steps.push(s);
    // Trimmed in batches: the ring stays ≤ 2× the cap.
    if (this.steps.length > CHANGE_LIMITS.steps * 2) this.steps = this.steps.slice(-CHANGE_LIMITS.steps);
  }

  line(buf: Buffer) {
    const head = buf.toString('latin1', 0, Math.min(buf.length, 120));
    const lead = /^\{"type":"([\w-]+)"/.exec(head)?.[1];
    if (lead && lead !== 'user' && lead !== 'assistant') return;
    // Older transcripts inline subagent records in the main file, marked as sidechain.
    if (this.isMain && buf.subarray(0, 1024).indexOf(SIDECHAIN) >= 0) return;
    // Only the record itself counts, not the toolUseResult copy that follows it.
    const cut = buf.indexOf(TUR);
    const isAssistant = (cut >= 0 ? buf.subarray(0, cut) : buf).indexOf(ASSISTANT) >= 0;
    if (!isAssistant) {
      if (buf.indexOf(TOOL_USE_ID) >= 0) this.results(buf);
      return;
    }
    const d = parseLine(buf);
    if (!d || d.type !== 'assistant' || !d.message) return;
    if (this.isMain && d.isSidechain === true) return;
    const msg = d.message;
    if (msg.model === '<synthetic>') return;
    const ts = parseTs(d.timestamp) ?? this.lastTs;
    if (ts) this.lastTs = Math.max(this.lastTs, ts);
    for (const b of Array.isArray(msg.content) ? msg.content : []) {
      if (b?.type === 'tool_use') {
        const id = b.id ? String(b.id) : '';
        if (id && this.pend.has(id)) continue;
        const name = String(b.name ?? '');
        const inp = b.input && typeof b.input === 'object' ? b.input : {};
        const spawn = name === 'Agent' || name === 'Task';
        const label = spawn && inp.description ? `${toolLabel(name, inp)}: ${trimText(String(inp.description), 60)}` : toolLabel(name, inp);
        const step: AgentStep = { ts, kind: spawn ? 'spawn' : 'tool', tool: name, label, status: 'pending' };
        this.step(step);
        if (!id) continue;
        const read = name === 'Read' && typeof inp.file_path === 'string' ? inp.file_path : null;
        this.pend.set(id, { ts, name, step, change: changeOf(name, inp, ts), read });
        if (this.pend.size > CHANGE_LIMITS.pending) this.pend.delete(this.pend.keys().next().value!);
      } else if (b?.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
        this.step({ ts, kind: 'text', label: trimText(b.text, 160) });
      }
    }
  }

  /** A user record with tool results: which calls finished, and whether they failed. */
  private results(buf: Buffer) {
    const turAt = buf.indexOf(TUR);
    const end = turAt >= 0 ? turAt : buf.length;
    let found: { id: string; error: boolean }[] = [];
    let ts: number | null = null;
    if (buf.length < CHANGE_LIMITS.parseResultBelow) {
      const d = parseLine(buf);
      if (!d || d.type !== 'user' || !Array.isArray(d.message?.content)) return;
      if (this.isMain && d.isSidechain === true) return;
      ts = parseTs(d.timestamp);
      found = d.message.content
        .filter((x: any) => x?.type === 'tool_result' && x.tool_use_id)
        .map((x: any) => ({ id: String(x.tool_use_id), error: x.is_error === true }));
    } else {
      const at = buf.indexOf(TIMESTAMP);
      ts = at >= 0 ? parseTs(stringAt(buf, at + TIMESTAMP.length)) : null;
      const ids: { id: string; at: number }[] = [];
      for (let i = buf.indexOf(TOOL_USE_ID); i >= 0 && i < end; i = buf.indexOf(TOOL_USE_ID, i + 1)) {
        const id = stringAt(buf, i + TOOL_USE_ID.length);
        if (id) ids.push({ id, at: i });
      }
      const errs: number[] = [];
      for (let i = buf.indexOf(IS_ERROR); i >= 0 && i < end; i = buf.indexOf(IS_ERROR, i + 1)) errs.push(i);
      // One result per record is the norm; with several, an error flag belongs to the block it follows.
      found = ids.map((x, k) => ({
        id: x.id,
        error: ids.length === 1 ? errs.length > 0 : errs.some((e) => e > x.at && e < (ids[k + 1]?.at ?? end)),
      }));
    }
    if (!found.length) return;
    ts ??= this.lastTs;
    if (ts) this.lastTs = Math.max(this.lastTs, ts);
    // Write reports whether it created the file or replaced it (toolUseResult.type).
    let kind: 'created' | 'overwritten' | null = null;
    if (turAt >= 0) {
      const tail = buf.toString('latin1', turAt + TUR.length, Math.min(buf.length, turAt + TUR.length + 40));
      kind = tail.startsWith('{"type":"create"') ? 'created' : tail.startsWith('{"type":"update"') ? 'overwritten' : null;
    }
    for (const r of found) {
      const p = this.pend.get(r.id);
      if (!p) continue;
      this.pend.delete(r.id);
      p.step.status = r.error ? 'error' : 'ok';
      if (ts) p.step.endTs = ts;
      if (p.change) {
        const f = this.file(p.change.path);
        if (r.error) { f.failed++; if (!f.edits) f.lastTs = Math.max(f.lastTs, ts || p.ts); continue; }
        f.added += p.change.added;
        f.removed += p.change.removed;
        f.edits++;
        f.lastTs = Math.max(f.lastTs, ts || p.ts);
        if (p.change.write) f.write = found.length === 1 && kind ? kind : (f.write ?? 'written');
        for (const h of p.change.hunks) f.hunks.push(h);
        if (f.hunks.length > CHANGE_LIMITS.hunksPerFile) {
          const drop = f.hunks.length - CHANGE_LIMITS.hunksPerFile;
          f.hunks.splice(0, drop);
          f.hunksDropped += drop;
        }
      } else if (p.read && !r.error) {
        const f = this.file(p.read);
        f.reads++;
        f.lastTs = Math.max(f.lastTs, ts || p.ts);
      }
    }
  }
}

/* ---------------- output ---------------- */

/** A path relative to the session's folder; outside it, under ~ or shortened to its last segments. */
export function relPath(abs: string, cwd: string | null, home = os.homedir()): string {
  if (!path.isAbsolute(abs)) return abs;
  const norm = path.normalize(abs);
  if (cwd) {
    const c = path.normalize(cwd).replace(/\/+$/, '');
    if (norm === c) return path.basename(norm);
    if (norm.startsWith(c + '/')) return norm.slice(c.length + 1);
  }
  if (home && norm.startsWith(home.replace(/\/+$/, '') + '/')) {
    const rest = norm.slice(home.replace(/\/+$/, '').length + 1);
    const parts = rest.split('/');
    return parts.length > 4 ? `~/…/${parts.slice(-3).join('/')}` : `~/${rest}`;
  }
  const parts = norm.split('/').filter(Boolean);
  return parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : norm;
}

/** Merges per-transcript accumulators (session-wide view); the newest hunks win. */
export function mergeAccs(list: { agentId: string; files: Map<string, FileAcc> }[]): Map<string, FileAcc & { agents: string[] }> {
  const out = new Map<string, FileAcc & { agents: string[] }>();
  for (const { agentId, files } of list) {
    for (const f of files.values()) {
      const m = out.get(f.abs);
      if (!m) { out.set(f.abs, { ...f, hunks: [...f.hunks], agents: f.edits || f.failed ? [agentId] : [] }); continue; }
      m.added += f.added; m.removed += f.removed; m.edits += f.edits; m.failed += f.failed; m.reads += f.reads;
      m.lastTs = Math.max(m.lastTs, f.lastTs);
      m.write = m.write === 'created' || f.write === 'created' ? 'created' : (m.write ?? f.write);
      m.hunks.push(...f.hunks);
      m.hunksDropped += f.hunksDropped;
      if (f.edits || f.failed) m.agents.push(agentId);
    }
  }
  for (const m of out.values()) {
    m.hunks.sort((a, b) => a.ts - b.ts);
    if (m.hunks.length > CHANGE_LIMITS.hunksPerFile) {
      const drop = m.hunks.length - CHANGE_LIMITS.hunksPerFile;
      m.hunks.splice(0, drop);
      m.hunksDropped += drop;
    }
  }
  return out;
}

/** Builds the response from accumulated state (copies: the sink keeps changing). */
export function buildChanges(
  files: Iterable<FileAcc & { agents?: string[] }>, steps: AgentStep[], stepsTotal: number,
  meta: { sessionId: string; agentId: string; cwd: string | null; now?: number; home?: string },
): AgentChanges {
  const changed: FileChange[] = [];
  const reads: FileRead[] = [];
  let readsTotal = 0;
  const totals = { files: 0, added: 0, removed: 0, edits: 0, failed: 0 };
  for (const f of files) {
    const rel = relPath(f.abs, meta.cwd, meta.home);
    if (f.edits || f.failed) {
      const c: FileChange = {
        path: rel, name: path.basename(f.abs), added: f.added, removed: f.removed, edits: f.edits, failed: f.failed,
        reads: f.reads, lastTs: f.lastTs, write: f.write, hunks: f.hunks.map((h) => ({ ...h, lines: [...h.lines] })),
      };
      if (f.hunksDropped) c.hunksDropped = f.hunksDropped;
      if (f.agents?.length) c.agents = [...f.agents];
      changed.push(c);
      totals.failed += f.failed;
      if (f.edits) { totals.files++; totals.added += f.added; totals.removed += f.removed; totals.edits += f.edits; }
    } else if (f.reads) {
      readsTotal++;
      reads.push({ path: rel, name: path.basename(f.abs), count: f.reads, lastTs: f.lastTs });
    }
  }
  // Successful changes first (newest first), then files whose every attempt failed.
  changed.sort((a, b) => (Number(b.edits > 0) - Number(a.edits > 0)) || (b.lastTs - a.lastTs) || a.path.localeCompare(b.path));
  reads.sort((a, b) => (b.lastTs - a.lastTs) || a.path.localeCompare(b.path));
  return {
    sessionId: meta.sessionId, agentId: meta.agentId, cwd: meta.cwd,
    files: changed.slice(0, CHANGE_LIMITS.files),
    filesTotal: changed.length,
    reads: reads.slice(0, CHANGE_LIMITS.reads),
    readsTotal,
    totals,
    steps: steps.slice(-CHANGE_LIMITS.steps).map((s) => ({ ...s })),
    stepsTotal,
    generatedAt: meta.now ?? Date.now(),
  };
}

/* ---------------- cache + endpoint ---------------- */

interface Cached { offset: number; mtimeMs: number; size: number; sink: ChangesSink }
const cache = new Map<string, Cached>();
const CACHE_MAX = 32;

/** The sink of one transcript, parsed from where it stopped last time (transcripts only grow). */
export async function sinkFor(f: FileSummary): Promise<ChangesSink | null> {
  let st: { size: number; mtimeMs: number };
  try { st = await fs.stat(f.path); } catch { return null; }
  let hit = cache.get(f.path);
  // A shorter file was replaced or truncated: parse it again.
  if (hit && st.size < hit.size) hit = undefined;
  if (!hit) hit = { offset: 0, mtimeMs: 0, size: 0, sink: new ChangesSink(f.agentId === null) };
  if (st.size !== hit.offset) {
    try { hit.offset = await readLines(f.path, hit.offset, hit.sink); } catch { return null; }
  }
  hit.size = st.size;
  hit.mtimeMs = st.mtimeMs;
  cache.delete(f.path);
  cache.set(f.path, hit);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return hit.sink;
}

/** For tests. */
export function clearChangesCache() { cache.clear(); }

/**
 * GET /api/session/:id/agent/:agentId/changes. `agentId` is a subagent id, 'main' (the session's own agent) or
 * 'all' (every transcript of the session, files only). Null when the session or agent is unknown.
 */
export async function agentChanges(files: FileSummary[], sessionId: string, agentId: string, opts: { isMissing?: (p: string) => boolean; now?: number; home?: string } = {}): Promise<AgentChanges | null> {
  if (!files.length) return null;
  const missing = opts.isMissing ?? (() => false);
  const main = files.find((f) => f.agentId === null) ?? null;
  const baseCwd = main?.cwd ?? files[0].cwd ?? null;
  const meta = { sessionId, agentId, now: opts.now, home: opts.home };
  if (agentId === 'all') {
    const list: { agentId: string; files: Map<string, FileAcc> }[] = [];
    let any = false;
    for (const f of files) {
      if (missing(f.path)) continue;
      const sink = await sinkFor(f);
      if (!sink) continue;
      any = true;
      list.push({ agentId: f.agentId ?? 'main', files: sink.files });
    }
    const out = buildChanges(mergeAccs(list).values(), [], 0, { ...meta, cwd: baseCwd });
    if (!any) out.archived = true;
    return out;
  }
  const f = files.find((x) => (agentId === 'main' ? x.agentId === null : x.agentId === agentId));
  if (!f) return null;
  const cwd = f.cwd ?? baseCwd;
  const sink = missing(f.path) ? null : await sinkFor(f);
  if (!sink) {
    const out = buildChanges([], [], 0, { ...meta, cwd });
    out.archived = true;
    return out;
  }
  return buildChanges(sink.files.values(), sink.steps, sink.stepsTotal, { ...meta, cwd });
}

export async function sessionAgentChanges(store: Store, sessionId: string, agentId: string): Promise<AgentChanges | null> {
  return agentChanges(store.sessionFiles(sessionId), sessionId, agentId, { isMissing: (p) => store.isMissing(p) });
}
