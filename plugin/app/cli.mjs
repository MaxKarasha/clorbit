#!/usr/bin/env node
// Clorbit CLI: starts, stops and opens the local Clorbit server (plugin/app/server.mjs next to this file).
// Plain JavaScript with Node built-ins only, so it runs straight from the Claude Code plugin cache or npm.
//
//   clorbit [open]   start the server if needed, then open the dashboard in the browser
//   clorbit start    start the server in the background (pid file and log in the data dir)
//   clorbit stop     stop a server that this CLI started
//   clorbit status   is it running? URL, version, data dir, hooks
//   clorbit ensure   silent start-if-not-running for the plugin's SessionStart hook; never prints, always exits 0
//
// Environment: CLORBIT_PORT (default 4980), CLORBIT_DATA_DIR (default ~/.clorbit), CLORBIT_AUTOSTART=0
// turns `ensure` into a no-op. The legacy FLEET_* names are read as fallbacks, like the server does.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_NODE = [22, 5];
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--') && a.length > 2));
const cmd = (argv.find((a) => !(a.startsWith('--') && a.length > 2)) || 'open').toLowerCase();
const quiet = cmd === 'ensure';
// --slash: run from the /clorbit command, whose `!` block aborts on a non-zero exit and may drop stderr.
// Everything goes to stdout and the exit code is always 0, so Claude can relay the message.
const slash = flags.has('--slash');
if (slash) console.error = console.log;

const nodeVer = process.versions.node.split('.').map(Number);
if (nodeVer[0] < MIN_NODE[0] || (nodeVer[0] === MIN_NODE[0] && nodeVer[1] < MIN_NODE[1])) {
  if (!quiet) {
    console.error(`Clorbit needs Node.js ${MIN_NODE.join('.')} or newer (for the built-in node:sqlite); this is Node.js ${process.versions.node}.`);
    console.error('Install a current LTS from https://nodejs.org (or with nvm / fnm / brew) and try again.');
  }
  process.exit(quiet || slash ? 0 : 1);
}

const env = (name) => process.env[`CLORBIT_${name}`] || process.env[`FLEET_${name}`] || undefined;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'server.mjs');
const HOST = '127.0.0.1';
const PORT = Number(env('PORT')) || 4980;
const URL_ = `http://${HOST}:${PORT}/`;
const DATA_DIR = env('DATA_DIR') || path.join(os.homedir(), '.clorbit');
const PID_FILE = path.join(DATA_DIR, 'clorbit.pid');
const LOG_FILE = path.join(DATA_DIR, 'clorbit.log');
const LOCK_FILE = path.join(DATA_DIR, 'start.lock');
const VERSION = readVersion();

function readVersion() {
  // Synced from package.json by scripts/build.mjs; present both in the plugin cache and in the npm package.
  for (const f of [path.join(HERE, '..', '.claude-plugin', 'plugin.json'), path.join(HERE, '..', '..', 'package.json')]) {
    try { const v = JSON.parse(fs.readFileSync(f, 'utf8')).version; if (v) return v; } catch { /* try the next one */ }
  }
  return 'unknown';
}

const tilde = (p) => (p.startsWith(os.homedir()) ? '~' + p.slice(os.homedir().length) : p);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (...a) => { if (!quiet) console.log(...a); };

/** GET a JSON endpoint. Resolves { status, json } or { error: 'refused' | 'timeout' | ... }. */
function getJson(p, timeoutMs = 1500, port = PORT) {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port, path: p, timeout: timeoutMs, headers: { accept: 'application/json' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { if (body.length < 1_000_000) body += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.on('error', (e) => resolve({ error: e.code === 'ECONNREFUSED' ? 'refused' : e.code || String(e) }));
  });
}

/** What is listening on the port: { kind: 'free' } | { kind: 'clorbit', info } | { kind: 'other' }. */
async function probe(port = PORT) {
  const h = await getJson('/api/health', 1500, port);
  if (h.error === 'refused') return { kind: 'free' };
  if (h.status === 200 && h.json?.app === 'clorbit') return { kind: 'clorbit', info: h.json };
  // A Clorbit from before /api/health existed still answers /api/live with its snapshot.
  if (h.status === 404 && h.json?.error) {
    const l = await getJson('/api/live', 3000, port);
    if (l.status === 200 && l.json && 'hooksInstalled' in l.json) return { kind: 'clorbit', info: { app: 'clorbit', version: 'unknown', pid: null, port } };
  }
  return { kind: 'other' };
}

