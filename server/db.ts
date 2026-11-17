// Persistent storage: one SQLite file (node:sqlite, WAL) with versioned migrations.
// Holds per-file transcript summaries (outliving the transcripts themselves),
// hook events and subscription-limit history.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { SUMMARY_VERSION, type FileSummary } from './types';

type SqliteModule = typeof import('node:sqlite');
let sqliteMod: SqliteModule | null = null;

/**
 * Loads node:sqlite lazily, swallowing only its own ExperimentalWarning.
 * Every other warning still goes through the original process.emitWarning.
 */
function loadSqlite(): SqliteModule {
  if (sqliteMod) return sqliteMod;
  const orig = process.emitWarning;
  process.emitWarning = function (this: unknown, warning: string | Error, ...rest: any[]) {
    const msg = typeof warning === 'string' ? warning : warning?.message;
    const opt = rest[0];
    const type = typeof opt === 'string' ? opt : opt?.type ?? (typeof warning === 'object' ? warning?.name : undefined);
    if (type === 'ExperimentalWarning' && /sqlite/i.test(String(msg))) return;
    return (orig as any).call(process, warning, ...rest);
  } as typeof process.emitWarning;
  try {
    sqliteMod = createRequire(import.meta.url)('node:sqlite') as SqliteModule;
  } finally {
    process.emitWarning = orig;
  }
  return sqliteMod;
}

