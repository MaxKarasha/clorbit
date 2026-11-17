// Paths and settings. ~/.claude is only ever read; Clorbit's own data lives in ~/.clorbit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Reads CLORBIT_<name>, falling back silently to the legacy FLEET_<name>. */
export function env(name: string): string | undefined {
  return process.env[`CLORBIT_${name}`] || process.env[`FLEET_${name}`] || undefined;
}

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CLAUDE_DIR = env('CLAUDE_DIR') || path.join(os.homedir(), '.claude');
export const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
export const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
export const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
export const HOME_DATA_DIR = path.join(os.homedir(), '.clorbit');
/** Status-line capture file (written by the user's status-line command, see README). */
export const STATUSLINE_FILE = env('STATUSLINE_FILE') || path.join(HOME_DATA_DIR, 'statusline.json');
/** Legacy capture location, read only when the new file is missing. */
export const LEGACY_STATUSLINE_FILE = path.join(os.homedir(), '.fleet', 'statusline.json');
// The data dir holds clorbit.db (SQLite). CLORBIT_CACHE_DIR points at the legacy JSON cache, imported once.
export const DATA_DIR = env('DATA_DIR') || HOME_DATA_DIR;
export const DB_FILE = path.join(DATA_DIR, 'clorbit.db');
export const CACHE_DIR = env('CACHE_DIR') || path.join(DATA_DIR, 'cache');
export const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
export const PORT = Number(env('PORT')) || 4980;
export const HOST = '127.0.0.1';
/** Database location of pre-rename builds (`<repo>/data/fleet.db`). */
export const LEGACY_DB_FILE = path.join(PROJECT_ROOT, 'data', 'fleet.db');

/**
 * One-time migration: if the data dir has no clorbit.db yet but the pre-rename
 * `<repo>/data/fleet.db` exists, copy it over (with its WAL, so nothing is lost).
 * Returns the source path when a copy happened.
 */
export function migrateLegacyDb(dbFile = DB_FILE, legacy = LEGACY_DB_FILE): string | null {
  try {
    if (fs.existsSync(dbFile) || !fs.existsSync(legacy)) return null;
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    fs.copyFileSync(legacy, dbFile);
    for (const ext of ['-wal', '-shm']) {
      if (fs.existsSync(legacy + ext)) fs.copyFileSync(legacy + ext, dbFile + ext);
    }
    return legacy;
  } catch (e) {
    console.error(`[clorbit] could not migrate ${legacy}:`, (e as Error).message);
    return null;
  }
}

export interface ClaudeSettings {
  enabledPlugins: Record<string, boolean>;
  env: Record<string, string>;
}

let settingsCache: { mtime: number; v: ClaudeSettings } | null = null;

/** The user's Claude Code settings (read-only). */
export function readSettings(): ClaudeSettings {
  try {
    const st = fs.statSync(SETTINGS_FILE);
    if (settingsCache && settingsCache.mtime === st.mtimeMs) return settingsCache.v;
    const j = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    const v = { enabledPlugins: j.enabledPlugins ?? {}, env: j.env ?? {} };
    settingsCache = { mtime: st.mtimeMs, v };
    return v;
  } catch {
    return { enabledPlugins: {}, env: {} };
  }
}

/** Is Clorbit's hook plugin enabled? Accepts `clorbit@*` and the legacy `fleet-hooks@*`. */
export function hookPluginEnabled(settings: ClaudeSettings = readSettings()): boolean {
  return Object.entries(settings.enabledPlugins).some(([k, on]) => on && (k.startsWith('clorbit@') || k.startsWith('fleet-hooks@')));
}

/** Plugin names: enabled in settings.json + folders under plugins/cache. */
export function knownPlugins(): string[] {
  const names = new Set<string>();
  for (const k of Object.keys(readSettings().enabledPlugins)) names.add(k.split('@')[0]);
  try {
    const cache = path.join(CLAUDE_DIR, 'plugins', 'cache');
    for (const mkt of fs.readdirSync(cache)) {
      try { for (const p of fs.readdirSync(path.join(cache, mkt))) names.add(p); } catch { /* not a directory */ }
    }
  } catch { /* no plugin cache */ }
  // Longer names first so 'superpowers' is not beaten by shorter matches.
  return [...names].filter((n) => n.length >= 4).sort((a, b) => b.length - a.length);
}
