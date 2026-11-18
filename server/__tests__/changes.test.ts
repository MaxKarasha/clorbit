// "What did this agent change?": parsing of Edit / MultiEdit / Write / NotebookEdit calls from synthetic
// transcripts, error results excluded, relative paths, line counts, caps, incremental parsing and the session view.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { agentChanges, CHANGE_LIMITS, changeOf, clearChangesCache, diffOps, lineDiff, relPath } from '../changes';
import { scanFile } from '../scanner';
import type { FileSummary } from '../types';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-changes-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const projects = path.join(tmp, 'projects');
const SID = 'cccccccc-1111-2222-3333-444444444444';
const CWD = '/work/shop';
const dir = path.join(projects, '-work-shop');
const subDir = path.join(dir, SID, 'subagents');
const mainFile = path.join(dir, `${SID}.jsonl`);

const T0 = Date.UTC(2026, 10, 18, 9, 0);
const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();
let req = 0;
function asst(sec: number, blocks: any[], extra: Record<string, unknown> = {}) {
  const r = `req_${++req}`;
  return JSON.stringify({ parentUuid: null, isSidechain: false, cwd: CWD, sessionId: SID, message: { id: 'm' + r, model: 'claude-opus-5-5', role: 'assistant', content: blocks, stop_reason: 'tool_use', usage: { input_tokens: 5, output_tokens: 5 } }, requestId: r, type: 'assistant', timestamp: at(sec), ...extra });
}
function result(sec: number, id: string, opts: { error?: boolean; big?: boolean; tur?: unknown } = {}) {
  const content = opts.big ? 'x'.repeat(CHANGE_LIMITS.parseResultBelow + 100) : opts.error ? 'String to replace not found in file.' : 'ok';
  const block: Record<string, unknown> = { tool_use_id: id, type: 'tool_result', content };
  if (opts.error) block.is_error = true;
  const rec: Record<string, unknown> = { parentUuid: null, isSidechain: false, cwd: CWD, sessionId: SID, type: 'user', message: { role: 'user', content: [block] }, uuid: 'u' + id, timestamp: at(sec) };
  if (opts.tur !== undefined) rec.toolUseResult = opts.tur;
  return JSON.stringify(rec);
}
const tu = (id: string, name: string, input: Record<string, unknown>) => ({ type: 'tool_use', id, name, input });
const text = (s: string) => ({ type: 'text', text: s });

