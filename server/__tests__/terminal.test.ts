// "Open in terminal": detection from a process's environment, plans per terminal, tmux, fallbacks.
import { describe, expect, it } from 'vitest';
import {
  appBundlePath, detectApp, parseProcEnviron, parsePsEnv, planFor, planTmux, runPlan, tabScript, TerminalLocator,
  type Cmd, type Detected, type FocusPlan, type ProcEnv, type ProcReader, type RunResult, type Tools,
} from '../terminal';

const TOOLS: Tools = { open: true, osascript: true, tmux: '/opt/homebrew/bin/tmux', wezterm: '/usr/local/bin/wezterm', kitten: '/usr/local/bin/kitten' };
const NO_TOOLS: Tools = { open: false, osascript: false, tmux: null, wezterm: null, kitten: null };
const WARP_ENV: ProcEnv = { TERM_PROGRAM: 'WarpTerminal', WARP_FOCUS_URL: 'warp://session/1a856c729d6447bdb3599819ce8a7ec9', __CFBundleIdentifier: 'dev.warp.Warp-Stable' };
const det = (env: ProcEnv, tty: string | null = 'ttys013', appPath: string | null = null): Detected => ({ ...detectApp(env, appPath), env, tty });

describe('reading the environment', () => {
  it('ps -E: only known variables, the environment after the arguments wins', () => {
    const out = 'claude --resume TMUX=fake TERM_PROGRAM=WarpTerminal HOME=/Users/x WARP_FOCUS_URL=warp://session/abc12345 TMUX=/tmp/tmux-501/default,1,0\n';
    expect(parsePsEnv(out)).toEqual({ TERM_PROGRAM: 'WarpTerminal', WARP_FOCUS_URL: 'warp://session/abc12345', TMUX: '/tmp/tmux-501/default,1,0' });
  });

  it('/proc/<pid>/environ', () => {
    expect(parseProcEnviron('PATH=/bin\0TERM_PROGRAM=WezTerm\0WEZTERM_PANE=3\0')).toEqual({ TERM_PROGRAM: 'WezTerm', WEZTERM_PANE: '3' });
  });

  it('the outermost .app of a process path', () => {
    expect(appBundlePath('/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Plugin).app/Contents/MacOS/Code Helper (Plugin)'))
      .toBe('/Applications/Visual Studio Code.app');
    expect(appBundlePath('/Applications/Hyper.app/Contents/MacOS/Hyper')).toBe('/Applications/Hyper.app');
    expect(appBundlePath('-zsh')).toBeNull();
  });
});

describe('detectApp', () => {
  it('knows terminals by TERM_PROGRAM and markers', () => {
    expect(detectApp(WARP_ENV)).toMatchObject({ app: 'warp', name: 'Warp', bundle: 'dev.warp.Warp-Stable' });
    expect(detectApp({ TERM_PROGRAM: 'iTerm.app' })).toMatchObject({ app: 'iterm', bundle: 'com.googlecode.iterm2' });
    expect(detectApp({ TERM_PROGRAM: 'Apple_Terminal' })).toMatchObject({ app: 'terminal' });
    expect(detectApp({ TERM_PROGRAM: 'ghostty' })).toMatchObject({ app: 'ghostty' });
    expect(detectApp({ KITTY_WINDOW_ID: '2' })).toMatchObject({ app: 'kitty' });
    expect(detectApp({ ALACRITTY_WINDOW_ID: '1' })).toMatchObject({ app: 'alacritty' });
  });

  it('tells VS Code and its forks apart by the bundle id', () => {
    expect(detectApp({ TERM_PROGRAM: 'vscode', __CFBundleIdentifier: 'com.todesktop.230313mzl4w4u92' })).toMatchObject({ app: 'cursor', name: 'Cursor' });
    expect(detectApp({ TERM_PROGRAM: 'vscode', __CFBundleIdentifier: 'com.microsoft.VSCodeInsiders' })).toMatchObject({ app: 'vscode', bundle: 'com.microsoft.VSCodeInsiders' });
    expect(detectApp({ TERM_PROGRAM: 'vscode' })).toMatchObject({ app: 'vscode', bundle: 'com.microsoft.VSCode' });
  });

  it('an unknown app: by its bundle id, else by its .app path; nothing → null', () => {
    expect(detectApp({ __CFBundleIdentifier: 'co.zeit.hyper' }, '/Applications/Hyper.app')).toEqual({ app: 'other', name: 'Hyper', bundle: 'co.zeit.hyper', appPath: '/Applications/Hyper.app' });
    expect(detectApp({}, '/Applications/Tabby.app')).toMatchObject({ app: 'other', name: 'Tabby', bundle: null });
    expect(detectApp({ __CFBundleIdentifier: 'bad id; rm' })).toMatchObject({ app: null });
    expect(detectApp({})).toMatchObject({ app: null, name: null });
  });
});

