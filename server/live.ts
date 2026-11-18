// Live state: sessions, agent trees, statuses and events for SSE.
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import type { Limits, LimitsForecast, LiveSession, LiveSnapshot, SessionKind, SessionStatus, Tokens } from '../shared/api.ts';
import { sessionKind } from '../shared/automation';
import { LEGACY_STATUSLINE_FILE, PROJECTS_DIR, SESSIONS_DIR, STATUSLINE_FILE, hookPluginEnabled } from './config';
import type { Hooks } from './hooks';
import { reasonCode, reasonText, type Lang, type Reason, type ServerEvent } from './i18n';
import { listTranscripts, type Store } from './store';
import { buildTree, sessionStatus, subagentDone } from './tree';
import type { FileSummary, ScanEvent } from './types';
import { addT4, contextLimitFor, localDate, projectOf, sumT4, toTokens, zeroT4, type T4 } from './util';

const DAY_MS = 24 * 3_600_000;

export interface PidInfo {
  pid: number; sessionId: string; cwd: string | null; startedAt: number | null; name: string | null; status: string | null; alive: boolean;
  /** 'interactive' | 'bg' | 'daemon' | 'daemon-worker' (Claude Code's own field), and the process's entrypoint. */
  kind?: string | null; entrypoint?: string | null;
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (e: any) { return e?.code === 'EPERM'; }
}

/** Reads ~/.claude/sessions/<pid>.json (read-only). */
export function readPidFiles(dir = SESSIONS_DIR): Map<string, PidInfo> {
  const out = new Map<string, PidInfo>();
  let names: string[] = [];
  try { names = fs.readdirSync(dir); } catch { return out; }
  for (const n of names) {
    if (!/^\d+\.json$/.test(n)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
      const pid = Number(j.pid ?? n.split('.')[0]);
      if (!j.sessionId) continue;
      const info: PidInfo = {
        pid, sessionId: String(j.sessionId), cwd: j.cwd ?? null, startedAt: typeof j.startedAt === 'number' ? j.startedAt : null,
        name: j.name ?? null, status: j.status ?? null, alive: isAlive(pid),
        kind: typeof j.kind === 'string' ? j.kind : null, entrypoint: typeof j.entrypoint === 'string' ? j.entrypoint : null,
      };
      const prev = out.get(info.sessionId);
      if (!prev || (!prev.alive && info.alive)) out.set(info.sessionId, info);
    } catch { /* the file is being written right now */ }
  }
  return out;
}

const HEAD_BYTES = 64 * 1024;

/**
 * The automation signals of a transcript from its first 64 KB: the first `entrypoint` and the first
 * user prompt's `turnOrigin` / `promptSource`. Used for summaries written before 0.2.1, which lack them.
 */
export function readHeadOrigin(file: string): { entrypoint: string | null; promptOrigin: string | null } {
  const out = { entrypoint: null as string | null, promptOrigin: null as string | null };
  let fd: number | null = null;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
    const lines = buf.subarray(0, n).toString('utf8').split('\n');
    if (n === HEAD_BYTES) lines.pop(); // the last line may be cut
    for (const line of lines) {
      if (!line.includes('"entrypoint"') && !line.includes('"promptSource"') && !line.includes('"turnOrigin"')) continue;
      let d: any;
      try { d = JSON.parse(line); } catch { continue; }
      if (!out.entrypoint && typeof d?.entrypoint === 'string') out.entrypoint = d.entrypoint;
      if (!out.promptOrigin && d?.type === 'user' && !d.isMeta) {
        const o = d.turnOrigin ?? d.promptSource;
        if (typeof o === 'string' && o) out.promptOrigin = o;
      }
      if (out.entrypoint && out.promptOrigin) break;
    }
  } catch { /* unreadable: no signals */ } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch { /* ignore */ }
  }
  return out;
}

/** A file's tokens over the last 24 h (hour precision) from its hourly buckets. */
export function tokensSince(s: FileSummary, cutoff: number, into: T4): T4 {
  if (s.lastTs < cutoff) return into;
  const fromDate = localDate(cutoff);
  for (const [date, b] of Object.entries(s.days)) {
    if (date < fromDate) continue;
    const [y, m, d] = date.split('-').map(Number);
    for (const [h, t] of Object.entries(b.hours)) {
      const start = new Date(y, m - 1, d, Number(h)).getTime();
      if (start + 3_600_000 > cutoff) addT4(into, t);
    }
  }
  return into;
}

