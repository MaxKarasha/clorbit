// The title a session is shown under, everywhere on the server (live, analytics, replay, insights).
import { COWORK_DIR } from './config';
import { coworkMetaOf } from './cowork';
import type { FileSummary } from './types';

/**
 * A Cowork session's title in the desktop app (the user may have renamed it there), otherwise Claude Code's
 * latest ai-title from the transcript.
 */
export function sessionTitle(main: Pick<FileSummary, 'path' | 'title'> | null | undefined, coworkDir = COWORK_DIR): string | null {
  if (!main) return null;
  return coworkMetaOf(main.path, coworkDir)?.title ?? main.title ?? null;
}
