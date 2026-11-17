// Checks that keep the Claude Code plugin consistent with the package (the plugin ships from plugin/ only).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

describe('plugin', () => {
  it('has the package.json version (synced by pnpm build)', () => {
    expect(readJson('plugin/.claude-plugin/plugin.json').version).toBe(readJson('package.json').version);
  });

  it('runs only files that live inside plugin/', () => {
    const hooks = JSON.stringify(readJson('plugin/hooks/hooks.json'));
    for (const m of hooks.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)) {
      expect(fs.existsSync(path.join(root, 'plugin', m[1])), m[1]).toBe(true);
    }
    expect(readJson('package.json').bin.clorbit).toBe('plugin/app/cli.mjs');
  });

  it('CLI prints its version and keeps `ensure` silent', () => {
    const cli = path.join(root, 'plugin', 'app', 'cli.mjs');
    expect(execFileSync(process.execPath, [cli, 'version'], { encoding: 'utf8' }).trim()).toBe(readJson('package.json').version);
    const out = execFileSync(process.execPath, [cli, 'ensure'], { encoding: 'utf8', env: { ...process.env, CLORBIT_AUTOSTART: '0' } });
    expect(out).toBe('');
  });
});
