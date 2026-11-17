// File summary store: persisted cache, cold scan on a worker pool, incremental tail reads.
// Persistence: SQLite (server/db.ts); summaries of deleted transcripts are kept as archived.
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { BUNDLED } from './config';
import { scanFile, identify } from './scanner';
import type { ClorbitDb, StoredSummary } from './db';
import type { FileSummary, ScanEvent, ScanOptions } from './types';
import { migrateSummaryKeys } from './i18n';

export interface ScanStats { startedAt: number; finishedAt: number | null; filesTotal: number; filesDone: number; filesParsed: number; bytesParsed: number; fromCache: number; loadMs: number }

/** Lists all transcripts: main ones and subagents' (workflows included). */
export function listTranscripts(projectsDir: string): string[] {
  const out: string[] = [];
  let dirs: string[] = [];
  try { dirs = fs.readdirSync(projectsDir); } catch { return out; }
  for (const d of dirs) {
    const pd = path.join(projectsDir, d);
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(pd, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.jsonl')) out.push(path.join(pd, e.name));
      else if (e.isDirectory()) {
        const sub = path.join(pd, e.name, 'subagents');
        let se: fs.Dirent[];
        try { se = fs.readdirSync(sub, { withFileTypes: true }); } catch { continue; }
        for (const x of se) {
          if (x.isFile() && x.name.startsWith('agent-') && x.name.endsWith('.jsonl')) out.push(path.join(sub, x.name));
          else if (x.isDirectory() && x.name === 'workflows') {
            let wfs: string[] = [];
            try { wfs = fs.readdirSync(path.join(sub, 'workflows')); } catch { continue; }
            for (const wf of wfs) {
              let af: string[] = [];
              try { af = fs.readdirSync(path.join(sub, 'workflows', wf)); } catch { continue; }
              for (const f of af) if (f.startsWith('agent-') && f.endsWith('.jsonl')) out.push(path.join(sub, 'workflows', wf, f));
            }
          }
        }
      }
    }
  }
  return out;
}

class Pool {
  private workers: { w: Worker; busy: boolean }[] = [];
  private queue: { msg: any; resolve: (v: any) => void; reject: (e: any) => void }[] = [];
  private cbs = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void; slot: { w: Worker; busy: boolean } }>();
  private seq = 0;
  constructor(n: number) {
    for (let i = 0; i < n; i++) {
      // In the single-file bundle the worker is the bundle itself (server/bundle.ts picks the role by thread).
      const w = new Worker(BUNDLED ? new URL(import.meta.url) : new URL('./scan-worker.ts', import.meta.url));
      const slot = { w, busy: false };
      w.on('message', (m: any) => {
        const cb = this.cbs.get(m.id);
        if (!cb) return;
        this.cbs.delete(m.id);
        slot.busy = false;
        if (m.error) cb.reject(new Error(m.error)); else cb.resolve(m.result);
        this.pump();
      });
      w.on('error', (e) => {
        for (const [id, cb] of this.cbs) if (cb.slot === slot) { this.cbs.delete(id); cb.reject(e); }
        slot.busy = true; // a broken worker is not used again
        (slot as any).broken = true;
        if (this.workers.every((x: any) => x.broken)) for (const j of this.queue.splice(0)) j.reject(e);
        this.pump();
      });
      this.workers.push(slot);
    }
  }
  run(msg: any): Promise<any> {
    return new Promise((resolve, reject) => { this.queue.push({ msg, resolve, reject }); this.pump(); });
  }
  private pump() {
    for (const slot of this.workers) {
      if (slot.busy || !this.queue.length) continue;
      const job = this.queue.shift()!;
      const id = ++this.seq;
      slot.busy = true;
      this.cbs.set(id, { resolve: job.resolve, reject: job.reject, slot });
      slot.w.postMessage({ id, ...job.msg });
    }
  }
  async close() { await Promise.all(this.workers.map((s) => s.w.terminate())); }
}

