// Cowork sessions of the Claude desktop app: discovery, metadata, project names and the live snapshot.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { coworkDir } from '../config';
import { COWORK_PROJECT, clearCoworkCache, coworkProject, coworkProjectRoots, coworkSessionDir, readCoworkMeta } from '../cowork';
import { Hooks } from '../hooks';
import { Live } from '../live';
import { identify } from '../scanner';
import { Store } from '../store';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-cowork-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const COWORK = path.join(tmp, 'local-agent-mode-sessions');
const PROJECTS = path.join(tmp, 'claude', 'projects');
const ORG = path.join(COWORK, 'acct-1', 'org-1');
const SID_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const SID_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const SID_CLI = 'cccccccc-0000-4000-8000-000000000003';

const asst = (cwd: string, ts: number, req: string) => JSON.stringify({
  type: 'assistant', isSidechain: false, requestId: req, timestamp: new Date(ts).toISOString(), cwd, entrypoint: 'local-agent',
  message: { model: 'claude-opus-5-5', id: `msg_${req}`, content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 } },
});

/** One Cowork session: `local_<id>.json` (unless `meta` is null) and its transcript. */
function coworkSession(id: string, sid: string, meta: Record<string, unknown> | null, ts: number): string {
  const dir = path.join(ORG, `local_${id}`);
  const cwd = path.join(dir, 'outputs');
  const pd = path.join(dir, '.claude', 'projects', cwd.replace(/[^\w]/g, '-'));
  fs.mkdirSync(pd, { recursive: true });
  const file = path.join(pd, `${sid}.jsonl`);
  fs.writeFileSync(file, asst(cwd, ts, `r-${id}`) + '\n');
  if (meta) fs.writeFileSync(`${dir}.json`, JSON.stringify(meta));
  return file;
}

const now = Date.now();
const fileA = coworkSession('a1', SID_A, {
  sessionId: 'local_a1', title: 'Quarterly report', userSelectedFolders: ['/Users/someone/Projects/reports'], isArchived: false,
  emailAddress: 'someone@example.com', systemPrompt: 'secret',
}, now - 60_000);
const fileB = coworkSession('b2', SID_B, null, now - 2 * 3_600_000);
// The skills plugin folder sits next to the accounts and is not a session.
fs.mkdirSync(path.join(COWORK, 'skills-plugin', 'org-1', 'acct-1', 'skills'), { recursive: true });
// A regular Claude Code session.
fs.mkdirSync(path.join(PROJECTS, '-work-api'), { recursive: true });
fs.writeFileSync(path.join(PROJECTS, '-work-api', `${SID_CLI}.jsonl`), asst('/work/api', now - 30_000, 'r-cli').replace('local-agent', 'cli') + '\n');

beforeEach(() => clearCoworkCache());

describe('Cowork folder', () => {
  it('the default location per platform, an explicit one, and off', () => {
    expect(coworkDir(undefined, 'darwin', '/Users/me')).toBe('/Users/me/Library/Application Support/Claude/local-agent-mode-sessions');
    expect(coworkDir(undefined, 'linux', '/home/me')).toBe('/home/me/.config/Claude/local-agent-mode-sessions');
    expect(coworkDir(undefined, 'win32', 'C:\\Users\\me')).toBe('');
    expect(coworkDir('/elsewhere/cowork', 'darwin', '/Users/me')).toBe(path.resolve('/elsewhere/cowork'));
    expect(coworkDir('off', 'darwin', '/Users/me')).toBe('');
  });

  it('finds the projects dir of every session and nothing else', () => {
    expect(coworkProjectRoots(COWORK).sort()).toEqual([
      path.join(ORG, 'local_a1', '.claude', 'projects'),
      path.join(ORG, 'local_b2', '.claude', 'projects'),
    ]);
    expect(coworkProjectRoots(path.join(tmp, 'missing'))).toEqual([]);
    expect(coworkProjectRoots('')).toEqual([]);
  });

  it('identifies a Cowork transcript outside the main projects dir', () => {
    expect(identify(PROJECTS, fileA)).toMatchObject({ sessionId: SID_A, agentId: null });
    const sub = path.join(path.dirname(fileA), SID_A, 'subagents', 'agent-x1.jsonl');
    expect(identify(PROJECTS, sub)).toMatchObject({ sessionId: SID_A, agentId: 'x1' });
    expect(identify(PROJECTS, path.join(tmp, 'random', 'file.jsonl'))).toBeNull();
  });
});

