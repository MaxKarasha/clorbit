// "Open in terminal": finds the terminal app (and the tab) that hosts a live Claude Code process and brings it
// to the front. Detection reads the process's environment (`ps -E` on macOS, /proc on Linux), its tty and, as a
// last resort, its parent processes. Switching uses each terminal's own handle: Warp's WARP_FOCUS_URL, AppleScript
// by tty for iTerm2 and Terminal, `wezterm cli`, `kitten @` (with remote control on), tmux panes. Any other macOS
// app is brought to the front by its bundle id. Commands run with execFile and argument arrays (never a shell),
// and every value taken from a process's environment is validated before it is used.
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TERMINAL_APPS, TERMINAL_NAMES, type TerminalApp, type TerminalChoice, type TerminalFocusResult, type TerminalInfo, type TerminalPrecision } from '../shared/api';

/** The only environment variables Clorbit reads from a session's process. */
export const ENV_KEYS = [
  'TERM_PROGRAM', 'WARP_FOCUS_URL', '__CFBundleIdentifier', 'KITTY_WINDOW_ID', 'KITTY_LISTEN_ON', 'WEZTERM_PANE',
  'WEZTERM_UNIX_SOCKET', 'TMUX', 'TMUX_PANE', 'ALACRITTY_WINDOW_ID', 'ALACRITTY_SOCKET', 'GHOSTTY_RESOURCES_DIR',
] as const;
export type EnvKey = (typeof ENV_KEYS)[number];
export type ProcEnv = Partial<Record<EnvKey, string>>;

interface AppDef { name: string; bundle: string; bundles: RegExp; term?: string[] }
export const APPS: Record<TerminalApp, AppDef> = {
  warp: { name: TERMINAL_NAMES.warp, bundle: 'dev.warp.Warp-Stable', bundles: /^dev\.warp\./, term: ['WarpTerminal'] },
  iterm: { name: TERMINAL_NAMES.iterm, bundle: 'com.googlecode.iterm2', bundles: /^com\.googlecode\.iterm2/, term: ['iTerm.app'] },
  terminal: { name: TERMINAL_NAMES.terminal, bundle: 'com.apple.Terminal', bundles: /^com\.apple\.Terminal$/, term: ['Apple_Terminal'] },
  ghostty: { name: TERMINAL_NAMES.ghostty, bundle: 'com.mitchellh.ghostty', bundles: /^com\.mitchellh\.ghostty/, term: ['ghostty'] },
  wezterm: { name: TERMINAL_NAMES.wezterm, bundle: 'com.github.wez.wezterm', bundles: /^com\.github\.wez\.wezterm/, term: ['WezTerm'] },
  kitty: { name: TERMINAL_NAMES.kitty, bundle: 'net.kovidgoyal.kitty', bundles: /^net\.kovidgoyal\.kitty/ },
  alacritty: { name: TERMINAL_NAMES.alacritty, bundle: 'org.alacritty', bundles: /^org\.alacritty/ },
  vscode: { name: TERMINAL_NAMES.vscode, bundle: 'com.microsoft.VSCode', bundles: /^com\.microsoft\.VSCode/ },
  cursor: { name: TERMINAL_NAMES.cursor, bundle: 'com.todesktop.230313mzl4w4u92', bundles: /^com\.todesktop\.230313mzl4w4u92$/ },
  windsurf: { name: TERMINAL_NAMES.windsurf, bundle: 'com.exafunction.windsurf', bundles: /^com\.exafunction\.windsurf/ },
};
/** VS Code and its forks all say TERM_PROGRAM=vscode; the bundle id tells them apart. */
const VSCODE_FAMILY: TerminalApp[] = ['cursor', 'windsurf', 'vscode'];

const RE = {
  warpUrl: /^warp:\/\/session\/[A-Za-z0-9-]{8,64}$/,
  bundle: /^[A-Za-z0-9][A-Za-z0-9.-]{2,120}$/,
  tty: /^(ttys?\d{1,4}|pts\/\d{1,5})$/,
  num: /^\d{1,9}$/,
  tmuxPane: /^%\d{1,9}$/,
  tmuxSocket: /^\/[^\0\n\r,]{1,500}$/,
  kittyTo: /^(unix:[@/][^\0\s]{1,300}|tcp:(localhost|127\.0\.0\.1):\d{1,5})$/,
  path: /^\/[^\0\n\r]{1,1000}$/,
};

