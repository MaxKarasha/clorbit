// System notifications shown by the server itself, so they work with the browser tab closed:
// macOS — `osascript -e 'display notification …'`, Linux — `notify-send`. Commands are run with
// execFile and an argument array (never a shell); AppleScript string literals are escaped.
// Everything here is fail-safe: errors are logged once and back off, and sending is rate-limited.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { LiveSnapshot, Settings } from '../shared/api.ts';
import { NotifyDetector, type DetectResult, type NotifyEvent } from '../shared/notify';
import { isSilenced } from '../shared/settings';
import { localizeEvent, notifyText, type Lang, type ServerEvent } from './i18n';

export type NotifyTool = 'osascript' | 'notify-send';
export interface Cmd { file: string; args: string[] }

const MAX_BODY = 240;
const clean = (s: string, n: number) => {
  const one = s.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  return one.length > n ? one.slice(0, n - 1) + '…' : one;
};

/** Escapes text for a double-quoted AppleScript string literal (control characters become spaces). */
export function escapeAppleScript(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** The command that shows one notification. Arguments are passed as an array; no shell is involved. */
export function notifierCommand(tool: NotifyTool, title: string, body: string): Cmd {
  const t = clean(title, 80);
  const b = clean(body, MAX_BODY);
  if (tool === 'osascript') {
    return { file: 'osascript', args: ['-e', `display notification "${escapeAppleScript(b)}" with title "${escapeAppleScript(t)}"`] };
  }
  // `--` ends options, so a body starting with "-" is never taken for a flag.
  return { file: 'notify-send', args: ['--app-name=Clorbit', '--', t, b] };
}

function executable(file: string): boolean {
  try { fs.accessSync(file, fs.constants.X_OK); return fs.statSync(file).isFile(); } catch { return false; }
}

/** Which notifier works on this machine: osascript on macOS, notify-send on Linux if present. */
export function detectTool(platform: NodeJS.Platform = process.platform, pathEnv = process.env.PATH ?? ''): NotifyTool | null {
  if (platform === 'darwin') return executable('/usr/bin/osascript') ? 'osascript' : null;
  if (platform === 'linux') {
    for (const dir of pathEnv.split(path.delimiter)) if (dir && executable(path.join(dir, 'notify-send'))) return 'notify-send';
  }
  return null;
}

export type Runner = (cmd: Cmd) => Promise<void>;

const defaultRunner: Runner = (cmd) => new Promise((resolve, reject) => {
  execFile(cmd.file, cmd.args, { timeout: 5000, windowsHide: true }, (err) => (err ? reject(err) : resolve()));
});

/** Rate-limited, fail-safe sender. */
export class SystemNotifier {
  private sent: number[] = [];
  private failures = 0;
  private pausedUntil = 0;

  constructor(
    readonly tool: NotifyTool | null = detectTool(),
    private run: Runner = defaultRunner,
    private now: () => number = Date.now,
    private limit = { perMinute: 6, minGapMs: 1500, maxFailures: 3, pauseMs: 10 * 60_000 },
  ) {}

  get available(): boolean { return this.tool !== null; }

  /** Shows a notification unless rate-limited or backed off. Returns whether it was attempted. */
  send(title: string, body: string): boolean {
    if (!this.tool) return false;
    const now = this.now();
    if (now < this.pausedUntil) return false;
    this.sent = this.sent.filter((t) => now - t < 60_000);
    if (this.sent.length >= this.limit.perMinute) return false;
    if (this.sent.length && now - this.sent[this.sent.length - 1] < this.limit.minGapMs) return false;
    this.sent.push(now);
    let cmd: Cmd;
    try { cmd = notifierCommand(this.tool, title, body); } catch { return false; }
    this.run(cmd).then(
      () => { this.failures = 0; },
      (e) => {
        if (++this.failures >= this.limit.maxFailures) {
          this.pausedUntil = this.now() + this.limit.pauseMs;
          this.failures = 0;
          console.warn(`[clorbit] system notifications keep failing (${(e as Error)?.message ?? e}); pausing them for 10 minutes`);
        }
      },
    );
    return true;
  }
}

/** Body text of a notification in the given language. */
export function notificationBody(ev: NotifyEvent, lang: Lang): string {
  const p = ev.project ?? '';
  const agent = ev.agentType || notifyText(lang, 'subagent');
  switch (ev.type) {
    case 'session_waiting':
      if (ev.wait === 'input') return notifyText(lang, 'waitInput', { p });
      if (ev.wait === 'permission') return ev.tool ? notifyText(lang, 'waitPermissionTool', { p, tool: ev.tool }) : notifyText(lang, 'waitPermission', { p });
      return notifyText(lang, 'waitYou', { p });
    case 'session_done': return notifyText(lang, 'done', { p });
    case 'subagent_finished': return (ev.count ?? 1) > 1 ? notifyText(lang, 'finishedMany', { p, n: ev.count! }) : notifyText(lang, 'finished', { p, agent });
    case 'subagent_spawned': return notifyText(lang, 'spawned', { p, agent });
    case 'compaction': return notifyText(lang, 'compaction', { p });
    case 'context_high': return notifyText(lang, 'contextHigh', { p, pct: ev.pct ?? 85 });
    case 'limit_high': return notifyText(lang, 'limitHigh', { w: notifyText(lang, ev.window === '7d' ? 'w7d' : 'w5h'), pct: ev.pct ?? 80 });
    case 'limit_forecast': return notifyText(lang, 'limitForecast', {
      w: notifyText(lang, ev.window === '7d' ? 'w7d' : 'w5h'),
      time: ev.at ? clockText(ev.at) : '—',
      left: ev.at && ev.resetsAt ? durationText(ev.resetsAt - ev.at, lang) : '—',
      pct: ev.pct ?? 0,
    });
  }
}

/** Local wall-clock time 'HH:MM' (the server runs on the user's machine, in their time zone). */
export function clockText(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** A short duration: '1 h 10 min' / '25 min'. */
export function durationText(ms: number, lang: Lang): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  return m >= 60 ? notifyText(lang, 'durHM', { h: Math.floor(m / 60), m: m % 60 }) : notifyText(lang, 'durM', { m });
}

export const notifyTestBody = (lang: Lang) => notifyText(lang, 'test');

/** A snapshot/event source (Live) — an EventEmitter with 'snapshot' and 'event'. */
interface Source {
  on(ev: 'snapshot', fn: (s: LiveSnapshot) => void): unknown;
  on(ev: 'event', fn: (e: ServerEvent) => void): unknown;
}

/**
 * Server-side notification logic: the shared detector over the live snapshot (every tick once the
 * history scan is done) and live events, honoring the saved settings and do-not-disturb, with a
 * per-session debounce and bursts of finished subagents merged into one notification.
 */
export class ServerNotifications {
  readonly detector = new NotifyDetector(() => this.settings().interface.showAutomated);
  private last = new Map<string, number>();
  private burst = new Map<string, { ev: NotifyEvent; timer: NodeJS.Timeout }>();

  constructor(
    private settings: () => Settings,
    private notifier: SystemNotifier,
    private now: () => number = Date.now,
    private opts = { debounceMs: 8000, burstMs: 2000 },
  ) {}

  attach(src: Source) {
    src.on('snapshot', (s) => this.handle(this.detector.onSnapshot(s)));
    src.on('event', (e) => this.handle(this.detector.onEvent(localizeEvent(e, 'en'))));
  }

  handle(res: DetectResult) {
    for (const ev of res.events) {
      try { this.consider(ev); } catch (e) { console.error('[clorbit] notification failed:', (e as Error).message); }
    }
  }

  private consider(ev: NotifyEvent) {
    const s = this.settings();
    if (!s.notifications[ev.type]?.system || !this.notifier.available) return;
    if (ev.type === 'subagent_finished') {
      // Merge a burst of finishes in one session into one notification.
      const key = ev.sessionId ?? '';
      const cur = this.burst.get(key);
      if (cur) { cur.ev.count = (cur.ev.count ?? 1) + 1; return; }
      const timer = setTimeout(() => { const b = this.burst.get(key); this.burst.delete(key); if (b) this.deliver(b.ev); }, this.opts.burstMs);
      timer.unref?.();
      this.burst.set(key, { ev: { ...ev, count: 1 }, timer });
      return;
    }
    this.deliver(ev);
  }

  private deliver(ev: NotifyEvent) {
    const s = this.settings();
    const now = this.now();
    if (isSilenced(s, now)) return;
    const key = `${ev.type}:${ev.sessionId ?? ''}:${ev.window ?? ''}`;
    const prev = this.last.get(key);
    if (prev != null && now - prev < this.opts.debounceMs) return;
    this.last.set(key, now);
    if (this.last.size > 500) for (const [k, t] of this.last) if (now - t > 60_000) this.last.delete(k);
    this.notifier.send('Clorbit', notificationBody(ev, s.interface.lang));
  }
}
