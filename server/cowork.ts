// Cowork sessions of the Claude desktop app (read-only).
//
// Each Cowork session runs Claude Code with a config dir of its own, so its transcripts have the same
// format as ~/.claude's (entrypoint 'local-agent'):
//   <COWORK_DIR>/<account>/<org>/local_<id>/.claude/projects/<dir>/<session>.jsonl   (+ <session>/subagents/…)
//   <COWORK_DIR>/<account>/<org>/local_<id>.json   the desktop's metadata: title, chosen folders, archived, …
// The metadata file also holds the account e-mail, the system prompt and MCP configs: only the few fields
// below are ever read from it. The layout is not documented by Anthropic, so every step is optional —
// a missing or changed folder just means no Cowork sessions.
import fs from 'node:fs';
import path from 'node:path';
import { COWORK_DIR } from './config';

/** Project name of a Cowork session without a chosen folder. */
export const COWORK_PROJECT = 'Cowork';
/** A Cowork session has no process Clorbit can see: it counts as live this long after its last activity. */
export const COWORK_LIVE_MS = 15 * 60_000;

const SEP = path.sep;
const SESSION_DIR = /^local_[\w-]+$/;

export interface CoworkMeta {
  /** The session's title in the desktop app (the user can rename it there). */
  title: string | null;
  /** The first folder the user gave the session, if any. */
  folder: string | null;
  archived: boolean;
}

const inside = (dir: string, p: string) => !!dir && p.startsWith(dir + SEP);

/** Is this path inside the Cowork folder? */
export function isCoworkPath(p: string | null | undefined, dir = COWORK_DIR): boolean {
  return !!p && inside(dir, p);
}

/** The `projects` dirs of all Cowork sessions (`…/local_<id>/.claude/projects`). */
export function coworkProjectRoots(dir = COWORK_DIR): string[] {
  const out: string[] = [];
  if (!dir) return out;
  const ls = (p: string) => { try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; } };
  for (const account of ls(dir)) {
    if (!account.isDirectory() || account.name === 'skills-plugin') continue;
    for (const org of ls(path.join(dir, account.name))) {
      if (!org.isDirectory()) continue;
      for (const s of ls(path.join(dir, account.name, org.name))) {
        if (!s.isDirectory() || !SESSION_DIR.test(s.name)) continue;
        const root = path.join(dir, account.name, org.name, s.name, '.claude', 'projects');
        if (fs.existsSync(root)) out.push(root);
      }
    }
  }
  return out;
}

/** `<COWORK_DIR>/<account>/<org>/local_<id>` of a path inside a Cowork session (a transcript or its cwd). */
export function coworkSessionDir(p: string | null | undefined, dir = COWORK_DIR): string | null {
  if (!p || !inside(dir, p)) return null;
  const rel = p.slice(dir.length + 1).split(SEP);
  if (rel.length < 3 || !SESSION_DIR.test(rel[2])) return null;
  return path.join(dir, rel[0], rel[1], rel[2]);
}

const META_TTL_MS = 5000;
const metaCache = new Map<string, { at: number; mtime: number; v: CoworkMeta | null }>();

/** The desktop's metadata of a Cowork session (cached; re-read when the file changes). */
export function readCoworkMeta(sessionDir: string, now = Date.now()): CoworkMeta | null {
  const file = `${sessionDir}.json`;
  const hit = metaCache.get(file);
  if (hit && now - hit.at < META_TTL_MS) return hit.v;
  let mtime = -1;
  try { mtime = fs.statSync(file).mtimeMs; } catch { /* no metadata */ }
  if (hit && hit.mtime === mtime) { hit.at = now; return hit.v; }
  let v: CoworkMeta | null = null;
  if (mtime >= 0) {
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const folders = Array.isArray(j?.userSelectedFolders) ? j.userSelectedFolders.filter((x: unknown) => typeof x === 'string' && x) : [];
      v = {
        title: typeof j?.title === 'string' && j.title.trim() ? j.title.trim().slice(0, 200) : null,
        folder: folders.length ? String(folders[0]) : null,
        archived: j?.isArchived === true,
      };
    } catch { /* being written right now: try again later */ }
  }
  if (metaCache.size > 2000) metaCache.clear();
  metaCache.set(file, { at: now, mtime, v });
  return v;
}

/** Metadata of the Cowork session a path belongs to (null outside Cowork). */
export function coworkMetaOf(p: string | null | undefined, dir = COWORK_DIR): CoworkMeta | null {
  const sd = coworkSessionDir(p, dir);
  return sd ? readCoworkMeta(sd) : null;
}

/**
 * Project of a Cowork session: the folder the user chose for it, or 'Cowork'. Its cwd is the session's
 * own `outputs` folder inside the desktop's data, which says nothing to a person. Null outside Cowork.
 */
export function coworkProject(cwd: string | null | undefined, dir = COWORK_DIR): string | null {
  const sd = coworkSessionDir(cwd, dir);
  if (!sd) return null;
  const folder = readCoworkMeta(sd)?.folder;
  return (folder && path.basename(folder)) || COWORK_PROJECT;
}

/** Test hook. */
export function clearCoworkCache() { metaCache.clear(); }