function readPidFile() {
  try { const j = JSON.parse(fs.readFileSync(PID_FILE, 'utf8')); return Number.isInteger(j.pid) ? j : null; } catch { return null; }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** Semver-ish "a < b" for plain x.y.z versions; anything unparsable compares as equal. */
function older(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  if (pa.length !== 3 || pb.length !== 3 || [...pa, ...pb].some(Number.isNaN)) return false;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i];
  return false;
}

/** Takes the start lock (so parallel sessions do not race to spawn). The server removes it once it listens; a lock older than 20 s is stale. */
function takeLock() {
  try { fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' }); return true; } catch { /* exists */ }
  try {
    if (Date.now() - fs.statSync(LOCK_FILE).mtimeMs > 20_000) { fs.rmSync(LOCK_FILE, { force: true }); return takeLock(); }
  } catch { /* raced with another remover */ }
  return false;
}
const dropLock = () => { try { fs.rmSync(LOCK_FILE, { force: true }); } catch { /* ignore */ } };

/** Spawns the server fully detached (it must outlive the hook or the shell that started it). */
function spawnServer() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try { if (fs.statSync(LOG_FILE).size > 5_000_000) fs.renameSync(LOG_FILE, LOG_FILE + '.1'); } catch { /* no log yet */ }
  const log = fs.openSync(LOG_FILE, 'a');
  fs.writeSync(log, `\n[clorbit-cli] ${new Date().toISOString()} starting ${VERSION} on port ${PORT}\n`);
  const args = [];
  // node:sqlite is unflagged from Node 22.13; older 22.x needs the flag.
  if (nodeVer[0] === 22 && nodeVer[1] < 13) args.push('--experimental-sqlite');
  args.push(SERVER);
  const child = spawn(process.execPath, args, {
    cwd: DATA_DIR,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, CLORBIT_PORT: String(PORT), CLORBIT_DATA_DIR: DATA_DIR, CLORBIT_PID_FILE: PID_FILE, CLORBIT_START_LOCK: LOCK_FILE, CLORBIT_SERVE_WEB: '1' },
  });
  fs.closeSync(log);
  child.unref();
  return child;
}

function logTail(lines = 15) {
  try { return fs.readFileSync(LOG_FILE, 'utf8').trimEnd().split('\n').slice(-lines).join('\n'); } catch { return ''; }
}

const portBusyMessage = () =>
  `Port ${PORT} is in use by another program (not Clorbit).\n` +
  `Stop that program, or run Clorbit on another port: CLORBIT_PORT=${PORT + 1} clorbit start\n` +
  `(the plugin's hooks follow CLORBIT_PORT too when it is set in Claude Code's environment).`;

/** Starts the server unless it is running. Returns true when Clorbit answers on the port. */
async function start() {
  let p = await probe();
  if (p.kind === 'clorbit') {
    const own = readPidFile();
    // After a plugin update the old server keeps running from the old cache folder: restart it once.
    if (own && own.pid === p.info.pid && older(p.info.version, VERSION)) {
      say(`Restarting Clorbit ${p.info.version} → ${VERSION}...`);
      await stop({ silent: true });
      p = await probe();
    } else {
      say(`Clorbit ${p.info.version} is already running at ${URL_}`);
      return true;
    }
  }
  if (p.kind === 'other') {
    if (!quiet) console.error(portBusyMessage());
    return false;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let child = null;
  if (takeLock()) child = spawnServer();
  else say('Another Clorbit start is in progress, waiting for it...');
  if (quiet) return true; // ensure: never wait, the hook must stay instant

  let exited = null;
  child?.on('exit', (code) => { exited = code ?? 'signal'; });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    await sleep(250);
    if (exited !== null) break;
    const l = await getJson('/api/live', 2000);
    if (l.status === 200 && l.json && 'hooksInstalled' in l.json) {
      dropLock();
      const h = await getJson('/api/health');
      say(`Clorbit ${h.json?.version ?? VERSION} is running at ${URL_} (pid ${h.json?.pid ?? child?.pid ?? '?'})`);
      say(`Data: ${tilde(DATA_DIR)}  Log: ${tilde(LOG_FILE)}`);
      return true;
    }
  }
  dropLock();
  console.error(exited !== null ? `Clorbit exited during startup (code ${exited}).` : 'Clorbit did not answer within 20 s.');
  const tail = logTail();
  if (tail) console.error(`Last lines of ${tilde(LOG_FILE)}:\n${tail}`);
  return false;
}

