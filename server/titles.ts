// The title a session is shown under, everywhere on the server (live, analytics, replay, insights).
import { COWORK_DIR } from './config';
import { coworkMetaOf } from './cowork';
import type { FileSummary } from './types';

type Main = Pick<FileSummary, 'sessionId' | 'path' | 'title' | 'customTitle'>;

/** Names given to sessions in Clorbit (Settings.sessionNames), set by the server from the settings store. */
let names: Readonly<Record<string, string>> = {};
export function setSessionNames(m: Readonly<Record<string, string>>) { names = m; }

/** The name given in Clorbit, if any. */
export function clorbitName(sessionId: string): string | null {
  return Object.prototype.hasOwnProperty.call(names, sessionId) ? names[sessionId] : null;
}

/**
 * The title without Clorbit's name: Claude Code's /rename title, then a Cowork session's title in the desktop
 * app (the user may have renamed it there), then Claude Code's latest ai-title.
 */
export function autoTitle(main: Main | null | undefined, coworkDir = COWORK_DIR): string | null {
  if (!main) return null;
  return main.customTitle || coworkMetaOf(main.path, coworkDir)?.title || main.title || null;
}

/** The title shown: the name given in Clorbit, otherwise autoTitle. */
export function sessionTitle(main: Main | null | undefined, coworkDir = COWORK_DIR): string | null {
  if (!main) return null;
  return clorbitName(main.sessionId) ?? autoTitle(main, coworkDir);
}

/** `{ title, autoTitle? }` for API objects: autoTitle only for a renamed session. */
export function titleFields(sessionId: string, main: Main | null | undefined, coworkDir = COWORK_DIR): { title: string | null; autoTitle?: string | null } {
  const name = clorbitName(sessionId);
  const auto = autoTitle(main, coworkDir);
  return name ? { title: name, autoTitle: auto } : { title: auto };
}