function write(file: string, lines: string[]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

async function scanAll(): Promise<FileSummary[]> {
  const all = [mainFile, ...fs.readdirSync(subDir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(subDir, f))];
  const out: FileSummary[] = [];
  for (const f of all) out.push((await scanFile(projects, f, null, { knownPlugins: [] }))!.summary);
  return out;
}

beforeAll(() => {
  write(mainFile, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'Add a coupon field' }, timestamp: at(0), cwd: CWD, sessionId: SID }),
    asst(1, [text('Reading the cart first.'), tu('r1', 'Read', { file_path: `${CWD}/src/cart.ts` })]),
    result(2, 'r1'),
    // An Edit: one changed line inside three lines of context.
    asst(3, [tu('e1', 'Edit', { file_path: `${CWD}/src/cart.ts`, old_string: 'a\nb\nc', new_string: 'a\nB\nc' })]),
    result(4, 'e1'),
    // A failed Edit (old_string not found): not counted.
    asst(5, [tu('e2', 'Edit', { file_path: `${CWD}/src/cart.ts`, old_string: 'zzz', new_string: 'yyy\nyyy' })]),
    result(6, 'e2', { error: true }),
    // A Write that creates a file (3 lines) — the result is big, so it is byte-scanned.
    asst(7, [tu('w1', 'Write', { file_path: `${CWD}/src/coupon.ts`, content: 'export const x = 1;\nexport const y = 2;\nexport const z = 3;\n' })]),
    result(8, 'w1', { big: true, tur: { type: 'create', filePath: `${CWD}/src/coupon.ts`, content: '…' } }),
    // A MultiEdit with two edits: +2 −1 and +1 −0 (pure insert).
    asst(9, [tu('m1', 'MultiEdit', { file_path: `${CWD}/src/api.ts`, edits: [{ old_string: 'one', new_string: 'uno\ndos' }, { old_string: 'end', new_string: 'end\nmore' }] })]),
    result(10, 'm1'),
    // A NotebookEdit outside the project folder.
    asst(11, [tu('n1', 'NotebookEdit', { notebook_path: '/opt/data/notebooks/eda/analysis.ipynb', new_source: 'import pandas\ndf.head()', edit_mode: 'insert' })]),
    result(12, 'n1'),
    // A Bash call that failed, a Write whose permission was denied (error result, big line).
    asst(13, [tu('b1', 'Bash', { command: 'pnpm test --run' })]),
    result(14, 'b1', { error: true }),
    asst(15, [tu('w2', 'Write', { file_path: `${CWD}/.env`, content: 'SECRET=1' })]),
    result(16, 'w2', { error: true, big: true }),
    // An old-style sidechain record in the main file is ignored.
    asst(17, [tu('s1', 'Edit', { file_path: `${CWD}/src/side.ts`, old_string: 'a', new_string: 'b' })], { isSidechain: true }),
    // A call still waiting for its result.
    asst(18, [tu('p1', 'Edit', { file_path: `${CWD}/src/pending.ts`, old_string: 'a', new_string: 'b' })]),
  ]);
  write(path.join(subDir, 'agent-sub1.jsonl'), [
    JSON.stringify({ type: 'user', isSidechain: true, agentId: 'sub1', message: { role: 'user', content: 'Write tests' }, timestamp: at(20), cwd: CWD, sessionId: SID }),
    asst(21, [tu('x1', 'Write', { file_path: `${CWD}/src/cart.test.ts`, content: 'test 1\ntest 2' })], { isSidechain: true, agentId: 'sub1' }),
    result(22, 'x1', { tur: { type: 'update', filePath: `${CWD}/src/cart.test.ts` } }),
    asst(23, [tu('x2', 'Edit', { file_path: `${CWD}/src/cart.ts`, old_string: 'c', new_string: 'C' })], { isSidechain: true, agentId: 'sub1' }),
    result(24, 'x2'),
    asst(25, [tu('x3', 'WebFetch', { url: 'https://docs.example.com/a/b' }), tu('x4', 'Grep', { pattern: 'coupon' })], { isSidechain: true, agentId: 'sub1' }),
  ]);
  fs.writeFileSync(path.join(subDir, 'agent-sub1.meta.json'), JSON.stringify({ agentType: 'test-runner', description: 'Write tests', toolUseId: 'ag1' }));
});
beforeEach(() => clearChangesCache());

describe('line diff', () => {
  it('counts only changed lines (common prefix, suffix and LCS)', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc')).toMatchObject({ added: 1, removed: 1, lines: [' a', '-b', '+B', ' c'], more: 0 });
    expect(lineDiff('x\ny\nz', 'x\nq\ny\nz\nw')).toMatchObject({ added: 2, removed: 0 });
    expect(lineDiff('', 'new\nlines\n')).toMatchObject({ added: 2, removed: 0 });
    expect(lineDiff('gone', '')).toMatchObject({ added: 0, removed: 1 });
    expect(diffOps(['1', '2', '3', '4'], ['1', '3', '4', '5'])).toEqual([' 1', '-2', ' 3', ' 4', '+5']);
  });
  it('caps previews: context, line count and line length', () => {
    const ctx = Array.from({ length: 10 }, (_, i) => `ctx${i}`).join('\n');
    const d = lineDiff(`${ctx}\nold\n${ctx}`, `${ctx}\nnew\n${ctx}`);
    expect(d.lines).toEqual([' ctx8', ' ctx9', '-old', '+new', ' ctx0', ' ctx1']);
    const big = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n');
    const w = changeOf('Write', { file_path: '/a/b.ts', content: big }, 1)!;
    expect(w.added).toBe(500);
    expect(w.hunks[0].lines).toHaveLength(CHANGE_LIMITS.linesPerHunk);
    expect(w.hunks[0].more).toBe(500 - CHANGE_LIMITS.linesPerHunk);
    const long = lineDiff('a', 'b'.repeat(5000));
    expect(long.lines[1].length).toBe(CHANGE_LIMITS.lineChars);
  });
  it('falls back to counting every line for huge edits', () => {
    const a = Array.from({ length: 1000 }, (_, i) => `a${i}`).join('\n');
    const b = Array.from({ length: 1000 }, (_, i) => `b${i}`).join('\n');
    expect(lineDiff(a, b)).toMatchObject({ added: 1000, removed: 1000 });
  });
  it('ignores other tools and calls without a path', () => {
    expect(changeOf('Read', { file_path: '/a' }, 1)).toBeNull();
    expect(changeOf('Edit', { old_string: 'a' }, 1)).toBeNull();
    expect(changeOf('Edit', { file_path: '/a', old_string: 'a', new_string: 'b', replace_all: true }, 1)!.hunks[0].replaceAll).toBe(true);
  });
});