export interface Detected {
  app: TerminalApp | 'other' | null;
  name: string | null;
  /** To bring the app to the front on macOS: its bundle id, or its .app path when the id is unknown. */
  bundle: string | null;
  appPath: string | null;
  env: ProcEnv;
  tty: string | null;
}

/** `ps -E -o command=` output → the known variables (the last occurrence wins: the environment follows the arguments). */
export function parsePsEnv(out: string): ProcEnv {
  const env: ProcEnv = {};
  for (const tok of out.split(/\s+/)) {
    const eq = tok.indexOf('=');
    if (eq <= 0) continue;
    const k = tok.slice(0, eq) as EnvKey;
    if ((ENV_KEYS as readonly string[]).includes(k)) env[k] = tok.slice(eq + 1);
  }
  return env;
}

/** /proc/<pid>/environ (NUL-separated) → the known variables. */
export function parseProcEnviron(buf: string): ProcEnv {
  const env: ProcEnv = {};
  for (const kv of buf.split('\0')) {
    const eq = kv.indexOf('=');
    if (eq <= 0) continue;
    const k = kv.slice(0, eq) as EnvKey;
    if ((ENV_KEYS as readonly string[]).includes(k)) env[k] = kv.slice(eq + 1);
  }
  return env;
}

/** '/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/…' → the outermost .app. */
export function appBundlePath(command: string): string | null {
  const i = command.indexOf('.app/');
  if (i < 0) return command.endsWith('.app') && RE.path.test(command) ? command : null;
  const p = command.slice(0, i + 4);
  return RE.path.test(p) ? p : null;
}

const appName = (p: string | null) => (p ? path.basename(p).replace(/\.app$/, '') : null);

function known(id: TerminalApp, bundle: string | null, appPath: string | null): Pick<Detected, 'app' | 'name' | 'bundle' | 'appPath'> {
  const def = APPS[id];
  return { app: id, name: def.name, bundle: bundle && def.bundles.test(bundle) ? bundle : def.bundle, appPath };
}

/** Which app hosts a process, from its environment (and its .app path when the environment says nothing). */
export function detectApp(env: ProcEnv, appPath: string | null = null): Pick<Detected, 'app' | 'name' | 'bundle' | 'appPath'> {
  const tp = env.TERM_PROGRAM ?? '';
  const bundle = env.__CFBundleIdentifier && RE.bundle.test(env.__CFBundleIdentifier) ? env.__CFBundleIdentifier : null;
  if (tp === 'vscode') {
    const fork = VSCODE_FAMILY.find((id) => bundle && APPS[id].bundles.test(bundle));
    return known(fork ?? 'vscode', bundle, appPath);
  }
  for (const id of TERMINAL_APPS) if (APPS[id].term?.includes(tp)) return known(id, bundle, appPath);
  if (env.KITTY_WINDOW_ID) return known('kitty', bundle, appPath);
  if (env.ALACRITTY_WINDOW_ID || env.ALACRITTY_SOCKET) return known('alacritty', bundle, appPath);
  if (env.GHOSTTY_RESOURCES_DIR) return known('ghostty', bundle, appPath);
  if (bundle) {
    for (const id of TERMINAL_APPS) if (APPS[id].bundles.test(bundle)) return known(id, bundle, appPath);
    return { app: 'other', name: appName(appPath) ?? bundle.split('.').pop() ?? bundle, bundle, appPath };
  }
  if (appPath) return { app: 'other', name: appName(appPath), bundle: null, appPath };
  return { app: null, name: null, bundle: null, appPath: null };
}

// ---------- plans ----------

export interface Cmd {
  file: string;
  args: string[];
  env?: Record<string, string>;
  /** The command must print this (AppleScript prints "ok" when it found the tab). */
  expect?: string;
  /** A failure does not count (tmux switch-client without an attached client). */
  optional?: boolean;
}

export interface FocusPlan {
  name: string | null;
  precision: TerminalPrecision;
  /** Commands that select the exact tab or pane, in order. */
  steps: Cmd[];
  /** Brings the app to the front: after the steps when `activateAfter`, and as the fallback when a step fails. */
  activate: Cmd | null;
  activateAfter: boolean;
  tmux?: boolean;
}