/** Subscription limits from the status-line capture (new location first, then the legacy one). */
export function readLimits(): { limits: Limits | null; capture: boolean } {
  try {
    const file = fs.existsSync(STATUSLINE_FILE) || !fs.existsSync(LEGACY_STATUSLINE_FILE) ? STATUSLINE_FILE : LEGACY_STATUSLINE_FILE;
    const st = fs.statSync(file);
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    const rl = j.rate_limits ?? {};
    const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const sec = (v: any) => (num(v) === null ? null : (v < 1e12 ? v * 1000 : v));
    return {
      capture: true,
      limits: {
        fiveHourPct: num(rl.five_hour?.used_percentage), fiveHourResetsAt: sec(rl.five_hour?.resets_at),
        sevenDayPct: num(rl.seven_day?.used_percentage), sevenDayResetsAt: sec(rl.seven_day?.resets_at),
        updatedAt: Math.round(st.mtimeMs),
      },
    };
  } catch {
    return { limits: null, capture: false };
  }
}

export class Live extends EventEmitter {
  pids = new Map<string, PidInfo>();
  private statusMem = new Map<string, { status: SessionStatus; since: number; reason: Reason | null }>();
  private finishedMem = new Map<string, Set<string>>();
  private cache: { at: number; v: LiveSnapshot; reasons: Map<string, Reason | null> } | null = null;
  private timers: NodeJS.Timeout[] = [];
  private watchers: fs.FSWatcher[] = [];
  private pending = new Map<string, NodeJS.Timeout>();
  private baseline = false;
  /** Automation signals read from the head of pre-0.2.1 summaries' transcripts, by path. */
  private heads = new Map<string, { entrypoint: string | null; promptOrigin: string | null }>();
  /** Subscription-limit forecast for the snapshot (set by the server; see limits-forecast.ts). */
  forecast: ((limits: Limits | null, now: number) => LimitsForecast) | null = null;

  constructor(private store: Store, private hooks: Hooks) {
    super();
    this.pids = readPidFiles();
    store.on('file', (s: FileSummary, events: ScanEvent[], isNew: boolean) => this.onFile(s, events, isNew));
  }

  emitEvent(e: ServerEvent) { this.cache = null; this.emit('event', e); }

  private onFile(s: FileSummary, events: ScanEvent[], isNew: boolean) {
    this.cache = null;
    const agentId = s.agentId ?? 'main';
    const sid = s.sessionId;
    if (isNew && s.agentId) {
      const main = this.store.mainOf(sid);
      const subs = this.store.sessionFiles(sid).filter((x) => x.agentId);
      let parentId = 'main';
      if (s.meta?.toolUseId) {
        if (main?.spawns[s.meta.toolUseId]) parentId = 'main';
        else for (const x of subs) if (x.spawns[s.meta.toolUseId]) parentId = x.agentId!;
      }
      this.emit('event', { kind: 'spawn', ts: s.firstTs || Date.now(), sessionId: sid, parentId, agentId, agentType: s.meta?.agentType ?? 'general-purpose', description: s.meta?.description ?? null } satisfies ServerEvent);
    }
    // Events of a newly seen large file (e.g. after a restart) are not broadcast — only fresh ones.
    const fresh = Date.now() - 5 * 60_000;
    for (const e of events) {
      if (e.ts < fresh) continue;
      if (e.kind === 'tool') this.emit('event', { kind: 'tool', ts: e.ts, sessionId: sid, agentId, tool: e.name, label: e.label } satisfies ServerEvent);
      else if (e.kind === 'text') this.emit('event', { kind: 'text', ts: e.ts, sessionId: sid, agentId, text: e.text } satisfies ServerEvent);
      else if (e.kind === 'prompt' && !s.agentId) this.emit('event', { kind: 'prompt', ts: e.ts, sessionId: sid } satisfies ServerEvent);
      else if (e.kind === 'compact') this.emit('event', { kind: 'compact', ts: e.ts, sessionId: sid } satisfies ServerEvent);
    }
  }

