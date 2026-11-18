// GET /api/session/:id/agent/:agentId/changes against a real server process over a synthetic Claude dir.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AgentChanges } from '../../shared/api.ts';

const root = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-changes-api-'));
const SID = 'ffffffff-1111-2222-3333-444444444444';
const CWD = '/work/shop';
let server: ChildProcess | null = null;
let base = '';

const at = (sec: number) => new Date(Date.UTC(2026, 10, 18, 9, 0, sec)).toISOString();
const asst = (sec: number, blocks: unknown[]) => JSON.stringify({ parentUuid: null, isSidechain: false, cwd: CWD, sessionId: SID, message: { id: `m${sec}`, model: 'claude-opus-5-5', role: 'assistant', content: blocks, stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 } }, requestId: `r${sec}`, type: 'assistant', timestamp: at(sec) });
const result = (sec: number, id: string, error = false) => JSON.stringify({ parentUuid: null, isSidechain: false, cwd: CWD, sessionId: SID, type: 'user', message: { role: 'user', content: [{ tool_use_id: id, type: 'tool_result', content: error ? 'denied' : 'ok', ...(error ? { is_error: true } : {}) }] }, timestamp: at(sec) });

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); });
  });
}

async function waitFor<T>(fn: () => Promise<T | null>, ms = 15000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* not up yet */ }
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 150));
  }
}

beforeAll(async () => {
  const proj = path.join(tmp, 'claude', 'projects', '-work-shop');
  fs.mkdirSync(proj, { recursive: true });
  fs.writeFileSync(path.join(proj, `${SID}.jsonl`), [
    asst(1, [{ type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: `${CWD}/src/a.ts`, old_string: 'a', new_string: 'b\nc' } }]),
    result(2, 'e1'),
    asst(3, [{ type: 'tool_use', id: 'e2', name: 'Write', input: { file_path: `${CWD}/src/b.ts`, content: 'x' } }]),
    result(4, 'e2', true),
  ].join('\n') + '\n');
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    stdio: 'ignore',
    env: {
      ...process.env,
      CLORBIT_PORT: String(port),
      CLORBIT_CLAUDE_DIR: path.join(tmp, 'claude'),
      CLORBIT_DATA_DIR: path.join(tmp, 'data'),
      CLORBIT_STATUSLINE_FILE: path.join(tmp, 'statusline.json'),
      CLORBIT_CLAUDE_JSON: path.join(tmp, 'claude.json'),
      CLORBIT_SERVE_WEB: '0',
    },
  });
  await waitFor(async () => {
    const r = await fetch(`${base}/api/live`);
    const j = (await r.json()) as { scan: { done: boolean } };
    return j.scan.done ? j : null;
  });
}, 30000);

afterAll(() => {
  server?.kill('SIGTERM');
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('GET /api/session/:id/agent/:agentId/changes', () => {
  it('returns AgentChanges for the main agent', async () => {
    const r = await fetch(`${base}/api/session/${SID}/agent/main/changes`);
    expect(r.status).toBe(200);
    const c = (await r.json()) as AgentChanges;
    expect(Object.keys(c).sort()).toEqual(['agentId', 'cwd', 'files', 'filesTotal', 'generatedAt', 'reads', 'readsTotal', 'sessionId', 'steps', 'stepsTotal', 'totals']);
    expect(c).toMatchObject({ sessionId: SID, agentId: 'main', cwd: CWD, filesTotal: 2, totals: { files: 1, added: 2, removed: 1, edits: 1, failed: 1 } });
    expect(c.files[0]).toMatchObject({ path: 'src/a.ts', name: 'a.ts', added: 2, removed: 1, edits: 1, failed: 0, write: null });
    expect(c.files[0].hunks[0]).toMatchObject({ tool: 'Edit', lines: ['-a', '+b', '+c'], more: 0 });
    expect(c.files[1]).toMatchObject({ path: 'src/b.ts', edits: 0, failed: 1 });
    expect(c.steps.map((s) => s.status)).toEqual(['ok', 'error']);
  });

  it('answers the session-wide view, 404 for unknown agents and 400 for bad ids', async () => {
    const all = (await (await fetch(`${base}/api/session/${SID}/agent/all/changes`)).json()) as AgentChanges;
    expect(all.files[0].agents).toEqual(['main']);
    expect((await fetch(`${base}/api/session/${SID}/agent/nope/changes`)).status).toBe(404);
    expect((await fetch(`${base}/api/session/bad/agent/main/changes`)).status).toBe(400);
    expect((await fetch(`${base}/api/session/${SID}/agent/a.b/changes`)).status).toBe(400);
  });
});