export class Store extends EventEmitter {
  files = new Map<string, FileSummary>();
  bySession = new Map<string, Set<string>>();
  /** Paths whose transcript is gone from disk → when it was first noticed missing. Their summaries stay in `files`. */
  missing = new Map<string, number>();
  version = 0;
  stats: ScanStats = { startedAt: 0, finishedAt: null, filesTotal: 0, filesDone: 0, filesParsed: 0, bytesParsed: 0, fromCache: 0, loadMs: 0 };
  /** Persistence diagnostics: last flush and JSON-cache import. */
  persist = { lastFlushAt: 0, lastFlushMs: 0, lastFlushRows: 0, flushes: 0, imported: null as null | { file: string; count: number; skipped: string[] } };
  scanDone = false;
  private inflight = new Map<string, Promise<void>>();
  private saveTimer: NodeJS.Timeout | null = null;
  private dirtyPaths = new Set<string>();
  private flushing: Promise<void> | null = null;

  constructor(public projectsDir: string, public db: ClorbitDb | null, public opts: ScanOptions) { super(); }

  /**
   * Warm start: optionally imports the legacy JSON cache once, then loads all
   * current-version summaries (including archived ones) from SQLite.
   */
  loadCache(legacyCacheDir?: string) {
    const t0 = Date.now();
    if (!this.db) return;
    try {
      if (legacyCacheDir) this.persist.imported = this.db.importJsonCache(legacyCacheDir);
      for (const { summary, missingSince } of this.db.loadSummaries()) {
        migrateSummaryKeys(summary);
        this.put(summary, false, false);
        if (missingSince !== null) this.missing.set(summary.path, missingSince);
      }
    } catch (e) {
      console.error('[clorbit] could not read the database:', (e as Error).message);
    }
    this.stats.loadMs = Date.now() - t0;
  }

  private put(s: FileSummary, bump = true, persist = true) {
    this.files.set(s.path, s);
    let set = this.bySession.get(s.sessionId);
    if (!set) this.bySession.set(s.sessionId, (set = new Set()));
    set.add(s.path);
    if (persist) {
      this.missing.delete(s.path);
      this.dirtyPaths.add(s.path);
    }
    if (bump) this.version++;
  }

  /**
   * The transcript disappeared from disk (e.g. Claude Code's 30-day cleanup).
   * Its summary is kept for analytics and the row is flagged with missing_since.
   */
  markMissing(file: string, ts = Date.now()) {
    if (!this.files.has(file) || this.missing.has(file)) return;
    this.missing.set(file, ts);
    this.dirtyPaths.add(file);
    this.version++;
    this.scheduleSave();
  }

  isMissing(file: string): boolean { return this.missing.has(file); }

  /** Kept for API compatibility: removal now archives instead of dropping. */
  remove(file: string) { this.markMissing(file); }

  sessionFiles(sessionId: string): FileSummary[] {
    const set = this.bySession.get(sessionId);
    if (!set) return [];
    const out: FileSummary[] = [];
    for (const p of set) { const s = this.files.get(p); if (s) out.push(s); }
    return out;
  }

  mainOf(sessionId: string): FileSummary | null {
    for (const s of this.sessionFiles(sessionId)) if (s.agentId === null) return s;
    return null;
  }

  /** Cold scan in the background. HTTP already responds meanwhile. */
  async coldScan(threads = Math.max(2, Math.min(8, os.cpus().length - 2))): Promise<void> {
    const st = this.stats;
    st.startedAt = Date.now();
    const list = listTranscripts(this.projectsDir);
    const withM = list.map((f) => { try { const s = fs.statSync(f); return { f, m: s.mtimeMs, size: s.size }; } catch { return null; } })
      .filter((x): x is { f: string; m: number; size: number } => !!x)
      .sort((a, b) => b.m - a.m); // fresh files first so live sessions show up sooner
    st.filesTotal = withM.length;
    // Transcripts gone from disk are archived (kept), not dropped.
    const present = new Set(withM.map((x) => x.f));
    const now = Date.now();
    for (const p of [...this.files.keys()]) if (!present.has(p)) this.markMissing(p, now);
    const todo: typeof withM = [];
    for (const x of withM) {
      const prev = this.files.get(x.f);
      if (prev && prev.size === x.size && prev.mtimeMs === x.m) {
        st.filesDone++; st.fromCache++;
        // The file is back (restored from a backup, say) and unchanged: just clear the flag.
        if (this.missing.delete(x.f)) { this.dirtyPaths.add(x.f); this.version++; }
      } else todo.push(x);
    }
    if (todo.length) {
      let pool: Pool | null = null;
      try { pool = threads > 0 ? new Pool(Math.min(threads, todo.length)) : null; } catch { pool = null; }
      await Promise.all(todo.map((x) => this.enqueue(x.f, async () => {
        const prev = this.files.get(x.f) ?? null;
        let r: any = null;
        try {
          r = pool ? await pool.run({ projectsDir: this.projectsDir, file: x.f, prev, opts: this.opts })
            : await scanFile(this.projectsDir, x.f, prev, this.opts);
        } catch {
          r = await scanFile(this.projectsDir, x.f, prev, this.opts).catch(() => null);
        }
        if (r?.summary) { this.put(r.summary); st.filesParsed++; st.bytesParsed += r.bytes ?? 0; }
        st.filesDone++;
        this.scheduleSave(5000);
      })));
      await pool?.close();
    }
    st.finishedAt = Date.now();
    this.scanDone = true;
    this.version++;
    await this.flush();
    this.emit('scan-done');
  }

