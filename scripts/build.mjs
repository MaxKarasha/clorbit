#!/usr/bin/env node
// Production build. Everything the Claude Code plugin runs must live inside plugin/, because only
// that folder is copied into the plugin cache. Output (committed, so the plugin works without a build step):
//   plugin/app/web/       the web app (Vite)
//   plugin/app/server.mjs the server as one ESM file (esbuild); Node built-ins only
// The version comes from package.json and is synced into plugin/.claude-plugin/plugin.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'plugin', 'app');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// 1. Version: package.json is the single source of truth.
const manifestFile = path.join(root, 'plugin', '.claude-plugin', 'plugin.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
if (manifest.version !== pkg.version) {
  manifest.version = pkg.version;
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[build] plugin.json version → ${pkg.version}`);
}

// 2. Web app → plugin/app/web (outDir and emptyOutDir come from vite.config.ts).
await viteBuild({ configFile: path.join(root, 'vite.config.ts'), logLevel: 'warn' });
console.log('[build] web → plugin/app/web');

// 3. Server → plugin/app/server.mjs.
await esbuild({
  absWorkingDir: root,
  entryPoints: ['server/bundle.ts'],
  outfile: path.join(appDir, 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['node:*'],
  define: { __CLORBIT_BUNDLED__: 'true', __CLORBIT_VERSION__: JSON.stringify(pkg.version) },
  banner: { js: `// Clorbit ${pkg.version} server, bundled from server/ by scripts/build.mjs. Do not edit.` },
  legalComments: 'none',
  logLevel: 'warning',
});
const size = fs.statSync(path.join(appDir, 'server.mjs')).size;
console.log(`[build] server → plugin/app/server.mjs (${(size / 1024).toFixed(0)} KB)`);