export interface Tools { open: boolean; osascript: boolean; tmux: string | null; wezterm: string | null; kitten: string | null }

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** AppleScript that selects the tab whose tty is `dev` and prints "ok" (or "missing"). */
export function tabScript(app: 'iterm' | 'terminal', dev: string): string {
  if (app === 'iterm') {
    return [
      `tell application id "${APPS.iterm.bundle}"`,
      '  repeat with w in windows',
      '    repeat with t in tabs of w',
      '      repeat with s in sessions of t',
      `        if tty of s is "${q(dev)}" then`,
      '          select w',
      '          select t',
      '          select s',
      '          activate',
      '          return "ok"',
      '        end if',
      '      end repeat',
      '    end repeat',
      '  end repeat',
      'end tell',
      'return "missing"',
    ].join('\n');
  }
  return [
    `tell application id "${APPS.terminal.bundle}"`,
    '  repeat with w in windows',
    '    repeat with t in tabs of w',
    `      if tty of t is "${q(dev)}" then`,
    '        set selected of t to true',
    '        set index of w to 1',
    '        activate',
    '        return "ok"',
    '      end if',
    '    end repeat',
    '  end repeat',
    'end tell',
    'return "missing"',
  ].join('\n');
}

/** How to reach a (non-tmux) process: `choice` other than 'auto' overrides the detected app. */
export function planFor(d: Detected, choice: TerminalChoice, tools: Tools, platform: NodeJS.Platform): FocusPlan {
  const app = choice === 'auto' || choice === 'off' ? d.app : choice;
  const def = app && app !== 'other' ? APPS[app] : null;
  const mac = platform === 'darwin';
  const bundle = def ? (d.bundle && def.bundles.test(d.bundle) ? d.bundle : def.bundle) : d.bundle;
  const activate: Cmd | null = !mac || !tools.open ? null
    : bundle ? { file: 'open', args: ['-b', bundle] }
    : d.appPath && RE.path.test(d.appPath) ? { file: 'open', args: ['-a', d.appPath] }
    : null;
  const steps: Cmd[] = [];
  let activateAfter = true;
  const env = d.env;
  if (app === 'warp' && mac && tools.open && env.WARP_FOCUS_URL && RE.warpUrl.test(env.WARP_FOCUS_URL)) {
    steps.push({ file: 'open', args: [env.WARP_FOCUS_URL] });
    activateAfter = false;
  } else if ((app === 'iterm' || app === 'terminal') && mac && tools.osascript && d.tty && RE.tty.test(d.tty)) {
    steps.push({ file: 'osascript', args: ['-e', tabScript(app, `/dev/${d.tty}`)], expect: 'ok' });
    activateAfter = false;
  } else if (app === 'wezterm' && tools.wezterm && env.WEZTERM_PANE && RE.num.test(env.WEZTERM_PANE)) {
    const sock = env.WEZTERM_UNIX_SOCKET && RE.path.test(env.WEZTERM_UNIX_SOCKET) ? { WEZTERM_UNIX_SOCKET: env.WEZTERM_UNIX_SOCKET } : undefined;
    steps.push({ file: tools.wezterm, args: ['cli', 'activate-pane', '--pane-id', env.WEZTERM_PANE], env: sock });
  } else if (app === 'kitty' && tools.kitten && env.KITTY_WINDOW_ID && RE.num.test(env.KITTY_WINDOW_ID) && env.KITTY_LISTEN_ON && RE.kittyTo.test(env.KITTY_LISTEN_ON)) {
    steps.push({ file: tools.kitten, args: ['@', '--to', env.KITTY_LISTEN_ON, 'focus-window', '--match', `id:${env.KITTY_WINDOW_ID}`] });
  }
  return {
    name: def?.name ?? d.name,
    precision: steps.length ? 'tab' : activate ? 'app' : 'none',
    steps,
    activate,
    activateAfter,
  };
}

/** TMUX=<socket>,<server pid>,<session> → the socket path. */
export function tmuxSocket(env: ProcEnv): string | null {
  const s = env.TMUX?.split(',')[0] ?? '';
  return RE.tmuxSocket.test(s) ? s : null;
}