  start() {
    // Watch transcripts: recursive fs.watch works on macOS (and recent Linux Node builds).
    try {
      const w = fs.watch(PROJECTS_DIR, { recursive: true }, (_ev, name) => {
        if (!name) return;
        const f = String(name);
        if (f.endsWith('.jsonl')) this.schedule(path.join(PROJECTS_DIR, f));
        else if (f.endsWith('.meta.json')) this.schedule(path.join(PROJECTS_DIR, f.replace(/\.meta\.json$/, '.jsonl')));
      });
      this.watchers.push(w);
    } catch (e) { console.warn('[clorbit] fs.watch on projects is unavailable:', (e as Error).message); }
    try {
      const w = fs.watch(SESSIONS_DIR, () => this.schedule('__sessions__'));
      this.watchers.push(w);
    } catch { /* the folder may be missing */ }
    // Fallback polling of live sessions' file sizes (fs.watch sometimes misses changes).
    this.timers.push(setInterval(() => this.poll(), 3000));
    // New files that might have been missed.
    this.timers.push(setInterval(() => this.relist(), 60_000));
    // Status tick.
    this.timers.push(setInterval(() => this.tick(), 2000));
    this.store.on('scan-done', () => this.relist());
  }

  stop() {
    for (const t of this.timers) clearInterval(t);
    for (const w of this.watchers) w.close();
    for (const t of this.pending.values()) clearTimeout(t);
  }

  private schedule(key: string) {
    if (this.pending.has(key)) return;
    this.pending.set(key, setTimeout(() => {
      this.pending.delete(key);
      if (key === '__sessions__') { this.pids = readPidFiles(); this.cache = null; return; }
      // While the cold scan runs, it picks up new files itself.
      if (!this.store.scanDone && !this.store.files.has(key)) return;
      void this.store.refresh(key);
    }, 200));
  }

  private poll() {
    const now = Date.now();
    this.pids = readPidFiles();
    for (const s of this.store.files.values()) {
      const live = this.pids.get(s.sessionId)?.alive || now - s.lastTs < 10 * 60_000;
      if (!live) continue;
      try {
        const st = fs.statSync(s.path);
        if (st.size !== s.size || st.mtimeMs !== s.mtimeMs) void this.store.refresh(s.path);
      } catch { /* file deleted */ }
    }
    // Subagents of live sessions that appeared but are not known yet.
    if (this.store.scanDone) {
      for (const p of this.pids.values()) {
        if (!p.alive) continue;
        const main = this.store.mainOf(p.sessionId);
        const dir = main ? path.join(path.dirname(main.path), p.sessionId, 'subagents') : null;
        if (!dir) continue;
        try {
          for (const f of fs.readdirSync(dir)) {
            if (f.startsWith('agent-') && f.endsWith('.jsonl')) {
              const full = path.join(dir, f);
              if (!this.store.files.has(full)) void this.store.refresh(full);
            }
          }
        } catch { /* no subagents yet */ }
      }
    }
  }

  private relist() {
    if (!this.store.scanDone) return;
    for (const f of listTranscripts(PROJECTS_DIR)) if (!this.store.files.has(f)) void this.store.refresh(f);
  }

  /** Compares statuses with the previous tick and broadcasts changes. */
  private tick() {
    this.cache = null;
    const { v: snap, reasons } = this.compute();
    const emit = this.baseline;
    for (const ls of snap.sessions) {
      const prev = this.statusMem.get(ls.sessionId);
      if (emit && prev && prev.status !== ls.status) {
        this.emit('event', { kind: 'status', ts: snap.now, sessionId: ls.sessionId, status: ls.status, reason: reasons.get(ls.sessionId) ?? null } satisfies ServerEvent);
      }
    }
    // Finished subagents.
    for (const ls of snap.sessions) {
      const known = this.finishedMem.get(ls.sessionId) ?? new Set<string>();
      const subs = this.store.sessionFiles(ls.sessionId).filter((s) => s.agentId);
      const alive = ls.alive;
      for (const s of subs) {
        if (known.has(s.agentId!)) continue;
        if (subagentDone(s, snap.now, alive)) {
          known.add(s.agentId!);
          if (emit && snap.now - s.lastTs < 15 * 60_000) {
            const parent = s.meta?.toolUseId ? this.parentOf(ls.sessionId, s.meta.toolUseId) : 'main';
            this.emit('event', { kind: 'finish', ts: snap.now, sessionId: ls.sessionId, agentId: s.agentId!, parentId: parent, tokens: sumT4(s.total) } satisfies ServerEvent);
          }
        }
      }
      this.finishedMem.set(ls.sessionId, known);
    }
    if (this.store.scanDone) {
      this.baseline = true;
      // Server-side notifications watch the snapshot once the history is known (see notifier.ts).
      if (this.listenerCount('snapshot')) this.emit('snapshot', this.snapshot('en'));
    }
  }

