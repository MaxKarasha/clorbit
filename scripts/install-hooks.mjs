#!/usr/bin/env node
// Connects Claude Code's status line (and, optionally, raw hooks) to Clorbit.
//
// Default is a dry run: it only prints what would be added to ~/.claude/settings.json.
// Plugin users have the same status-line step without a clone: `/clorbit statusline` (see README).
// The recommended way to install hooks is the `clorbit` plugin (see README).
// This script writes hooks into settings.json only with the explicit --hooks flag.
//   node scripts/install-hooks.mjs                 show the changes (writes nothing)
//   node scripts/install-hooks.mjs --statusline    show the changes including the status line
//   node scripts/install-hooks.mjs --apply [--statusline] [--hooks]
//                                                  back up settings.json with a timestamp, then write
//
// Hooks are fire-and-forget: curl with a 1 s timeout and errors ignored, so Claude Code is never
// slowed down, even when Clorbit is not running.
import { CAPTURE, applyStatusLine, planStatusLine, readSettingsFile, settingsFile, writeSettingsFile } from '../plugin/app/statusline.mjs';

const env = (name) => process.env[`CLORBIT_${name}`] || process.env[`FLEET_${name}`] || undefined;

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const STATUSLINE = args.has('--statusline');
const HOOKS = args.has('--hooks');
const PORT = Number(env('PORT')) || 4980;
const SETTINGS = settingsFile();
const MARK = `127.0.0.1:${PORT}/api/hook`;

const HOOK_COMMAND = `curl -s -m 1 -X POST --data-binary @- http://${MARK} >/dev/null 2>&1 || true`;
const EVENTS = [
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification',
  'Stop', 'SubagentStart', 'SubagentStop', 'PreCompact', 'SessionEnd',
];
// Tool events need a matcher; for the others a missing matcher means "all".
const WITH_MATCHER = new Set(['PreToolUse', 'PostToolUse']);

function readSettings() {
  try {
    return readSettingsFile(SETTINGS);
  } catch (e) {
    console.error(e.message);
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

/** The status-line change (shared with `clorbit statusline`, see plugin/app/statusline.mjs). */
function statuslinePatch(settings) {
  const plan = planStatusLine(settings);
  if (plan.action === 'already') return { already: true };
  if (plan.action === 'none') {
    return { error: 'settings.json has no statusLine of type "command" — nothing to change. `clorbit statusline --apply --create` (or /clorbit statusline --apply --create) can create a minimal one.' };
  }
  return { plan, before: plan.before, after: plan.after };
}

function merge(settings, hp, sp) {
  const out = structuredClone(settings);
  if (Object.keys(hp).length) {
    out.hooks = out.hooks ?? {};
    for (const [ev, groups] of Object.entries(hp)) out.hooks[ev] = [...(out.hooks[ev] ?? []), ...groups];
  }
  return sp && sp.plan ? applyStatusLine(out, sp.plan) : out;
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
  const backup = writeSettingsFile(SETTINGS, merge(settings, hp, useSl));
  console.log(`\nDone.${backup ? ` Backup: ${backup}` : ''}`);
  console.log('Changes apply to new Claude Code sessions.');
}
