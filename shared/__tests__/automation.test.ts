// Interactive vs automated sessions (signals verified on real Claude Code transcripts).
import { describe, expect, it } from 'vitest';
import { isAutomatedEntrypoint, sessionKind } from '../automation';

describe('isAutomatedEntrypoint', () => {
  it('sdk-* and CI/server entrypoints are automated; cli, IDE and desktop are not', () => {
    for (const ep of ['sdk-cli', 'sdk-ts', 'sdk-py', 'claude-code-github-action', 'github-action', 'mcp', 'remote_trigger']) expect(isAutomatedEntrypoint(ep)).toBe(true);
    for (const ep of ['cli', 'claude-vscode', 'claude-desktop', 'remote', 'local-agent', '', null, undefined]) expect(isAutomatedEntrypoint(ep)).toBe(false);
  });
});

describe('sessionKind', () => {
  it('claude -p (entrypoint sdk-cli, promptSource sdk) is automated', () => {
    expect(sessionKind({ entrypoint: 'sdk-cli', promptOrigin: 'sdk' })).toBe('automated');
    expect(sessionKind({ pidEntrypoint: 'sdk-ts' })).toBe('automated');
  });
  it('an interactive CLI session stays interactive, even with a scheduled turn origin', () => {
    expect(sessionKind({ entrypoint: 'cli', promptOrigin: 'human' })).toBe('interactive');
    expect(sessionKind({ pidKind: 'interactive', pidEntrypoint: 'cli', entrypoint: 'cli', promptOrigin: 'scheduled' })).toBe('interactive');
  });
  it('daemon processes and a first turn from the SDK or a scheduler are automated when nothing says cli', () => {
    expect(sessionKind({ pidKind: 'daemon-worker', entrypoint: 'cli' })).toBe('automated');
    expect(sessionKind({ promptOrigin: 'sdk' })).toBe('automated');
    expect(sessionKind({ promptOrigin: 'scheduled' })).toBe('automated');
    expect(sessionKind({ pidKind: 'bg' })).toBe('interactive');
  });
  it('no signals at all: interactive', () => {
    expect(sessionKind({})).toBe('interactive');
    expect(sessionKind({ promptOrigin: '' })).toBe('interactive');
  });
});