/** A process inside tmux: select its pane first, then reach the terminal tmux is attached in (`outer`). */
export function planTmux(inner: Detected, outer: Detected | null, choice: TerminalChoice, tools: Tools, platform: NodeJS.Platform): FocusPlan {
  const socket = tmuxSocket(inner.env);
  const pane = inner.env.TMUX_PANE && RE.tmuxPane.test(inner.env.TMUX_PANE) ? inner.env.TMUX_PANE : null;
  const none: Detected = { app: null, name: null, bundle: null, appPath: null, env: {}, tty: null };
  const o = planFor(outer ?? none, choice, tools, platform);
  const steps: Cmd[] = [];
  if (tools.tmux && socket && pane) {
    steps.push({ file: tools.tmux, args: ['-S', socket, 'switch-client', '-t', pane], optional: true });
    steps.push({ file: tools.tmux, args: ['-S', socket, 'select-window', '-t', pane] });
    steps.push({ file: tools.tmux, args: ['-S', socket, 'select-pane', '-t', pane] });
  }
  return {
    name: o.name ? `${o.name} · tmux` : 'tmux',
    precision: steps.length ? (o.precision === 'none' ? 'app' : 'tab') : o.precision,
    steps: [...steps, ...o.steps],
    activate: o.activate,
    activateAfter: o.activateAfter,
    tmux: true,
  };
}

// ---------- running ----------

export interface RunResult { ok: boolean; stdout: string; stderr: string }
export type Runner = (c: Cmd) => Promise<RunResult>;

const defaultRunner: Runner = (c) =>
  new Promise((resolve) => {
    execFile(c.file, c.args, { timeout: 5000, windowsHide: true, env: c.env ? { ...process.env, ...c.env } : process.env }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') + (err ? ` ${err.message}` : '') });
    });
  });

/** Runs a plan: the steps, then the app; a failed step falls back to bringing the app to the front. */
export async function runPlan(p: FocusPlan, run: Runner = defaultRunner): Promise<TerminalFocusResult> {
  if (p.precision === 'none') return { ok: false, name: p.name, precision: 'none', error: 'unsupported' };
  let warning: TerminalFocusResult['warning'];
  for (const c of p.steps) {
    const r = await run(c);
    const ok = r.ok && (!c.expect || r.stdout.trim() === c.expect);
    if (ok || c.optional) continue;
    // macOS asks once whether Clorbit may control the terminal (-1743: not authorized).
    warning = /-1743|not authori[sz]ed/i.test(r.stderr) ? 'permission' : 'tab-not-found';
    break;
  }
  if (!warning) {
    if (p.activateAfter && p.activate) await run(p.activate);
    return { ok: true, name: p.name, precision: p.precision };
  }
  if (p.activate && (await run(p.activate)).ok) return { ok: true, name: p.name, precision: 'app', warning };
  return { ok: false, name: p.name, precision: 'none', error: 'failed', warning };
}

// ---------- the locator ----------