/** Schema migrations; index + 1 is the schema version they produce. Never edit a shipped one — append. */
const MIGRATIONS: ((db: DatabaseSync) => void)[] = [
  // v1: summaries, hook events, limits history.
  (db) => db.exec(`
    CREATE TABLE file_summaries (
      path          TEXT PRIMARY KEY,
      session_id    TEXT NOT NULL,
      agent_id      TEXT,
      version       INTEGER NOT NULL,
      size          INTEGER NOT NULL,
      mtime_ms      REAL NOT NULL,
      byte_offset   INTEGER NOT NULL,
      first_ts      INTEGER NOT NULL,
      last_ts       INTEGER NOT NULL,
      summary_json  TEXT NOT NULL,
      missing_since INTEGER,
      updated_at    INTEGER NOT NULL
    );
    CREATE INDEX file_summaries_session ON file_summaries(session_id);

    CREATE TABLE hook_events (
      id                INTEGER PRIMARY KEY,
      ts                INTEGER NOT NULL,
      session_id        TEXT,
      event             TEXT NOT NULL,
      tool              TEXT,
      agent_id          TEXT,
      notification_type TEXT,
      payload_json      TEXT NOT NULL
    );
    CREATE INDEX hook_events_ts ON hook_events(ts);
    CREATE INDEX hook_events_session_ts ON hook_events(session_id, ts);

    CREATE TABLE limits (
      ts             INTEGER PRIMARY KEY,
      five_pct       REAL,
      five_resets_at INTEGER,
      week_pct       REAL,
      week_resets_at INTEGER
    );
  `),
  // v2: user settings (notifications, sounds, do not disturb, interface), one JSON value per key.
  (db) => db.exec(`
    CREATE TABLE settings (
      key        TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `),
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export interface StoredSummary { summary: FileSummary; missingSince: number | null }

export interface DbStats {
  path: string;
  sizeBytes: number;
  walBytes: number;
  schemaVersion: number;
  rows: { fileSummaries: number; archived: number; staleVersion: number; hookEvents: number; limits: number };
  jsonImport: unknown;
}

export class ClorbitDb {
  readonly db: DatabaseSync;
  private stmts = new Map<string, StatementSync>();

  private constructor(readonly file: string) {
    const { DatabaseSync } = loadSqlite();
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  static open(file: string): ClorbitDb { return new ClorbitDb(file); }

  /** Cached prepared statement. */
  stmt(sql: string): StatementSync {
    let s = this.stmts.get(sql);
    if (!s) this.stmts.set(sql, (s = this.db.prepare(sql)));
    return s;
  }

  /** Runs fn inside BEGIN/COMMIT (rolls back on throw). */
  tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const v = fn();
      this.db.exec('COMMIT');
      return v;
    } catch (e) {
      try { this.db.exec('ROLLBACK'); } catch { /* already rolled back */ }
      throw e;
    }
  }

  getMeta(key: string): string | null {
    const r = this.stmt('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
    return r ? r.value : null;
  }

  setMeta(key: string, value: string) {
    this.stmt('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  get schemaVersion(): number { return Number(this.getMeta('schema_version') ?? 0); }

  private migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const cur = this.schemaVersion;
    if (cur > SCHEMA_VERSION) throw new Error(`Database schema v${cur} is newer than this build (v${SCHEMA_VERSION})`);
    for (let v = cur; v < SCHEMA_VERSION; v++) {
      this.tx(() => {
        MIGRATIONS[v](this.db);
        this.setMeta('schema_version', String(v + 1));
      });
    }
  }

  // ---------- settings ----------

  getSetting(key: string): string | null {
    const r = this.stmt('SELECT value_json FROM settings WHERE key = ?').get(key) as { value_json: string } | undefined;
    return r ? r.value_json : null;
  }

  setSetting(key: string, valueJson: string, now = Date.now()) {
    this.stmt('INSERT INTO settings(key, value_json, updated_at) VALUES(?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at').run(key, valueJson, now);
  }

  // ---------- file summaries ----------

  /** Loads summaries of the current SUMMARY_VERSION; rows of other versions stay in the DB untouched. */
  loadSummaries(): StoredSummary[] {
    const rows = this.stmt('SELECT summary_json, missing_since FROM file_summaries WHERE version = ?').all(SUMMARY_VERSION) as { summary_json: string; missing_since: number | null }[];
    const out: StoredSummary[] = [];
    for (const r of rows) {
      try { out.push({ summary: JSON.parse(r.summary_json) as FileSummary, missingSince: r.missing_since ?? null }); } catch { /* corrupt row — will be rescanned if the file exists */ }
    }
    return out;
  }

  /** Upserts summaries in a single transaction. */
  upsertSummaries(items: StoredSummary[]) {
    if (!items.length) return;
    const st = this.stmt(`INSERT INTO file_summaries(path, session_id, agent_id, version, size, mtime_ms, byte_offset, first_ts, last_ts, summary_json, missing_since, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET session_id = excluded.session_id, agent_id = excluded.agent_id, version = excluded.version,
        size = excluded.size, mtime_ms = excluded.mtime_ms, byte_offset = excluded.byte_offset, first_ts = excluded.first_ts,
        last_ts = excluded.last_ts, summary_json = excluded.summary_json, missing_since = excluded.missing_since, updated_at = excluded.updated_at`);
    const now = Date.now();
    this.tx(() => {
      for (const { summary: s, missingSince } of items) {
        st.run(s.path, s.sessionId, s.agentId, s.v, s.size, s.mtimeMs, s.offset, Math.round(s.firstTs || 0), Math.round(s.lastTs || 0), JSON.stringify(s), missingSince, now);
      }
    });
  }

  /** Updates only missing_since for the given paths (null = present again). */
  setMissing(items: { path: string; missingSince: number | null }[]) {
    if (!items.length) return;
    const st = this.stmt('UPDATE file_summaries SET missing_since = ? WHERE path = ?');
    this.tx(() => { for (const it of items) st.run(it.missingSince, it.path); });
  }

  /**
   * One-time import of the legacy JSON cache (data/cache/summaries-v<N>.json).
   * Runs only when the DB has no summaries and no import was recorded. Only the
   * current SUMMARY_VERSION file is importable; others are reported and skipped.
   */
  importJsonCache(cacheDir: string): { file: string; count: number; skipped: string[] } | null {
    if (this.getMeta('json_import')) return null;
    const n = (this.stmt('SELECT COUNT(*) AS n FROM file_summaries').get() as { n: number }).n;
    let names: string[] = [];
    try { names = fs.readdirSync(cacheDir).filter((f) => /^summaries-v\d+\.json$/.test(f)); } catch { /* no legacy cache */ }
    const want = `summaries-v${SUMMARY_VERSION}.json`;
    const skipped = names.filter((f) => f !== want);
    if (n > 0 || !names.includes(want)) {
      this.setMeta('json_import', JSON.stringify({ at: Date.now(), file: null, count: 0, skipped, reason: n > 0 ? 'db-not-empty' : 'no-current-cache' }));
      return null;
    }
    const file = path.join(cacheDir, want);
    let files: FileSummary[] = [];
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8')) as { version: number; files: FileSummary[] };
      if (j.version === SUMMARY_VERSION && Array.isArray(j.files)) files = j.files.filter((s) => s && typeof s.path === 'string' && s.v === SUMMARY_VERSION);
    } catch (e) {
      console.warn('[clorbit] legacy JSON cache is unreadable, skipping import:', (e as Error).message);
    }
    this.upsertSummaries(files.map((summary) => ({ summary, missingSince: null })));
    this.setMeta('json_import', JSON.stringify({ at: Date.now(), file, count: files.length, skipped }));
    return { file, count: files.length, skipped };
  }

  stats(): DbStats {
    const one = (sql: string) => (this.stmt(sql).get() as { n: number }).n;
    const size = (f: string) => { try { return fs.statSync(f).size; } catch { return 0; } };
    let jsonImport: unknown = null;
    try { jsonImport = JSON.parse(this.getMeta('json_import') ?? 'null'); } catch { /* ignore */ }
    return {
      path: this.file,
      sizeBytes: size(this.file),
      walBytes: size(this.file + '-wal'),
      schemaVersion: this.schemaVersion,
      rows: {
        fileSummaries: one('SELECT COUNT(*) AS n FROM file_summaries'),
        archived: one('SELECT COUNT(*) AS n FROM file_summaries WHERE missing_since IS NOT NULL'),
        staleVersion: (this.stmt('SELECT COUNT(*) AS n FROM file_summaries WHERE version <> ?').get(SUMMARY_VERSION) as { n: number }).n,
        hookEvents: one('SELECT COUNT(*) AS n FROM hook_events'),
        limits: one('SELECT COUNT(*) AS n FROM limits'),
      },
      jsonImport,
    };
  }

  close() {
    try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* best effort */ }
    this.db.close();
  }
}