describe('Cowork metadata', () => {
  it('reads only the title, the first folder and the archived flag', () => {
    const m = readCoworkMeta(path.join(ORG, 'local_a1'));
    expect(m).toEqual({ title: 'Quarterly report', folder: '/Users/someone/Projects/reports', archived: false });
    expect(readCoworkMeta(path.join(ORG, 'local_b2'))).toBeNull();
  });

  it('the project is the chosen folder, or Cowork', () => {
    expect(coworkSessionDir(path.join(ORG, 'local_a1', 'outputs'), COWORK)).toBe(path.join(ORG, 'local_a1'));
    expect(coworkProject(path.join(ORG, 'local_a1', 'outputs'), COWORK)).toBe('reports');
    expect(coworkProject(path.join(ORG, 'local_b2', 'outputs'), COWORK)).toBe(COWORK_PROJECT);
    expect(coworkProject('/work/api', COWORK)).toBeNull();
  });

  it('picks up a renamed session after the file changes', () => {
    const dir = path.join(ORG, 'local_a1');
    expect(readCoworkMeta(dir, 1000)?.title).toBe('Quarterly report');
    const j = JSON.parse(fs.readFileSync(`${dir}.json`, 'utf8'));
    fs.writeFileSync(`${dir}.json`, JSON.stringify({ ...j, title: 'Q3 report' }));
    const later = fs.statSync(`${dir}.json`).mtimeMs;
    fs.utimesSync(`${dir}.json`, new Date(), new Date(later + 2000));
    expect(readCoworkMeta(dir, 1000 + 10_000)?.title).toBe('Q3 report');
    fs.writeFileSync(`${dir}.json`, JSON.stringify(j));
  });
});

describe('Cowork in the store and the live snapshot', () => {
  it('scans Cowork transcripts only when a Cowork dir is given', async () => {
    const without = new Store(PROJECTS, null, { knownPlugins: [] });
    expect(without.listAll()).toEqual([path.join(PROJECTS, '-work-api', `${SID_CLI}.jsonl`)]);
    const store = new Store(PROJECTS, null, { knownPlugins: [] }, COWORK);
    expect(store.listAll().sort()).toEqual([path.join(PROJECTS, '-work-api', `${SID_CLI}.jsonl`), fileA, fileB].sort());
    expect(store.isCowork(fileA)).toBe(true);
    expect(store.isCowork(path.join(PROJECTS, '-work-api', `${SID_CLI}.jsonl`))).toBe(false);
  });

  it('marks Cowork sessions, takes the desktop title, and counts a recent one as live', async () => {
    const store = new Store(PROJECTS, null, { knownPlugins: [] }, COWORK);
    await store.coldScan(0);
    const live = new Live(store, new Hooks());
    const snap = live.snapshot('en');
    const a = snap.sessions.find((s) => s.sessionId === SID_A)!;
    const b = snap.sessions.find((s) => s.sessionId === SID_B)!;
    const cli = snap.sessions.find((s) => s.sessionId === SID_CLI)!;
    expect(snap.cowork).toBe(true);
    expect(a).toMatchObject({ source: 'cowork', project: 'reports', title: 'Quarterly report', alive: true, status: 'idle', entrypoint: 'local-agent', kind: 'interactive' });
    expect(b).toMatchObject({ source: 'cowork', project: 'Cowork', title: null, alive: false, status: 'stopped' });
    expect(cli.source).toBeUndefined();
    expect(cli.alive).toBe(false);
  });

  it('an archived Cowork session is not live', async () => {
    const dir = path.join(ORG, 'local_a1');
    const j = JSON.parse(fs.readFileSync(`${dir}.json`, 'utf8'));
    fs.writeFileSync(`${dir}.json`, JSON.stringify({ ...j, isArchived: true }));
    try {
      const store = new Store(PROJECTS, null, { knownPlugins: [] }, COWORK);
      await store.coldScan(0);
      const a = new Live(store, new Hooks()).snapshot('en').sessions.find((s) => s.sessionId === SID_A)!;
      expect(a.alive).toBe(false);
    } finally {
      fs.writeFileSync(`${dir}.json`, JSON.stringify(j));
    }
  });
});