function sh(file: string, args: string[]): string | null {
  try {
    return execFileSync(file, args, { encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  } catch {
    return null;
  }
}

function findBin(name: string, extra: string[] = []): string | null {
  const dirs = [...(process.env.PATH ?? '').split(path.delimiter), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
  for (const f of [...extra, ...dirs.filter(Boolean).map((d) => path.join(d, name))]) {
    try { fs.accessSync(f, fs.constants.X_OK); return f; } catch { /* next */ }
  }
  return null;
}

/** Reads what is needed about a process: environment, tty, and the .app it runs under. */
export interface ProcReader {
  env(pid: number): ProcEnv;
  tty(pid: number): string | null;
  appPath(pid: number): string | null;
  /** tmux: the pid of the most recently active client of the server at `socket`. */
  tmuxClient(tmux: string, socket: string): number | null;
}

export function systemReader(platform: NodeJS.Platform = process.platform): ProcReader {
  return {
    env(pid) {
      if (platform === 'linux') {
        try { return parseProcEnviron(fs.readFileSync(`/proc/${pid}/environ`, 'utf8')); } catch { return {}; }
      }
      const out = sh('ps', ['-E', '-ww', '-o', 'command=', '-p', String(pid)]);
      return out ? parsePsEnv(out) : {};
    },
    tty(pid) {
      const t = (sh('ps', ['-o', 'tty=', '-p', String(pid)]) ?? '').trim();
      return RE.tty.test(t) ? t : null;
    },
    appPath(pid) {
      if (platform !== 'darwin') return null;
      let p = pid;
      for (let i = 0; i < 16 && p > 1; i++) {
        const out = (sh('ps', ['-o', 'ppid=,comm=', '-p', String(p)]) ?? '').trim();
        const m = /^(\d+)\s+(.+)$/.exec(out);
        if (!m) return null;
        const app = appBundlePath(m[2]);
        if (app) return app;
        p = Number(m[1]);
      }
      return null;
    },
    tmuxClient(tmux, socket) {
      const out = sh(tmux, ['-S', socket, 'list-clients', '-F', '#{client_activity} #{client_pid}']) ?? '';
      let best: [number, number] | null = null;
      for (const line of out.split('\n')) {
        const m = /^(\d+) (\d+)$/.exec(line.trim());
        if (m && (!best || Number(m[1]) > best[0])) best = [Number(m[1]), Number(m[2])];
      }
      return best ? best[1] : null;
    },
  };
}

const TMUX_TTL = 30_000;

export class TerminalLocator {
  private cache = new Map<string, Detected>();
  private outerCache = new Map<string, { d: Detected | null; at: number }>();
  private toolsCache: Tools | null = null;

  constructor(
    readonly platform: NodeJS.Platform = process.platform,
    private reader: ProcReader = systemReader(platform),
    private run: Runner = defaultRunner,
    private toolsOverride: Tools | null = null,
  ) {}

  /** Only macOS and Linux have ways to switch terminals. */
  get supported(): boolean {
    return this.platform === 'darwin' || this.platform === 'linux';
  }

  tools(): Tools {
    if (this.toolsOverride) return this.toolsOverride;
    const mac = this.platform === 'darwin';
    this.toolsCache ??= {
      open: mac && findBin('open', ['/usr/bin/open']) !== null,
      osascript: mac && findBin('osascript', ['/usr/bin/osascript']) !== null,
      tmux: findBin('tmux'),
      wezterm: findBin('wezterm', mac ? ['/Applications/WezTerm.app/Contents/MacOS/wezterm'] : []),
      kitten: findBin('kitten', mac ? ['/Applications/kitty.app/Contents/MacOS/kitten'] : []),
    };
    return this.toolsCache;
  }

  private detectPid(pid: number): Detected {
    const env = this.reader.env(pid);
    const tty = this.reader.tty(pid);
    const quick = detectApp(env);
    const app = quick.app ? quick : detectApp(env, this.reader.appPath(pid));
    return { ...app, env, tty };
  }

  /** The process's terminal; `key` changes when the pid is reused by another session. */
  detect(pid: number, key = String(pid)): Detected {
    let d = this.cache.get(key);
    if (!d) {
      if (this.cache.size > 300) this.cache.clear();
      d = this.detectPid(pid);
      this.cache.set(key, d);
    }
    return d;
  }

  private outerOf(inner: Detected): Detected | null {
    const tools = this.tools();
    const socket = tmuxSocket(inner.env);
    if (!tools.tmux || !socket) return null;
    const hit = this.outerCache.get(socket);
    if (hit && Date.now() - hit.at < TMUX_TTL) return hit.d;
    const client = this.reader.tmuxClient(tools.tmux, socket);
    const d = client ? this.detectPid(client) : null;
    this.outerCache.set(socket, { d, at: Date.now() });
    return d;
  }

  plan(pid: number, choice: TerminalChoice, key?: string, fresh = false): FocusPlan {
    const d = this.detect(pid, key);
    const tools = this.tools();
    if (d.env.TMUX) {
      if (fresh) this.outerCache.clear();
      return planTmux(d, this.outerOf(d), choice, tools, this.platform);
    }
    return planFor(d, choice, tools, this.platform);
  }

  /** What the UI shows for a live session (null when the button is off or switching is not supported here). */
  describe(pid: number, choice: TerminalChoice, key?: string): TerminalInfo | null {
    if (!this.supported || choice === 'off') return null;
    const p = this.plan(pid, choice, key);
    return { app: choice === 'auto' ? this.detect(pid, key).app : choice, name: p.name, precision: p.precision, ...(p.tmux ? { tmux: true } : {}) };
  }

  async focus(pid: number, choice: TerminalChoice, key?: string): Promise<TerminalFocusResult> {
    if (choice === 'off') return { ok: false, name: null, precision: 'none', error: 'off' };
    if (!this.supported) return { ok: false, name: null, precision: 'none', error: 'unsupported' };
    return runPlan(this.plan(pid, choice, key, true), this.run);
  }
}