async function stop({ silent = false } = {}) {
  const out = silent ? () => {} : say;
  dropLock();
  const own = readPidFile();
  if (!own || !alive(own.pid)) {
    if (own) fs.rmSync(PID_FILE, { force: true }); // stale
    const p = await probe();
    if (p.kind === 'clorbit') {
      out(`Clorbit on port ${PORT} was not started by this CLI${p.info.pid ? ` (pid ${p.info.pid})` : ''}; stop it where it was started (for example Ctrl+C in the pnpm dev terminal).`);
      return false;
    }
    out('Clorbit is not running.');
    return true;
  }
  // Make sure the pid still belongs to Clorbit (pids get reused after a reboot).
  const h = await getJson('/api/health', 1500, own.port || PORT);
  if (!(h.json?.app === 'clorbit' && h.json.pid === own.pid)) {
    fs.rmSync(PID_FILE, { force: true });
    out(`Clorbit is not running (removed a stale pid file for pid ${own.pid}).`);
    return true;
  }
  process.kill(own.pid, 'SIGTERM');
  const deadline = Date.now() + 8000;
  while (alive(own.pid) && Date.now() < deadline) await sleep(100);
  if (alive(own.pid)) { try { process.kill(own.pid, 'SIGKILL'); } catch { /* exited meanwhile */ } }
  fs.rmSync(PID_FILE, { force: true });
  out(`Stopped Clorbit (pid ${own.pid}).`);
  return true;
}

async function status() {
  const p = await probe();
  if (p.kind === 'free') {
    say(`Clorbit is not running (port ${PORT} is free). Start it with: clorbit start  (or /clorbit in Claude Code)`);
    say(`CLI ${VERSION}, data: ${tilde(DATA_DIR)}`);
    return true;
  }
  if (p.kind === 'other') { console.error(portBusyMessage()); return false; }
  const { info } = p;
  const own = readPidFile();
  const live = await getJson('/api/live', 3000);
  const dbg = await getJson('/api/debug/db', 3000);
  const events = dbg.json?.rows?.hookEvents;
  const hooks = live.json?.hooksInstalled
    ? `on${typeof events === 'number' ? ` (${events} events stored)` : ''}`
    : 'no events yet: install the clorbit plugin and restart your Claude Code sessions';
  say(`Clorbit ${info.version} is running`);
  say(`  URL:    ${URL_}`);
  say(`  PID:    ${info.pid ?? '?'}${own && own.pid === info.pid ? ' (started by the CLI)' : ' (started outside the CLI)'}`);
  say(`  Data:   ${tilde(info.dataDir || DATA_DIR)}`);
  if (own && own.pid === info.pid) say(`  Log:    ${tilde(LOG_FILE)}`);
  say(`  Hooks:  ${hooks}`);
  if (info.version !== VERSION) say(`  Note:   this CLI is ${VERSION}; run "clorbit stop && clorbit start" to switch.`);
  return true;
}

function openBrowser(url) {
  const [bin, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  return new Promise((resolve) => {
    try {
      const c = spawn(bin, args, { stdio: 'ignore', detached: true, windowsHide: true });
      c.on('error', () => resolve(false));
      c.on('spawn', () => { c.unref(); resolve(true); });
    } catch { resolve(false); }
  });
}

async function open() {
  if (!(await start())) return false;
  if (await openBrowser(URL_)) say(`Opened ${URL_} in your browser.`);
  else say(`Open ${URL_} in your browser.`);
  return true;
}

function help() {
  console.log(`Clorbit ${VERSION}: a local dashboard for your Claude Code sessions.

Usage: clorbit [command]

  open     start the server if needed and open the dashboard (default)
  start    start the server in the background
  stop     stop the server started by this CLI
  status   show whether it runs, its URL, version, data dir and hooks
  ensure   start silently if not running (used by the plugin's SessionStart hook)
  version  print the version

Environment: CLORBIT_PORT (default 4980), CLORBIT_DATA_DIR (default ~/.clorbit),
CLORBIT_AUTOSTART=0 disables the autostart hook.`);
}

async function main() {
  switch (cmd) {
    case 'open': return open();
    case 'start': return start();
    case 'stop': return stop();
    case 'status': return status();
    case 'ensure':
      if (env('AUTOSTART') === '0') return true;
      try { await start(); } catch { /* never fail a hook */ }
      return true;
    case 'version': case '--version': case '-v': console.log(VERSION); return true;
    case 'help': case '--help': case '-h': help(); return true;
    default:
      console.error(`Unknown command "${cmd}".\n`);
      help();
      return false;
  }
}

main().then((ok) => process.exit(quiet || slash || ok ? 0 : 1), (e) => {
  if (!quiet) console.error(e?.stack || String(e));
  process.exit(quiet || slash ? 0 : 1);
});
