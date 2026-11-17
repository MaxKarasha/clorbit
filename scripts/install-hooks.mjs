#!/usr/bin/env node
// Connects Claude Code's status line (and, optionally, raw hooks) to Clorbit.
//
// Default is a dry run: it only prints what would be added to ~/.claude/settings.json.
// The recommended way to install hooks is the `clorbit` plugin (see README).
// This script writes hooks into settings.json only with the explicit --hooks flag.
//   node scripts/install-hooks.mjs                 show the changes (writes nothing)
//   node scripts/install-hooks.mjs --statusline    show the changes including the status line
//   node scripts/install-hooks.mjs --apply [--statusline] [--hooks]
//                                                  back up settings.json with a timestamp, then write
//
// Hooks are fire-and-forget: curl with a 1 s timeout and errors ignored, so Claude Code is never
// slowed down, even when Clorbit is not running.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const env = (name) => process.env[`CLORBIT_${name}`] || process.env[`FLEET_${name}`] || undefined;

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const STATUSLINE = args.has('--statusline');
const HOOKS = args.has('--hooks');
const PORT = Number(env('PORT')) || 4980;
const SETTINGS = path.join(env('CLAUDE_DIR') || path.join(os.homedir(), '.claude'), 'settings.json');
const MARK = `127.0.0.1:${PORT}/api/hook`;

const HOOK_COMMAND = `curl -s -m 1 -X POST --data-binary @- http://${MARK} >/dev/null 2>&1 || true`;
const EVENTS = [
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification',
  'Stop', 'SubagentStart', 'SubagentStop', 'PreCompact', 'SessionEnd',
];
// Tool events need a matcher; for the others a missing matcher means "all".
const WITH_MATCHER = new Set(['PreToolUse', 'PostToolUse']);

const CAPTURE = '.clorbit/statusline.json';
const LEGACY_CAPTURE = '.fleet/statusline.json';
const STATUS_PREFIX = `input=$(cat); mkdir -p ~/.clorbit; printf '%s' "$input" > ~/${CAPTURE};`;

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    console.error(`Could not read ${SETTINGS}: ${e.message}`);
    process.exit(1);
  }
}

/** The hooks fragment to add (skipping entries of ours that already exist). */
function hooksPatch(settings) {
  const patch = {};
  const existing = settings.hooks ?? {};
  for (const ev of EVENTS) {
    const groups = Array.isArray(existing[ev]) ? existing[ev] : [];
    const already = groups.some((g) => (g.hooks ?? []).some((h) => typeof h.command === 'string' && h.command.includes(MARK)));
    if (already) continue;
    const group = { hooks: [{ type: 'command', command: HOOK_COMMAND, timeout: 2 }] };
    if (WITH_MATCHER.has(ev)) group.matcher = '*';
    patch[ev] = [group];
  }
  return patch;
}

/** New status-line command: saves its input to ~/.clorbit/statusline.json and passes it on unchanged. */
function statuslinePatch(settings) {
  const sl = settings.statusLine;
  if (!sl || sl.type !== 'command' || typeof sl.command !== 'string') {
    return { error: 'settings.json has no statusLine of type "command" — nothing to change.' };
  }
  if (sl.command.includes(CAPTURE)) return { already: true };
  if (sl.command.includes(LEGACY_CAPTURE)) {
    // A pre-rename capture: point it at the new location.
    return { before: sl.command, after: sl.command.replaceAll(LEGACY_CAPTURE, CAPTURE).replaceAll('mkdir -p ~/.fleet', 'mkdir -p ~/.clorbit') };
  }
  return { before: sl.command, after: `${STATUS_PREFIX} printf '%s' "$input" | { ${sl.command}; }` };
}

function merge(settings, hp, sp) {
  const out = structuredClone(settings);
  if (Object.keys(hp).length) {
    out.hooks = out.hooks ?? {};
    for (const [ev, groups] of Object.entries(hp)) out.hooks[ev] = [...(out.hooks[ev] ?? []), ...groups];
  }
  if (sp && sp.after) out.statusLine = { ...out.statusLine, command: sp.after };
  return out;
}

const settings = readSettings();
const hp = HOOKS ? hooksPatch(settings) : {};
const sp = statuslinePatch(settings);

console.log(`File: ${SETTINGS}`);
console.log(APPLY ? 'Mode: WRITE (--apply)' : 'Mode: dry run — nothing is written. Add --apply to apply.');
console.log('');
if (Object.keys(hp).length) {
  console.log('Will add to "hooks":');
  console.log(JSON.stringify({ hooks: hp }, null, 2));
} else if (!HOOKS) {
  console.log('Hooks are not added to settings.json: use the clorbit plugin instead (see README). To force it, pass --hooks.');
} else {
  console.log('Clorbit hooks are already present — nothing to add to "hooks".');
}
console.log('');
if (sp.error) console.log(`Status line: ${sp.error}`);
else if (sp.already) console.log(`The status line already saves its input to ~/${CAPTURE}.`);
else {
  console.log(`Status line${STATUSLINE ? '' : ' (not applied without --statusline)'}:`);
  console.log(JSON.stringify({ statusLine: { command: sp.after } }, null, 2));
}

if (APPLY) {
  const useSl = STATUSLINE && sp.after ? sp : null;
  if (!Object.keys(hp).length && !useSl) {
    console.log('\nNo changes — the file is left untouched.');
    process.exit(0);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${SETTINGS}.clorbit-backup-${stamp}`;
  if (fs.existsSync(SETTINGS)) fs.copyFileSync(SETTINGS, backup);
  const merged = merge(settings, hp, useSl);
  const tmp = `${SETTINGS}.clorbit-tmp`;
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2) + '\n');
  fs.renameSync(tmp, SETTINGS);
  console.log(`\nDone. Backup: ${backup}`);
  console.log('Changes apply to new Claude Code sessions.');
}