describe('planFor', () => {
  it('Warp: its own focus URL, no extra activation', () => {
    const p = planFor(det(WARP_ENV), 'auto', TOOLS, 'darwin');
    expect(p).toMatchObject({ name: 'Warp', precision: 'tab', activateAfter: false });
    expect(p.steps).toEqual([{ file: 'open', args: ['warp://session/1a856c729d6447bdb3599819ce8a7ec9'] }]);
    expect(p.activate).toEqual({ file: 'open', args: ['-b', 'dev.warp.Warp-Stable'] });
  });

  it('a malformed focus URL is never opened', () => {
    const p = planFor(det({ ...WARP_ENV, WARP_FOCUS_URL: 'https://evil.example/x' }), 'auto', TOOLS, 'darwin');
    expect(p.steps).toEqual([]);
    expect(p.precision).toBe('app');
  });

  it('iTerm2 and Terminal: AppleScript by tty', () => {
    const p = planFor(det({ TERM_PROGRAM: 'iTerm.app' }), 'auto', TOOLS, 'darwin');
    expect(p.precision).toBe('tab');
    expect(p.steps[0]).toMatchObject({ file: 'osascript', expect: 'ok' });
    expect(p.steps[0].args[1]).toContain('if tty of s is "/dev/ttys013"');
    expect(tabScript('terminal', '/dev/ttys002')).toContain('if tty of t is "/dev/ttys002"');
    // No tty (e.g. the VS Code extension): the app only.
    expect(planFor(det({ TERM_PROGRAM: 'iTerm.app' }, null), 'auto', TOOLS, 'darwin').precision).toBe('app');
  });

  it('WezTerm and kitty: their CLIs, then the app', () => {
    const w = planFor(det({ TERM_PROGRAM: 'WezTerm', WEZTERM_PANE: '7' }), 'auto', TOOLS, 'darwin');
    expect(w.steps).toEqual([{ file: '/usr/local/bin/wezterm', args: ['cli', 'activate-pane', '--pane-id', '7'], env: undefined }]);
    expect(w).toMatchObject({ precision: 'tab', activateAfter: true });
    const k = planFor(det({ KITTY_WINDOW_ID: '4', KITTY_LISTEN_ON: 'unix:/tmp/kitty-1' }), 'auto', TOOLS, 'darwin');
    expect(k.steps[0].args).toEqual(['@', '--to', 'unix:/tmp/kitty-1', 'focus-window', '--match', 'id:4']);
    // Without remote control kitty cannot pick a window: the app only.
    expect(planFor(det({ KITTY_WINDOW_ID: '4' }), 'auto', TOOLS, 'darwin').precision).toBe('app');
  });

  it('Ghostty, VS Code and unknown apps come to the front by bundle id or path', () => {
    expect(planFor(det({ TERM_PROGRAM: 'ghostty' }), 'auto', TOOLS, 'darwin')).toMatchObject({ precision: 'app', activate: { file: 'open', args: ['-b', 'com.mitchellh.ghostty'] } });
    expect(planFor(det({}, null, '/Applications/Tabby.app'), 'auto', TOOLS, 'darwin').activate).toEqual({ file: 'open', args: ['-a', '/Applications/Tabby.app'] });
    expect(planFor(det({}), 'auto', TOOLS, 'darwin').precision).toBe('none');
  });

  it('a chosen app overrides detection', () => {
    const p = planFor(det({ TERM_PROGRAM: 'ghostty' }), 'iterm', TOOLS, 'darwin');
    expect(p).toMatchObject({ name: 'iTerm2', precision: 'tab' });
    expect(planFor(det({}), 'alacritty', TOOLS, 'darwin')).toMatchObject({ name: 'Alacritty', precision: 'app', activate: { args: ['-b', 'org.alacritty'] } });
  });

  it('Linux: only terminals with a CLI; nothing to bring an app to the front', () => {
    expect(planFor(det({ TERM_PROGRAM: 'WezTerm', WEZTERM_PANE: '1' }), 'auto', TOOLS, 'linux').precision).toBe('tab');
    expect(planFor(det({ TERM_PROGRAM: 'ghostty' }), 'auto', TOOLS, 'linux').precision).toBe('none');
    expect(planFor(det(WARP_ENV), 'auto', NO_TOOLS, 'darwin').precision).toBe('none');
  });
});

describe('tmux', () => {
  const inner = det({ TERM_PROGRAM: 'tmux', TMUX: '/private/tmp/tmux-501/default,812,0', TMUX_PANE: '%5', __CFBundleIdentifier: 'dev.warp.Warp-Stable' });

  it('selects the pane, then reaches the terminal tmux is attached in', () => {
    const p = planTmux(inner, det(WARP_ENV), 'auto', TOOLS, 'darwin');
    expect(p).toMatchObject({ name: 'Warp · tmux', precision: 'tab', tmux: true });
    expect(p.steps.map((c) => c.args[2])).toEqual(['switch-client', 'select-window', 'select-pane', undefined]);
    expect(p.steps[0]).toMatchObject({ optional: true, args: ['-S', '/private/tmp/tmux-501/default', 'switch-client', '-t', '%5'] });
    expect(p.steps[3]).toEqual({ file: 'open', args: ['warp://session/1a856c729d6447bdb3599819ce8a7ec9'] });
  });

  it('no attached client: the pane still switches; a chosen app is brought to the front', () => {
    expect(planTmux(inner, null, 'auto', TOOLS, 'darwin')).toMatchObject({ name: 'tmux', precision: 'app', activate: null });
    expect(planTmux(inner, null, 'iterm', TOOLS, 'darwin')).toMatchObject({ name: 'iTerm2 · tmux', precision: 'tab', activate: { args: ['-b', 'com.googlecode.iterm2'] } });
  });
});

