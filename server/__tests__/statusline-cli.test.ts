// `clorbit statusline`: dry run, apply, idempotence, remove and create — always on temp settings files
// (CLORBIT_CLAUDE_DIR and HOME point into a temp dir, never at the real ~/.claude).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const CLI = path.join(root, 'plugin', 'app', 'cli.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-statusline-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

let n = 0;
/** A fresh fake Claude dir (with settings.json when given) and a fake home. */
function fixture(settings?: unknown) {
  const dir = path.join(tmp, `case-${++n}`);
  const claude = path.join(dir, 'claude');
  const home = path.join(dir, 'home');
  fs.mkdirSync(claude, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  const file = path.join(claude, 'settings.json');
  if (settings !== undefined) fs.writeFileSync(file, typeof settings === 'string' ? settings : JSON.stringify(settings, null, 2));
  const env = { ...process.env, CLORBIT_CLAUDE_DIR: claude, FLEET_CLAUDE_DIR: '', HOME: home, USERPROFILE: home };
  const run = (...args: string[]) => execFileSync(process.execPath, [CLI, 'statusline', ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const backups = () => fs.readdirSync(claude).filter((f) => f.includes('.clorbit-backup-'));
  /** Runs a status-line command the way Claude Code does: JSON on stdin. */
  const exec = (command: string, input: string) => execFileSync('/bin/sh', ['-c', command], { input, encoding: 'utf8', env });
  return { claude, home, file, run, read, backups, exec };
}

const original = 'bash ~/.claude/statusline.sh';
const snapshot = JSON.stringify({ model: { display_name: 'Opus 4.7' }, rate_limits: { five_hour: { used_percentage: 42.4 }, seven_day: { used_percentage: 18 } } });

describe('clorbit statusline', () => {
  it('dry run prints the change and writes nothing', () => {
    const f = fixture({ model: 'opus', statusLine: { type: 'command', command: original, padding: 0 } });
    const before = fs.readFileSync(f.file, 'utf8');
    const out = f.run();
    expect(out).toContain('dry run');
    expect(out).toContain(`Before:\n  ${original}`);
    expect(out).toContain(`> ~/.clorbit/statusline.json; printf '%s' "$input" | { ${original}; }`);
    expect(out).toContain('clorbit statusline --apply');
    expect(fs.readFileSync(f.file, 'utf8')).toBe(before);
    expect(f.backups()).toEqual([]);
  });

  it('--apply backs up and rewrites only statusLine.command; a second run is a no-op', () => {
    const f = fixture({ model: 'opus', env: { A: '1' }, statusLine: { type: 'command', command: original, padding: 2 } });
    const out = f.run('--apply');
    expect(out).toContain('Done. Backup:');
    const s = f.read();
    expect(s.model).toBe('opus');
    expect(s.env).toEqual({ A: '1' });
    expect(s.statusLine.padding).toBe(2);
    expect(s.statusLine.command.startsWith(`input=$(cat); mkdir -p ~/.clorbit; printf '%s' "$input" > ~/.clorbit/statusline.json;`)).toBe(true);
    expect(f.backups()).toHaveLength(1);
    const after = fs.readFileSync(f.file, 'utf8');
    expect(f.run('--apply')).toContain('Nothing to do');
    expect(fs.readFileSync(f.file, 'utf8')).toBe(after);
    expect(f.backups()).toHaveLength(1);
  });

  it('the wrapped command saves its input and passes it on unchanged', () => {
    const f = fixture({ statusLine: { type: 'command', command: 'cat | wc -c' } });
    f.run('--apply');
    const out = f.exec(f.read().statusLine.command, snapshot);
    expect(Number(out.trim())).toBe(snapshot.length);
    expect(fs.readFileSync(path.join(f.home, '.clorbit', 'statusline.json'), 'utf8')).toBe(snapshot);
  });

  it('keeps commands that end in ";" or "&" or carry a comment valid shell, and restores them', () => {
    for (const cmd of ['echo a;', 'echo b # note', 'printf "%s" x']) {
      const f = fixture({ statusLine: { type: 'command', command: cmd } });
      f.run('--apply');
      const wrapped = f.read().statusLine.command;
      expect(() => f.exec(wrapped, '{}')).not.toThrow();
      f.run('--apply', '--remove');
      expect(f.read().statusLine.command.replace(/;$/, '')).toBe(cmd.replace(/;$/, ''));
    }
  });

  it('--remove restores the original command (dry run first), and is a no-op when not captured', () => {
    const f = fixture({ statusLine: { type: 'command', command: original } });
    f.run('--apply');
    const dry = f.run('--remove');
    expect(dry).toContain(`After:\n  ${original}`);
    expect(f.read().statusLine.command).not.toBe(original);
    expect(f.run('--remove', '--apply')).toContain('Done.');
    expect(f.read().statusLine).toEqual({ type: 'command', command: original });
    expect(f.backups()).toHaveLength(2);
    expect(f.run('--remove', '--apply')).toContain('Nothing to remove');
    expect(f.backups()).toHaveLength(2);
  });

  it('moves a pre-rename ~/.fleet capture to ~/.clorbit, and --remove handles both', () => {
    const legacy = `input=$(cat); mkdir -p ~/.fleet; printf '%s' "$input" > ~/.fleet/statusline.json; printf '%s' "$input" | { ${original}; }`;
    const f = fixture({ statusLine: { type: 'command', command: legacy } });
    f.run('--apply');
    expect(f.read().statusLine.command).not.toContain('.fleet');
    expect(f.read().statusLine.command).toContain('~/.clorbit/statusline.json');
    const g = fixture({ statusLine: { type: 'command', command: legacy } });
    g.run('--apply', '--remove');
    expect(g.read().statusLine.command).toBe(original);
  });

  it('leaves a hand-made capture alone on --remove', () => {
    const custom = `tee ~/.clorbit/statusline.json | ${original}`;
    const f = fixture({ statusLine: { type: 'command', command: custom } });
    expect(f.run('--remove', '--apply')).toContain('left alone');
    expect(f.read().statusLine.command).toBe(custom);
  });

  it('without a status line it offers a minimal one, and --apply --create makes it', () => {
    const f = fixture({ model: 'opus' });
    const offer = f.run('--apply');
    expect(offer).toContain('no status line');
    expect(offer).toContain('clorbit statusline --apply --create');
    expect(f.read()).toEqual({ model: 'opus' });
    expect(f.backups()).toEqual([]);
    f.run('--apply', '--create');
    const s = f.read();
    expect(s.model).toBe('opus');
    expect(s.statusLine.type).toBe('command');
    expect(f.exec(s.statusLine.command, snapshot)).toBe('Opus 4.7 · 5h 42% · 7d 18%');
    expect(fs.existsSync(path.join(f.home, '.clorbit', 'statusline.json'))).toBe(true);
    expect(f.run('--apply', '--create')).toContain('Nothing to do');
  });

  it('creates settings.json when it does not exist (only with --create)', () => {
    const f = fixture();
    f.run('--apply');
    expect(fs.existsSync(f.file)).toBe(false);
    f.run('--apply', '--create');
    expect(f.read().statusLine.type).toBe('command');
  });

  it('refuses to touch settings.json that is not valid JSON', () => {
    const f = fixture('{ "statusLine": { // a comment\n } }');
    expect(() => f.run('--apply')).toThrow();
    expect(fs.readFileSync(f.file, 'utf8')).toContain('// a comment');
    // From /clorbit (--slash) the message goes to stdout and the exit code is 0.
    expect(f.run('--apply', '--slash')).toContain('not valid JSON');
  });

  it('from /clorbit, the next step is shown as a slash command', () => {
    const f = fixture({ statusLine: { type: 'command', command: original } });
    expect(f.run('--slash')).toContain('To apply: /clorbit statusline --apply');
  });
});
