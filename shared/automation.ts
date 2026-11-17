// Interactive vs automated sessions. An automated session is a run nobody sits in front of:
// `claude -p` from a script or CI, the Agent SDK, the GitHub Action, a scheduled routine.
// Each such run is its own session, so a busy pipeline makes hundreds of them a day.
//
// Signals, as Claude Code writes them (verified on real transcripts, Claude Code 2.1.3xx):
// - `entrypoint` on every transcript record and in sessions/<pid>.json: 'cli' for the interactive
//   terminal UI; `claude -p` turns 'cli' into 'sdk-cli'; the TypeScript / Python SDKs write 'sdk-ts' /
//   'sdk-py'; the GitHub Action 'claude-code-github-action'; `claude mcp serve` 'mcp'.
// - `kind` in sessions/<pid>.json: 'interactive' | 'bg' | 'daemon' | 'daemon-worker'.
// - the first user prompt's `turnOrigin` / `promptSource`: 'sdk' for SDK / -p runs, 'scheduled' for a
//   routine's first turn (a scheduled turn later in an interactive session does not count).
import type { SessionKind } from './api';

const AUTOMATED_ENTRYPOINTS = new Set(['claude-code-github-action', 'github-action', 'mcp', 'remote_trigger']);
const AUTOMATED_PID_KINDS = new Set(['daemon', 'daemon-worker']);
const AUTOMATED_ORIGINS = new Set(['sdk', 'scheduled']);

/** An entrypoint of a non-interactive run ('sdk-cli', 'sdk-ts', 'sdk-py', the GitHub Action, ...). */
export function isAutomatedEntrypoint(ep: string | null | undefined): boolean {
  if (!ep) return false;
  return ep.startsWith('sdk-') || AUTOMATED_ENTRYPOINTS.has(ep);
}

export interface KindSignals {
  /** `kind` from sessions/<pid>.json. */
  pidKind?: string | null;
  /** `entrypoint` from sessions/<pid>.json. */
  pidEntrypoint?: string | null;
  /** `entrypoint` from the transcript. */
  entrypoint?: string | null;
  /** `turnOrigin` (or `promptSource`) of the session's first user prompt. */
  promptOrigin?: string | null;
}

/** Classifies a session; anything without an automated signal is interactive. */
export function sessionKind(s: KindSignals): SessionKind {
  if (s.pidKind && AUTOMATED_PID_KINDS.has(s.pidKind)) return 'automated';
  if (isAutomatedEntrypoint(s.pidEntrypoint) || isAutomatedEntrypoint(s.entrypoint)) return 'automated';
  // An explicit interactive entrypoint wins over a prompt origin.
  if (s.entrypoint === 'cli' || s.pidEntrypoint === 'cli') return 'interactive';
  if (s.promptOrigin && AUTOMATED_ORIGINS.has(s.promptOrigin)) return 'automated';
  return 'interactive';
}