  /** Interactive or automated (see shared/automation.ts), with the entrypoint it was decided by. */
  kindOf(sessionId: string, main: FileSummary | null = this.store.mainOf(sessionId) ?? null, pid: PidInfo | null = this.pids.get(sessionId) ?? null): { kind: SessionKind; entrypoint: string | null } {
    let entrypoint = main?.entrypoint ?? null;
    let promptOrigin = main?.promptOrigin ?? null;
    if (main && (main.entrypoint === undefined || main.promptOrigin === undefined)) {
      let h = this.heads.get(main.path);
      if (!h) {
        h = readHeadOrigin(main.path);
        this.heads.set(main.path, h);
        if (this.heads.size > 5000) this.heads.clear();
      }
      entrypoint = entrypoint ?? h.entrypoint;
      if (main.promptOrigin === undefined) promptOrigin = h.promptOrigin;
    }
    const kind = sessionKind({ pidKind: pid?.kind, pidEntrypoint: pid?.entrypoint, entrypoint, promptOrigin });
    return { kind, entrypoint: entrypoint ?? pid?.entrypoint ?? null };
  }

  /** Project and agent names of an event, resolved now (see EventContext). */
  context(e: ServerEvent): { project: string | null; agentName: string | null; parentName: string | null; automated: boolean } {
    const files = this.store.sessionFiles(e.sessionId);
    const main = files.find((f) => f.agentId === null) ?? null;
    const any = main ?? files[0] ?? null;
    const pid = this.pids.get(e.sessionId);
    const cwd = pid?.cwd ?? any?.cwd ?? '';
    const project = cwd || any?.projectDir ? projectOf(cwd, any?.projectDir) : null;
    const typeOf = (id: string | undefined): string | null => {
      if (!id || id === 'main') return null;
      const f = files.find((x) => x.agentId === id);
      return f?.meta?.agentType ?? null;
    };
    const agentId = 'agentId' in e ? e.agentId : undefined;
    const agentName = e.kind === 'spawn' ? e.agentType : typeOf(agentId);
    const parentName = 'parentId' in e ? typeOf(e.parentId) : null;
    return { project, agentName, parentName, automated: this.kindOf(e.sessionId, main, pid ?? null).kind === 'automated' };
  }

  private parentOf(sessionId: string, toolUseId: string): string {
    for (const s of this.store.sessionFiles(sessionId)) if (s.spawns[toolUseId]) return s.agentId ?? 'main';
    return 'main';
  }

  /** The live snapshot with status reasons rendered in the given language. */
  snapshot(lang: Lang = 'en'): LiveSnapshot {
    const { v, reasons } = this.compute();
    return {
      ...v,
      sessions: v.sessions.map((s) => {
        const r = reasons.get(s.sessionId);
        const { code, arg } = reasonCode(r);
        return { ...s, statusReason: reasonText(r, lang), statusCode: code, statusArg: arg };
      }),
    };
  }