describe('runPlan', () => {
  const plan = (over: Partial<FocusPlan> = {}): FocusPlan => ({
    name: 'iTerm2', precision: 'tab', steps: [{ file: 'osascript', args: ['-e', 'x'], expect: 'ok' }],
    activate: { file: 'open', args: ['-b', 'com.googlecode.iterm2'] }, activateAfter: false, ...over,
  });
  const runner = (results: Record<string, RunResult>) => {
    const calls: string[] = [];
    const run = async (c: Cmd) => { calls.push(c.file); return results[c.file] ?? { ok: true, stdout: '', stderr: '' }; };
    return { run, calls };
  };

  it('the tab was found: done, no extra activation', async () => {
    const r = runner({ osascript: { ok: true, stdout: 'ok\n', stderr: '' } });
    expect(await runPlan(plan(), r.run)).toEqual({ ok: true, name: 'iTerm2', precision: 'tab' });
    expect(r.calls).toEqual(['osascript']);
  });

  it('the tab is gone: the app comes to the front with a warning', async () => {
    const r = runner({ osascript: { ok: true, stdout: 'missing', stderr: '' } });
    expect(await runPlan(plan(), r.run)).toEqual({ ok: true, name: 'iTerm2', precision: 'app', warning: 'tab-not-found' });
    expect(r.calls).toEqual(['osascript', 'open']);
  });

  it('macOS has not allowed Clorbit to control the terminal yet', async () => {
    const r = runner({ osascript: { ok: false, stdout: '', stderr: 'execution error: Not authorized to send Apple events to iTerm. (-1743)' } });
    expect(await runPlan(plan(), r.run)).toMatchObject({ ok: true, precision: 'app', warning: 'permission' });
  });

  it('optional steps may fail; activation follows when the plan asks for it; nothing to run → unsupported', async () => {
    const r = runner({ tmux: { ok: false, stdout: '', stderr: 'no current client' } });
    const p = plan({ steps: [{ file: 'tmux', args: [], optional: true }], activateAfter: true });
    expect(await runPlan(p, r.run)).toMatchObject({ ok: true, precision: 'tab' });
    expect(r.calls).toEqual(['tmux', 'open']);
    expect(await runPlan(plan({ precision: 'none', steps: [], activate: null }), r.run)).toMatchObject({ ok: false, error: 'unsupported' });
  });
});

describe('TerminalLocator', () => {
  const reader = (env: ProcEnv, appPath: string | null = null): ProcReader & { reads: number } => {
    const r = {
      reads: 0,
      env: () => { r.reads++; return env; },
      tty: () => 'ttys013',
      appPath: () => appPath,
      tmuxClient: () => null,
    };
    return r;
  };

  it('describes a session once per pid (cached) and follows the chosen app', () => {
    const rd = reader(WARP_ENV);
    const loc = new TerminalLocator('darwin', rd, undefined, TOOLS);
    expect(loc.describe(42, 'auto', '42:1')).toEqual({ app: 'warp', name: 'Warp', precision: 'tab' });
    expect(loc.describe(42, 'auto', '42:1')).toEqual({ app: 'warp', name: 'Warp', precision: 'tab' });
    expect(rd.reads).toBe(1);
    expect(loc.describe(42, 'off', '42:1')).toBeNull();
    expect(loc.describe(42, 'ghostty', '42:1')).toEqual({ app: 'ghostty', name: 'Ghostty', precision: 'app' });
  });

  it('focus runs the plan; off and unsupported platforms do nothing', async () => {
    const calls: Cmd[] = [];
    const loc = new TerminalLocator('darwin', reader(WARP_ENV), async (c) => { calls.push(c); return { ok: true, stdout: '', stderr: '' }; }, TOOLS);
    expect(await loc.focus(42, 'auto')).toEqual({ ok: true, name: 'Warp', precision: 'tab' });
    expect(calls).toEqual([{ file: 'open', args: ['warp://session/1a856c729d6447bdb3599819ce8a7ec9'] }]);
    expect(await loc.focus(42, 'off')).toMatchObject({ ok: false, error: 'off' });
    const win = new TerminalLocator('win32', reader(WARP_ENV), undefined, TOOLS);
    expect(win.describe(42, 'auto')).toBeNull();
    expect(await win.focus(42, 'auto')).toMatchObject({ ok: false, error: 'unsupported' });
  });

  it('looks for the .app only when the environment does not name the terminal', () => {
    const loc = new TerminalLocator('darwin', reader({}, '/Applications/Hyper.app'), undefined, TOOLS);
    expect(loc.describe(7, 'auto')).toEqual({ app: 'other', name: 'Hyper', precision: 'app' });
  });
});
