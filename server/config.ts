// Paths and settings. ~/.claude is only ever read; Clorbit's own data lives in ~/.clorbit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Reads CLORBIT_<name>, falling back silently to the legacy FLEET_<name>. */
export function env(name: string): string | undefined {
  return process.env[`CLORBIT_${name}`] || process.env[`FLEET_${name}`] || undefined;
}

// Set by scripts/build.mjs when the server is bundled into plugin/app/server.mjs.
declare const __CLORBIT_BUNDLED__: boolean | undefined;
declare const __CLORBIT_VERSION__: string | undefined;
/** True when running from the single-file bundle (plugin/app/server.mjs), false under tsx. */
export const BUNDLED = typeof __CLORBIT_BUNDLED__ !== 'undefined' && __CLORBIT_BUNDLED__;
const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Repository root in development; the plugin folder when bundled (unused there except for the legacy DB path). */
export const PROJECT_ROOT = path.resolve(HERE, '..');
export const CLAUDE_DIR = env('CLAUDE_DIR') || path.join(os.homedir(), '.claude');
export const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
export const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
export const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
/**
 * Claude Code's account file (read-only; only the plan fields of `oauthAccount` are used, see plan.ts).
 * CLORBIT_CLAUDE_JSON points at it directly. Otherwise it lives next to the Claude dir (~/.claude.json);
 * with CLORBIT_CLAUDE_DIR set, a .claude.json inside that dir (Claude Code's CLAUDE_CONFIG_DIR layout) wins.
 */
export const CLAUDE_JSON_FILES: string[] = env('CLAUDE_JSON')
  ? [env('CLAUDE_JSON')!]
  : env('CLAUDE_DIR')
    ? [path.join(CLAUDE_DIR, '.claude.json'), path.join(path.dirname(CLAUDE_DIR), '.claude.json')]
    : [path.join(os.homedir(), '.claude.json')];
/**
 * Cowork sessions of the Claude desktop app (read-only, see cowork.ts). CLORBIT_COWORK_DIR points elsewhere;
 * CLORBIT_COWORK_DIR=off turns them off. Empty on platforms where the desktop app keeps them somewhere unknown.
 */
export const COWORK_DIR: string = coworkDir(env('COWORK_DIR'));

export function coworkDir(v: string | undefined, platform = process.platform, home = os.homedir()): string {
  if (v) return v === 'off' || v === '0' ? '' : path.resolve(v);
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions');
  if (platform === 'linux') return path.join(home, '.config', 'Claude', 'local-agent-mode-sessions');
  return '';
}
export const HOME_DATA_DIR = path.join(os.homedir(), '.clorbit');
/** Status-line capture file (written by the user's status-line command, see README). */
export const STATUSLINE_FILE = env('STATUSLINE_FILE') || path.join(HOME_DATA_DIR, 'statusline.json');
/** Legacy capture location, read only when the new file is missing. */
export const LEGACY_STATUSLINE_FILE = path.join(os.homedir(), '.fleet', 'statusline.json');
// The data dir holds clorbit.db (SQLite). CLORBIT_CACHE_DIR points at the legacy JSON cache, imported once.
export const DATA_DIR = env('DATA_DIR') || HOME_DATA_DIR;
/** True when CLORBIT_DATA_DIR (or FLEET_DATA_DIR) points somewhere explicitly, i.e. not the default ~/.clorbit. */
export const DATA_DIR_EXPLICIT = !!env('DATA_DIR');
export const DB_FILE = path.join(DATA_DIR, 'clorbit.db');
export const CACHE_DIR = env('CACHE_DIR') || path.join(DATA_DIR, 'cache');
/** The built web app: next to the bundle (plugin/app/web), or where `pnpm build` puts it in development. */
export const DIST_DIR = BUNDLED ? path.join(HERE, 'web') : path.join(PROJECT_ROOT, 'plugin', 'app', 'web');
/** Serve the web app from the API server: on by default in the bundle, opt-in (CLORBIT_SERVE_WEB=1) in development. */
export const SERVE_WEB = env('SERVE_WEB') ? env('SERVE_WEB') === '1' : BUNDLED;
export const PORT = Number(env('PORT')) || 4980;
export const HOST = '127.0.0.1';
/** Version from package.json (injected at build time; read from package.json under tsx). */
export const VERSION: string = BUNDLED && typeof __CLORBIT_VERSION__ === 'string' ? __CLORBIT_VERSION__ : devVersion();

function devVersion(): string {
  try { return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8')).version ?? 'dev'; } catch { return 'dev'; }
}

/** Database location of pre-rename builds (`<repo>/data/fleet.db`). */
export const LEGACY_DB_FILE = path.join(PROJECT_ROOT, 'data', 'fleet.db');

/**
 * One-time migration: if the data dir has no clorbit.db yet but the pre-rename
 * `<repo>/data/fleet.db` exists, copy it over (with its WAL, so nothing is lost).
 * Only for the default data dir (~/.clorbit): a data dir set explicitly via
 * CLORBIT_DATA_DIR/FLEET_DATA_DIR is a deliberate fresh location (tests, demos,
 * a second instance) and must not inherit the repository's old database.
 * Returns the source path when a copy happened.
 */
export function migrateLegacyDb(
  { dbFile = DB_FILE, legacy = LEGACY_DB_FILE, explicitDataDir = DATA_DIR_EXPLICIT }: { dbFile?: string; legacy?: string; explicitDataDir?: boolean } = {},
): string | null {
  if (explicitDataDir) return null;
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