  private compute(): { v: LiveSnapshot; reasons: Map<string, Reason | null> } {
    const now = Date.now();
    if (this.cache && now - this.cache.at < 500) return this.cache;
    const reasons = new Map<string, Reason | null>();
    const cutoff = now - DAY_MS;
    const today = localDate(now);
    const sessionIds = new Set<string>();
    for (const p of this.pids.values()) if (p.alive) sessionIds.add(p.sessionId);
    const recentFiles: FileSummary[] = [];
    for (const s of this.store.files.values()) {
      if (s.lastTs >= cutoff) { recentFiles.push(s); sessionIds.add(s.sessionId); }
    }
    const t24 = zeroT4();
    const tToday = zeroT4();
    const projects = new Set<string>();
    const nowMin = Math.floor(now / 60_000);
    const burn = new Array<number>(30).fill(0);
    let burn10 = 0;
    let finished24 = 0;
    for (const s of recentFiles) {
      tokensSince(s, cutoff, t24);
      const td = s.days[today];
      if (td) addT4(tToday, td.t);
      for (const [k, v] of Object.entries(s.minutes)) {
        const age = nowMin - Number(k);
        if (age >= 0 && age < 30) burn[29 - age] += v;
        if (age >= 0 && age < 10) burn10 += v;
      }
    }
    const sessions: LiveSession[] = [];
    let working = 0, waiting = 0, workingSubs = 0, alive = 0;
    for (const sid of sessionIds) {
      const files = this.store.sessionFiles(sid);
      const main = files.find((f) => f.agentId === null) ?? null;
      const subs = files.filter((f) => f.agentId !== null);
      const pid = this.pids.get(sid) ?? null;
      const isAlive = !!pid?.alive;
      const tree = buildTree(main, subs, now, isAlive, false);
      let st = sessionStatus(main, subs, tree, now, isAlive, pid?.status ?? null);
      const lastActivity = Math.max(main?.lastTs ?? 0, ...subs.map((s) => s.lastTs), pid?.startedAt ?? 0);
      // Hooks (when installed) beat the heuristic as long as the transcript is not newer than them.
      const hs = this.hooks.bySession.get(sid);
      if (hs && isAlive && hs.ts + 3000 >= lastActivity) st = { status: hs.status, reason: hs.reason };
      const mem = this.statusMem.get(sid);
      const since = mem && mem.status === st.status ? mem.since : (mem ? now : lastActivity || now);
      this.statusMem.set(sid, { status: st.status, since, reason: st.reason });
      reasons.set(sid, st.reason);
      const total = zeroT4();
      const s24 = zeroT4();
      for (const f of files) { addT4(total, f.total); tokensSince(f, cutoff, s24); }
      const cwd = pid?.cwd ?? main?.cwd ?? subs[0]?.cwd ?? '';
      const project = projectOf(cwd, main?.projectDir ?? subs[0]?.projectDir);
      if (sumT4(s24) > 0) projects.add(project);
      for (const f of subs) if (f.lastTs >= cutoff && subagentDone(f, now, isAlive)) finished24++;
      const k = this.kindOf(sid, main, pid);
      if (isAlive) alive++;
      if (st.status === 'working') working++;
      if (st.status === 'waiting') waiting++;
      workingSubs += tree.working;
      sessions.push({
        sessionId: sid,
        pid: pid?.pid ?? null,
        alive: isAlive,
        title: main?.title ?? null,
        name: pid?.name ?? null,
        cwd,
        project,
        gitBranch: main?.gitBranch ?? null,
        model: main?.model ?? null,
        effort: main?.effort ?? null,
        permissionMode: main?.permissionMode ?? null,
        status: st.status,
        statusSince: since,
        statusReason: null,
        startedAt: pid?.startedAt ?? main?.firstTs ?? now,
        lastActivity: lastActivity || now,
        tokens: toTokens(total),
        tokens24h: sumT4(s24),
        contextTokens: main && main.carry.lastCtx ? main.carry.lastCtx : null,
        contextLimit: main ? contextLimitFor(main.model, main.requestedModel, main.carry.maxCtx) : null,
        subagentsTotal: tree.total,
        subagentsActive: tree.active,
        compactions: main?.compactions ?? 0,
        root: tree.root,
        kind: k.kind,
        entrypoint: k.entrypoint,
      });
    }
    const order: Record<SessionStatus, number> = { waiting: 0, working: 1, idle: 2, stopped: 3 };
    sessions.sort((a, b) => order[a.status] - order[b.status] || b.lastActivity - a.lastActivity);
    const lim = readLimits();
    let limitsForecast: LimitsForecast | null = null;
    try { limitsForecast = this.forecast ? this.forecast(lim.limits, now) : null; } catch (e) {
      console.error('[clorbit] limits forecast failed:', (e as Error).message);
    }
    const t24tok: Tokens = toTokens(t24);
    const denom = t24[0] + t24[2] + t24[3];
    const v: LiveSnapshot = {
      now,
      sessions,
      totals: {
        tokens24h: t24tok,
        tokensToday: toTokens(tToday),
        burnPerMin: Math.round(burn10 / 10),
        burnSeries: burn,
        activeSessions: alive,
        workingSessions: working,
        waitingSessions: waiting,
        workingSubagents: workingSubs,
        finishedSubagents24h: finished24,
        cacheHitRate24h: denom ? t24[2] / denom : 0,
        projects24h: projects.size,
      },
      limits: lim.limits,
      limitsForecast,
      // Hooks count as installed when the clorbit plugin (or legacy fleet-hooks) is enabled, or events already arrived.
      hooksInstalled: hookPluginEnabled() || this.hooks.installed,
      statuslineCapture: lim.capture,
      scan: { done: this.store.scanDone, filesTotal: this.store.stats.filesTotal, filesDone: this.store.stats.filesDone },
    };
    this.cache = { at: now, v, reasons };
    return this.cache;
  }
}