  private enqueue(file: string, job: () => Promise<void>): Promise<void> {
    const prev = this.inflight.get(file) ?? Promise.resolve();
    const next = prev.then(job, job).finally(() => { if (this.inflight.get(file) === next) this.inflight.delete(file); });
    this.inflight.set(file, next);
    return next;
  }

  /** Reads the new tail of a changed file on the main thread and reports new events. */
  refresh(file: string): Promise<void> {
    return this.enqueue(file, async () => {
      if (!identify(this.projectsDir, file)) return;
      if (!fs.existsSync(file)) { this.markMissing(file); return; }
      const prev = this.files.get(file) ?? null;
      const events: ScanEvent[] = [];
      const r = await scanFile(this.projectsDir, file, prev, this.opts, (e) => { if (events.length < 500) events.push(e); }).catch(() => null);
      if (!r || !r.changed) return;
      const isNew = !prev;
      this.put(r.summary);
      this.scheduleSave(5000);
      this.emit('file', r.summary, events, isNew);
    });
  }

  /** Throttled background flush of changed summaries to SQLite. */
  scheduleSave(ms = 5000) {
    if (!this.db || this.saveTimer) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = null; void this.flush(); }, ms);
    this.saveTimer.unref?.();
  }

  /**
   * Writes dirty summaries in small transactions, yielding to the event loop
   * between chunks so HTTP handlers are not held up by a large batch.
   */
  flush(chunk = 100): Promise<void> {
    if (!this.db) return Promise.resolve();
    if (this.flushing) return this.flushing.then(() => (this.dirtyPaths.size ? this.flush(chunk) : undefined));
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    const run = async () => {
      const t0 = performance.now();
      let rows = 0;
      while (this.dirtyPaths.size) {
        const batch: string[] = [];
        for (const p of this.dirtyPaths) { batch.push(p); if (batch.length >= chunk) break; }
        for (const p of batch) this.dirtyPaths.delete(p);
        rows += this.writeRows(batch);
        if (this.dirtyPaths.size) await new Promise<void>((r) => setImmediate(r));
      }
      this.persist.lastFlushAt = Date.now();
      this.persist.lastFlushMs = Math.round(performance.now() - t0);
      this.persist.lastFlushRows = rows;
      this.persist.flushes++;
    };
    this.flushing = run().catch((e) => {
      console.error('[clorbit] could not save summaries to the database:', (e as Error).message);
    }).finally(() => { this.flushing = null; });
    return this.flushing;
  }

  private writeRows(paths: string[]): number {
    const items: StoredSummary[] = [];
    for (const p of paths) {
      const s = this.files.get(p);
      if (s) items.push({ summary: s, missingSince: this.missing.get(p) ?? null });
    }
    this.db!.upsertSummaries(items);
    return items.length;
  }

  /** Synchronous flush of everything pending (shutdown path). */
  saveNow() {
    if (!this.db) return;
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    const paths = [...this.dirtyPaths];
    this.dirtyPaths.clear();
    try { this.writeRows(paths); } catch (e) {
      for (const p of paths) this.dirtyPaths.add(p);
      console.error('[clorbit] could not save summaries to the database:', (e as Error).message);
    }
  }

  get isDirty() { return this.dirtyPaths.size > 0; }
}
