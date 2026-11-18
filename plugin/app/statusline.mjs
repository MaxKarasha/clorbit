// Status-line capture: the one change to Claude Code's settings.json that lets Clorbit see subscription limits.
// Shared by the CLI (`clorbit statusline`, plugin/app/cli.mjs) and scripts/install-hooks.mjs.
// Plain JavaScript with Node built-ins only: it ships as is inside the plugin (no build step).
//
// The capture prefixes the existing status-line command: it saves the JSON Claude Code pipes in to
// ~/.clorbit/statusline.json and passes the same input on to the original command unchanged.
// Only `statusLine.command` is ever touched; every write keeps a timestamped backup next to the file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CAPTURE = '.clorbit/statusline.json';
export const LEGACY_CAPTURE = '.fleet/statusline.json';
export const STATUS_PREFIX = `input=$(cat); mkdir -p ~/.clorbit; printf '%s' "$input" > ~/${CAPTURE};`;
const PIPE = ` printf '%s' "$input" | { `;

// Our prefix (also the pre-rename ~/.fleet one) around the original command, which is group 1.
const WRAPPED = /^input=\$\(cat\); mkdir -p ~\/\.(?:clorbit|fleet); printf '%s' "\$input" > ~\/\.(?:clorbit|fleet)\/statusline\.json; printf '%s' "\$input" \| \{ ([\s\S]*?)(?:;? |\n)\}\s*$/;

/** A minimal status line for people without one: the model and both limits, e.g. "Opus 4.7 · 5h 42% · 7d 18%". */
export const MINIMAL_COMMAND =
  `node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{let j={};try{j=JSON.parse(s)}catch{}` +
  `const r=j.rate_limits||{};const p=(w)=>w&&typeof w.used_percentage==="number"?Math.round(w.used_percentage)+"%":"—";` +
  `process.stdout.write(((j.model&&j.model.display_name)||"Claude")+" · 5h "+p(r.five_hour)+" · 7d "+p(r.seven_day))})'`;

const env = (name) => process.env[`CLORBIT_${name}`] || process.env[`FLEET_${name}`] || undefined;

/** Claude Code's user settings file (CLORBIT_CLAUDE_DIR overrides ~/.claude, like the server). */
export function settingsFile() {
  return path.join(env('CLAUDE_DIR') || path.join(os.homedir(), '.claude'), 'settings.json');
}

/** Does this command already save its input for Clorbit? */
export function isCaptured(command) {
  return typeof command === 'string' && (command.includes(CAPTURE) || command.includes(LEGACY_CAPTURE));
}

/** The command with the capture in front. A trailing `;`/`&`, a comment or several lines keep the group valid shell. */
export function wrap(command) {
  if (/[\n#]/.test(command)) return `${STATUS_PREFIX}${PIPE}${command}\n}`;
  if (/[;&]\s*$/.test(command)) return `${STATUS_PREFIX}${PIPE}${command.trimEnd()} }`;
  return `${STATUS_PREFIX}${PIPE}${command}; }`;
}

/** The original command inside our capture, or null when the command is not wrapped by Clorbit. */
export function unwrap(command) {
  const m = typeof command === 'string' ? WRAPPED.exec(command) : null;
  return m ? m[1] : null;
}

/**
 * What `statusline` would do with these settings.
 *   mode 'add' (default) | 'remove'; create: offer/create a minimal status line when there is none.
 * Returns { action, before?, after?, note? }:
 *   wrap      add the capture in front of the existing command
 *   migrate   point a pre-rename ~/.fleet capture at ~/.clorbit
 *   create    no command status line: a new minimal one (only with create)
 *   already   already captured, nothing to do
 *   restore   remove the capture, restoring the original command
 *   none      nothing to do (with a note why)
 */
export function planStatusLine(settings, { mode = 'add', create = false } = {}) {
  const sl = settings && typeof settings === 'object' ? settings.statusLine : undefined;
  const hasCommand = !!sl && typeof sl === 'object' && sl.type === 'command' && typeof sl.command === 'string' && sl.command.trim() !== '';
  if (mode === 'remove') {
    if (!hasCommand || !isCaptured(sl.command)) return { action: 'none', note: 'not-captured' };
    const original = unwrap(sl.command);
    if (original === null) return { action: 'none', note: 'custom-capture', before: sl.command };
    return { action: 'restore', before: sl.command, after: original };
  }
  if (!hasCommand) {
    const after = wrap(MINIMAL_COMMAND);
    if (!create) return { action: 'none', note: sl ? 'not-command' : 'no-statusline', after };
    return { action: 'create', before: sl ? JSON.stringify(sl) : null, after };
  }
  if (sl.command.includes(CAPTURE)) return { action: 'already', before: sl.command };
  if (sl.command.includes(LEGACY_CAPTURE)) {
    return { action: 'migrate', before: sl.command, after: sl.command.replaceAll(LEGACY_CAPTURE, CAPTURE).replaceAll('mkdir -p ~/.fleet', 'mkdir -p ~/.clorbit') };
  }
  return { action: 'wrap', before: sl.command, after: wrap(sl.command) };
}

/** The settings with the plan applied (a copy; only statusLine changes). */
export function applyStatusLine(settings, plan) {
  const out = structuredClone(settings ?? {});
  if (plan.action === 'create') out.statusLine = { type: 'command', command: plan.after, padding: 0 };
  else if (['wrap', 'migrate', 'restore'].includes(plan.action)) out.statusLine = { ...out.statusLine, command: plan.after };
  return out;
}

/** settings.json as an object ({} when missing). Throws with a readable message when it is not valid JSON. */
export function readSettingsFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw new Error(`Could not read ${file}: ${e.message}`);
  }
  try {
    const j = JSON.parse(text);
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('not a JSON object');
    return j;
  } catch (e) {
    throw new Error(`${file} is not valid JSON (${e.message}); fix it by hand first — nothing was changed.`);
  }
}

/** Writes the settings atomically after a timestamped backup next to the file. Returns the backup path (null for a new file). */
export function writeSettingsFile(file, settings) {
  let backup = null;
  let mode;
  if (fs.existsSync(file)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backup = `${file}.clorbit-backup-${stamp}`;
    fs.copyFileSync(file, backup);
    mode = fs.statSync(file).mode & 0o777;
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const tmp = `${file}.clorbit-tmp`;
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', mode ? { mode } : undefined);
  fs.renameSync(tmp, file);
  return backup;
}