describe('relative paths', () => {
  it('is relative to the session folder, then ~, then shortened', () => {
    expect(relPath('/work/shop/src/a.ts', '/work/shop')).toBe('src/a.ts');
    expect(relPath('/work/shop/src/a.ts', '/work/shop/')).toBe('src/a.ts');
    expect(relPath('/work/shopping/a.ts', '/work/shop')).toBe('/work/shopping/a.ts');
    expect(relPath('/home/u/notes/x.md', '/work/shop', '/home/u')).toBe('~/notes/x.md');
    expect(relPath('/home/u/a/b/c/d/x.md', null, '/home/u')).toBe('~/…/c/d/x.md');
    expect(relPath('/opt/data/notebooks/eda/analysis.ipynb', '/work/shop', '/home/u')).toBe('…/notebooks/eda/analysis.ipynb');
    expect(relPath('src/rel.ts', '/work/shop')).toBe('src/rel.ts');
  });
});

describe('agent changes', () => {
  it('main agent: files, totals, failed calls excluded, steps with results', async () => {
    const files = await scanAll();
    const c = (await agentChanges(files, SID, 'main', { home: '/home/u', now: 1 }))!;
    expect(c.cwd).toBe(CWD);
    const by = Object.fromEntries(c.files.map((f) => [f.path, f]));
    expect(Object.keys(by).sort()).toEqual(['.env', 'src/api.ts', 'src/cart.ts', 'src/coupon.ts', '…/notebooks/eda/analysis.ipynb']);
    expect(by['src/cart.ts']).toMatchObject({ added: 1, removed: 1, edits: 1, failed: 1, reads: 1, write: null, name: 'cart.ts' });
    expect(by['src/cart.ts'].hunks).toHaveLength(1);
    expect(by['src/coupon.ts']).toMatchObject({ added: 3, removed: 0, edits: 1, failed: 0, write: 'created' });
    expect(by['src/api.ts']).toMatchObject({ added: 3, removed: 1, edits: 1 });
    expect(by['src/api.ts'].hunks).toHaveLength(2);
    expect(by['…/notebooks/eda/analysis.ipynb']).toMatchObject({ added: 2, edits: 1 });
    expect(by['…/notebooks/eda/analysis.ipynb'].hunks[0]).toMatchObject({ tool: 'NotebookEdit', mode: 'insert' });
    // Every attempt failed: listed after the successful ones, not in the totals.
    expect(by['.env']).toMatchObject({ edits: 0, failed: 1, added: 0 });
    expect(c.files[c.files.length - 1].path).toBe('.env');
    // Sidechain and pending calls change nothing.
    expect(by['src/side.ts']).toBeUndefined();
    expect(by['src/pending.ts']).toBeUndefined();
    expect(c.totals).toEqual({ files: 4, added: 9, removed: 2, edits: 4, failed: 2 });
    // Newest first.
    expect(c.files.slice(0, 4).map((f) => f.path)).toEqual(['…/notebooks/eda/analysis.ipynb', 'src/api.ts', 'src/coupon.ts', 'src/cart.ts']);
    // Steps: oldest first, results folded in.
    expect(c.steps.map((s) => [s.kind, s.label, s.status])).toEqual([
      ['text', 'Reading the cart first.', undefined],
      ['tool', 'Read cart.ts', 'ok'],
      ['tool', 'Edit cart.ts', 'ok'],
      ['tool', 'Edit cart.ts', 'error'],
      ['tool', 'Write coupon.ts', 'ok'],
      ['tool', 'Edit api.ts', 'ok'],
      ['tool', 'Edit analysis.ipynb', 'ok'],
      ['tool', 'Bash: pnpm test --run', 'error'],
      ['tool', 'Write .env', 'error'],
      ['tool', 'Edit pending.ts', 'pending'],
    ]);
    expect(c.steps[1].endTs).toBe(T0 + 2000);
    expect(c.stepsTotal).toBe(10);
    expect(c.reads).toEqual([]);
  });

  it('subagent: its own transcript, Write update → overwritten, read-only files', async () => {
    const files = await scanAll();
    const c = (await agentChanges(files, SID, 'sub1', { home: '/home/u' }))!;
    expect(c.files.map((f) => [f.path, f.added, f.removed, f.write])).toEqual([['src/cart.ts', 1, 1, null], ['src/cart.test.ts', 2, 0, 'overwritten']]);
    expect(c.steps.map((s) => s.label)).toEqual(['Write cart.test.ts', 'Edit cart.ts', 'WebFetch docs.example.com', 'Grep "coupon"']);
    expect(c.steps.slice(-2).every((s) => s.status === 'pending')).toBe(true);
    expect(await agentChanges(files, SID, 'nope')).toBeNull();
  });

  it('session view merges every agent by file', async () => {
    const files = await scanAll();
    const c = (await agentChanges(files, SID, 'all', { home: '/home/u' }))!;
    const cart = c.files.find((f) => f.path === 'src/cart.ts')!;
    expect(cart).toMatchObject({ added: 2, removed: 2, edits: 2, failed: 1 });
    expect(cart.agents!.sort()).toEqual(['main', 'sub1']);
    expect(c.totals.files).toBe(5);
    expect(c.steps).toEqual([]);
  });

  it('archived transcripts answer with an empty, flagged result', async () => {
    const files = await scanAll();
    const c = (await agentChanges(files, SID, 'main', { isMissing: () => true }))!;
    expect(c).toMatchObject({ archived: true, files: [], steps: [] });
  });

  it('resumes from the last offset when the transcript grows', async () => {
    const f = path.join(projects, '-grow', 'dddddddd-1111-2222-3333-444444444444.jsonl');
    write(f, [asst(1, [tu('g1', 'Edit', { file_path: `${CWD}/a.ts`, old_string: 'a', new_string: 'b' })]), result(2, 'g1')]);
    const scan = async () => [(await scanFile(projects, f, null, { knownPlugins: [] }))!.summary];
    const first = (await agentChanges(await scan(), 'dddddddd-1111-2222-3333-444444444444', 'main'))!;
    expect(first.totals).toMatchObject({ files: 1, added: 1, removed: 1 });
    fs.appendFileSync(f, [asst(3, [tu('g2', 'Edit', { file_path: `${CWD}/a.ts`, old_string: 'x', new_string: 'y\nz' })]), result(4, 'g2')].join('\n') + '\n');
    const second = (await agentChanges(await scan(), 'dddddddd-1111-2222-3333-444444444444', 'main'))!;
    expect(second.totals).toMatchObject({ files: 1, added: 3, removed: 2, edits: 2 });
    expect(second.steps).toHaveLength(2);
    // The first answer is a copy: later parsing does not change it.
    expect(first.steps).toHaveLength(1);
  });

  it('caps steps and diff previews per file', async () => {
    const f = path.join(projects, '-cap', 'eeeeeeee-1111-2222-3333-444444444444.jsonl');
    const lines: string[] = [];
    for (let i = 0; i < 260; i++) {
      lines.push(asst(i * 2, [tu(`c${i}`, 'Edit', { file_path: `${CWD}/hot.ts`, old_string: `v${i}`, new_string: `v${i + 1}` })]), result(i * 2 + 1, `c${i}`));
    }
    write(f, lines);
    const files = [(await scanFile(projects, f, null, { knownPlugins: [] }))!.summary];
    const c = (await agentChanges(files, 'eeeeeeee-1111-2222-3333-444444444444', 'main'))!;
    expect(c.steps).toHaveLength(CHANGE_LIMITS.steps);
    expect(c.stepsTotal).toBe(260);
    expect(c.steps[c.steps.length - 1].ts).toBe(T0 + 518_000);
    const hot = c.files[0];
    expect(hot).toMatchObject({ edits: 260, added: 260, removed: 260 });
    expect(hot.hunks).toHaveLength(CHANGE_LIMITS.hunksPerFile);
    expect(hot.hunksDropped).toBe(260 - CHANGE_LIMITS.hunksPerFile);
    expect(hot.hunks[hot.hunks.length - 1].lines).toEqual(['-v259', '+v260']);
  });
});
