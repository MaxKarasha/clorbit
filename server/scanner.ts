// Scanner: streams one transcript and builds a summary with per-day buckets.
// A summary can be resumed from a byte offset (transcripts are append-only).
import fs from 'node:fs';
import path from 'node:path';
import { classifyPrefix, readLines, parseLine, type SkipKind } from './lines';
import {
  SUMMARY_VERSION, type Carry, type DayBucket, type FileSummary, type ScanEvent, type ScanOptions,
  type SubagentMeta, type UsageAgg,
} from './types';
import {
  addT4, estTokens, localDateHour, mcpKey, mcpSplit, parseTs, resultChars, sumT4, toolLabel, trimText, zeroT4, type T4,
} from './util';
import { OWN_SKILLS, STARTUP, hookEventKey, hookPluginKey } from './i18n';

const RECENT_REQ = 64;
const MAX_PENDING = 300;
const MAX_TOOLNAMES = 400;
const BIG_RESULT = 20_000;
const MAX_BIG = 30;

// Startup-context keys (language-neutral; rendered by i18n.startupLabel).
export const LABELS = STARTUP;

const ENV_TYPES = new Set([
  'environment', 'model', 'date', 'session_context', 'auto_mode', 'credential_org', 'remote_session_change',
  'command_permissions', 'silent_turn_reminder', 'plan_mode', 'output_style', 'todo_reminder',
]);

export function emptyCarry(): Carry {
  return {
    recentReq: [], pending: {}, toolNames: {}, lastStop: null, lastTool: null, lastToolName: null, lastToolTs: 0,
    lastText: null, lastTextTs: 0, lastCtx: 0, maxCtx: 0, lastPromptTs: 0, sessionStartPlugin: null, startupDone: false,
  };
}

export function emptyDay(): DayBucket {
  return {
    t: zeroT4(), turns: 0, unattributed: 0, models: {}, skills: {}, plugins: {}, mcpServers: {}, mcpTools: {},
    tools: {}, skillLoads: {}, hours: {}, toolCalls: 0, compactions: 0, autoCompactions: 0, hooks: {},
  };
}

/** Derives sessionId / agentId / project folder from a .jsonl path. */
export function identify(projectsDir: string, file: string): { sessionId: string; agentId: string | null; projectDir: string } | null {
  const rel = path.relative(projectsDir, file).split(path.sep);
  if (rel.length < 2 || rel[0] === '..' || !file.endsWith('.jsonl')) return null;
  const projectDir = rel[0];
  if (rel.length === 2) return { sessionId: path.basename(rel[1], '.jsonl'), agentId: null, projectDir };
  const base = path.basename(file, '.jsonl');
  if (rel[2] !== 'subagents' || !base.startsWith('agent-')) return null;
  return { sessionId: rel[1], agentId: base.slice(6), projectDir };
}

export function newSummary(file: string, id: { sessionId: string; agentId: string | null; projectDir: string }): FileSummary {
  return {
    v: SUMMARY_VERSION, path: file, size: 0, mtimeMs: 0, offset: 0,
    sessionId: id.sessionId, agentId: id.agentId, projectDir: id.projectDir, meta: null,
    cwd: null, gitBranch: null, title: null, permissionMode: null, model: null, requestedModel: null, effort: null,
    entrypoint: null, promptOrigin: null,
    firstTs: 0, lastTs: 0, lastAssistantTs: 0, total: zeroT4(), turns: 0, toolCalls: 0, compactions: 0,
    autoCompactions: 0, turnDurMs: 0, days: {}, minutes: {}, startup: {}, skillsByPlugin: {}, skillsByName: {}, mcpBlocks: {},
    mcpSeen: [], spawns: {}, reads: {}, bigResults: [], carry: emptyCarry(),
  };
}

export function readMeta(file: string): SubagentMeta | null {
  const metaPath = file.replace(/\.jsonl$/, '.meta.json');
  try {
    const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const wf = path.basename(path.dirname(file));
    return {
      agentType: m.agentType || 'general-purpose',
      description: m.description ?? null,
      spawnDepth: typeof m.spawnDepth === 'number' ? m.spawnDepth : 1,
      toolUseId: m.toolUseId ?? null,
      finished: typeof m.finished === 'boolean' ? m.finished : null,
      workflow: wf.startsWith('wf_') ? wf : null,
      worktreePath: m.worktreePath ?? null,
    };
  } catch {
    return null;
  }
}

function agg(map: Record<string, UsageAgg>, key: string, t: T4, ts: number) {
  let a = map[key];
  if (!a) a = map[key] = { t: zeroT4(), turns: 0, last: 0 };
  addT4(a.t, t);
  a.turns++;
  if (ts > a.last) a.last = ts;
}

/** The plugin a hook belongs to: a plugins/cache/<marketplace>/<plugin>/ path or a mention of its name. */
export function detectPlugin(texts: (string | undefined)[], known: string[]): string | null {
  for (const t of texts) {
    if (!t) continue;
    const m = /plugins\/(?:cache|marketplaces)\/[^/\s"]+\/([^/\s"]+)\//.exec(t);
    if (m) return m[1];
  }
  let best: string | null = null;
  let bestN = 0;
  for (const p of known) {
    let n = 0;
    for (const t of texts) {
      if (!t) continue;
      let i = t.indexOf(p);
      while (i >= 0 && n < 50) { n++; i = t.indexOf(p, i + p.length); }
    }
    if (n > bestN) { best = p; bestN = n; }
  }
  return best;
}

/** A tool result that is an error only because the user declined or interrupted the call. */
function declined(content: unknown): boolean {
  const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((b: any) => (typeof b?.text === 'string' ? b.text : '')).join(' ') : '';
  return /doesn't want to proceed|user rejected|was rejected|permission to use .* (has been|was) denied|interrupted by user|\[Request interrupted/i.test(text.slice(0, 400));
}

/** Line parser for one file that updates its summary in place. */
export class FileScanner {
  private s: FileSummary;
  private opts: ScanOptions;
  private onEvent?: (e: ScanEvent) => void;
  private isMain: boolean;
  private lastTs = 0;

  constructor(s: FileSummary, opts: ScanOptions, onEvent?: (e: ScanEvent) => void) {
    this.s = s; this.opts = opts; this.onEvent = onEvent; this.isMain = s.agentId === null;
    this.lastTs = s.lastTs;
  }

  private day(ts: number): { b: DayBucket; hour: number } {
    const { date, hour } = localDateHour(ts);
    let b = this.s.days[date];
    if (!b) b = this.s.days[date] = emptyDay();
    return { b, hour };
  }

  private touch(ts: number) {
    if (!this.s.firstTs || ts < this.s.firstTs) this.s.firstTs = ts;
    if (ts > this.s.lastTs) this.s.lastTs = ts;
    this.lastTs = ts;
  }

  private addStartup(label: string, chars: number) {
    if (this.s.carry.startupDone || chars <= 0) return;
    this.s.startup[label] = (this.s.startup[label] ?? 0) + chars;
  }

  skipped(kind: SkipKind, bytes: number) {
    if (kind === 'snapshot' && bytes > (this.s.startup[LABELS.system] ?? 0)) this.s.startup[LABELS.system] = bytes;
  }

  line(buf: Buffer) {
    const d = parseLine(buf);
    if (!d || typeof d !== 'object') return;
    this.record(d, buf.length);
  }

  record(d: any, lineLen: number) {
    const s = this.s;
    const ts = parseTs(d.timestamp) ?? this.lastTs;
    if (s.entrypoint == null && typeof d.entrypoint === 'string' && d.entrypoint) s.entrypoint = d.entrypoint;
    switch (d.type) {
      case 'assistant': return this.assistant(d, ts || Date.now());
      case 'user': return this.user(d, ts);
      case 'attachment': return this.attachment(d, ts, lineLen);
      case 'system': return this.system(d, ts);
      case 'ai-title': if (d.aiTitle) s.title = String(d.aiTitle); return;
      case 'permission-mode': if (d.permissionMode) s.permissionMode = String(d.permissionMode); return;
      default: return;
    }
  }

  private meta(d: any) {
    const s = this.s;
    if (d.cwd && !s.cwd) s.cwd = d.cwd;
    if (d.gitBranch) s.gitBranch = d.gitBranch;
  }

  private assistant(d: any, ts: number) {
    const s = this.s;
    const c = s.carry;
    const msg = d.message;
    if (!msg || typeof msg !== 'object') return;
    this.meta(d);
    const model: string | undefined = msg.model;
    if (model === '<synthetic>') return;
    this.touch(ts);
    s.lastAssistantTs = ts;
    if (!c.startupDone) c.startupDone = true;
    const sidechain = d.isSidechain === true && this.isMain;
    const reqKey: string | undefined = d.requestId || msg.id;
    const u = msg.usage;
    if (reqKey && u && !c.recentReq.includes(reqKey)) {
      c.recentReq.push(reqKey);
      if (c.recentReq.length > RECENT_REQ) c.recentReq.splice(0, c.recentReq.length - RECENT_REQ);
      const t: T4 = [u.input_tokens || 0, u.output_tokens || 0, u.cache_read_input_tokens || 0, u.cache_creation_input_tokens || 0];
      const total = sumT4(t);
      const { b, hour } = this.day(ts);
      addT4(b.t, t); b.turns++;
      addT4(s.total, t); s.turns++;
      const hk = String(hour);
      addT4(b.hours[hk] ?? (b.hours[hk] = zeroT4()), t);
      const mk = String(Math.floor(ts / 60_000));
      s.minutes[mk] = (s.minutes[mk] ?? 0) + total;
      if (model) agg(b.models, model, t, ts);
      let attributed = false;
      if (d.attributionSkill) { agg(b.skills, String(d.attributionSkill), t, ts); attributed = true; }
      if (d.attributionPlugin) { agg(b.plugins, String(d.attributionPlugin), t, ts); attributed = true; }
      if (d.attributionMcpServer) {
        agg(b.mcpServers, String(d.attributionMcpServer), t, ts); attributed = true;
        if (d.attributionMcpTool) agg(b.mcpTools, `${d.attributionMcpServer}\u0001${d.attributionMcpTool}`, t, ts);
      }
      if (!attributed) b.unattributed += total;
      if (!sidechain) {
        c.lastCtx = t[0] + t[2] + t[3];
        if (c.lastCtx > c.maxCtx) c.maxCtx = c.lastCtx;
      }
    }
    if (!sidechain) {
      if (model) s.model = model;
      if (d.requestedModel) s.requestedModel = String(d.requestedModel);
      const eff = d.perTurnEffort ?? d.effort;
      if (eff) s.effort = String(eff);
      if (msg.stop_reason) c.lastStop = msg.stop_reason;
    }
    const content = Array.isArray(msg.content) ? msg.content : [];
    for (const blk of content) {
      if (!blk || typeof blk !== 'object') continue;
      if (blk.type === 'tool_use') this.toolUse(blk, ts, sidechain);
      else if (blk.type === 'text' && typeof blk.text === 'string' && blk.text.trim() && !sidechain) {
        c.lastText = trimText(blk.text, 240);
        c.lastTextTs = ts;
        this.onEvent?.({ kind: 'text', ts, text: c.lastText });
      }
    }
    if (!sidechain && msg.stop_reason === 'end_turn') this.onEvent?.({ kind: 'end', ts });
  }

  private toolUse(blk: any, ts: number, sidechain: boolean) {
    const s = this.s;
    const c = s.carry;
    const name = String(blk.name || 'unknown');
    const input = blk.input ?? {};
    const label = toolLabel(name, input);
    const { b } = this.day(ts);
    const ta = b.tools[name] ?? (b.tools[name] = { calls: 0, res: 0, resN: 0, max: 0, last: 0 });
    ta.calls++; if (ts > ta.last) ta.last = ts;
    b.toolCalls++; s.toolCalls++;
    if (blk.id) {
      c.pending[blk.id] = { name, label, ts };
      c.toolNames[blk.id] = name;
      const pk = Object.keys(c.pending);
      if (pk.length > MAX_PENDING) for (const k of pk.slice(0, pk.length - MAX_PENDING)) delete c.pending[k];
      const nk = Object.keys(c.toolNames);
      if (nk.length > MAX_TOOLNAMES) for (const k of nk.slice(0, nk.length - MAX_TOOLNAMES)) delete c.toolNames[k];
    }
    if (!sidechain) { c.lastTool = label; c.lastToolName = name; c.lastToolTs = ts; }
    if (name === 'Skill' && input.skill) b.skillLoads[String(input.skill)] = (b.skillLoads[String(input.skill)] ?? 0) + 1;
    if ((name === 'Agent' || name === 'Task') && blk.id) {
      s.spawns[blk.id] = { ts, type: String(input.subagent_type || 'general-purpose'), desc: input.description ? String(input.description) : null };
    }
    if (name === 'Read' && typeof input.file_path === 'string') s.reads[input.file_path] = (s.reads[input.file_path] ?? 0) + 1;
    const m = mcpSplit(name);
    if (m && !s.mcpSeen.includes(m.server)) s.mcpSeen.push(m.server);
    if (!sidechain) this.onEvent?.({ kind: 'tool', ts, name, label });
  }

  private user(d: any, ts: number) {
    const s = this.s;
    const c = s.carry;
    const msg = d.message;
    if (!msg) return;
    if (ts) this.touch(ts);
    this.meta(d);
    const content = msg.content;
    const sidechain = d.isSidechain === true && this.isMain;
    let hasResult = false;
    if (Array.isArray(content)) {
      for (const blk of content) {
        if (!blk || blk.type !== 'tool_result') continue;
        hasResult = true;
        const id = blk.tool_use_id;
        const p = id ? c.pending[id] : undefined;
        const name = p?.name ?? (id ? c.toolNames[id] : undefined) ?? 'unknown';
        const tokens = estTokens(resultChars(blk.content));
        const { b } = this.day(ts || p?.ts || Date.now());
        const ta = b.tools[name] ?? (b.tools[name] = { calls: 0, res: 0, resN: 0, max: 0, last: 0 });
        ta.res += tokens; ta.resN++; if (tokens > ta.max) ta.max = tokens;
        if (blk.is_error === true && !declined(blk.content)) ta.err = (ta.err ?? 0) + 1;
        if (tokens > BIG_RESULT) {
          s.bigResults.push({ tool: name, label: p?.label ?? name, tokens, ts });
          if (s.bigResults.length > MAX_BIG) {
            s.bigResults.sort((a, b2) => b2.tokens - a.tokens);
            s.bigResults.length = MAX_BIG;
          }
        }
        if (id) { delete c.pending[id]; delete c.toolNames[id]; }
      }
    }
    if (!hasResult && !d.isMeta && !sidechain && d.type === 'user' && !d.sourceToolUseID) {
      const isText = typeof content === 'string' || (Array.isArray(content) && content.some((x: any) => x?.type === 'text'));
      if (isText) {
        // Only a summary that saw the start of the file (null, not a pre-0.2.1 undefined) records the first prompt.
        if (s.promptOrigin === null) {
          const o = d.turnOrigin ?? d.promptSource;
          s.promptOrigin = typeof o === 'string' && o ? o : '';
        }
        c.lastPromptTs = ts;
        c.lastStop = null;
        this.onEvent?.({ kind: 'prompt', ts });
      }
    }
  }

  private system(d: any, ts: number) {
    const s = this.s;
    if (ts) this.touch(ts);
    if (d.subtype === 'turn_duration' && typeof d.durationMs === 'number') s.turnDurMs += d.durationMs;
    else if (d.subtype === 'compact_boundary') {
      const auto = d.compactMetadata?.trigger === 'auto';
      s.compactions++; if (auto) s.autoCompactions++;
      const { b } = this.day(ts || Date.now());
      b.compactions++; if (auto) b.autoCompactions++;
      this.onEvent?.({ kind: 'compact', ts });
    }
  }

  private attachment(d: any, ts: number, lineLen: number) {
    const s = this.s;
    const c = s.carry;
    const a = d.attachment;
    if (!a || typeof a !== 'object') return;
    const rendered = Array.isArray(d.rendered)
      ? d.rendered.reduce((n: number, r: any) => n + (typeof r?.content === 'string' ? r.content.length : 0), 0)
      : 0;
    const size = rendered || lineLen;
    switch (a.type) {
      case 'hook_success':
      case 'hook_error':
      case 'hook_non_blocking_error':
      case 'hook_blocking_error': {
        if (ts) {
          const plugin = detectPlugin([a.command, a.stderr], []) ?? (a.hookEvent === 'SessionStart' ? detectPlugin([a.stdout], this.opts.knownPlugins) : null);
          const key = `${plugin ?? ''}|${a.hookName ?? a.hookEvent ?? '?'}`;
          const { b } = this.day(ts);
          const h = b.hooks[key] ?? (b.hooks[key] = { n: 0, ms: 0, err: 0 });
          h.n++; h.ms += typeof a.durationMs === 'number' ? a.durationMs : 0;
          if (a.type !== 'hook_success' || (typeof a.exitCode === 'number' && a.exitCode !== 0) || (a.stderr && String(a.stderr).trim())) h.err++;
          if (a.hookEvent === 'SessionStart' && plugin && typeof a.stdout === 'string' && a.stdout.includes('additionalContext')) c.sessionStartPlugin = plugin;
        }
        return;
      }
      case 'hook_additional_context': {
        const txt = Array.isArray(a.content) ? a.content.join('\n') : String(a.content ?? '');
        let plugin: string | null = null;
        if (a.hookName === 'SessionStart' || a.hookEvent === 'SessionStart') plugin = c.sessionStartPlugin ?? detectPlugin([txt], this.opts.knownPlugins);
        const label = plugin ? hookPluginKey(plugin) : hookEventKey(String(a.hookName ?? a.hookEvent ?? ''));
        this.addStartup(label, rendered || txt.length);
        return;
      }
      case 'skill_listing': {
        this.addStartup(LABELS.skills, size);
        if (!c.startupDone && typeof a.content === 'string') {
          // '- plugin:skill: description' or '- skill: description'; a wrapped line belongs to the entry above it,
          // lines before the first entry (a header) count as own skills, as before.
          const byName = (s.skillsByName ??= {});
          let plugin = OWN_SKILLS;
          let name: string | null = null;
          for (const ln of a.content.split('\n')) {
            const m = /^- ([^:\s]+)(?::([^:\s]+))?:/.exec(ln);
            if (m) {
              plugin = m[2] ? m[1] : OWN_SKILLS;
              name = m[2] ? `${m[1]}:${m[2]}` : m[1];
            }
            const n = ln.length + 1;
            s.skillsByPlugin[plugin] = (s.skillsByPlugin[plugin] ?? 0) + n;
            if (name) byName[name] = (byName[name] ?? 0) + n;
          }
        }
        return;
      }
      case 'mcp_instructions_delta': {
        this.addStartup(LABELS.mcp, size);
        const names: string[] = Array.isArray(a.addedNames) ? a.addedNames : [];
        const blocks: string[] = Array.isArray(a.addedBlocks) ? a.addedBlocks : [];
        names.forEach((n, i) => {
          const k = mcpKey(String(n));
          if (!s.mcpSeen.includes(k)) s.mcpSeen.push(k);
          if (!c.startupDone) s.mcpBlocks[String(n)] = (s.mcpBlocks[String(n)] ?? 0) + (typeof blocks[i] === 'string' ? blocks[i].length : 0);
        });
        return;
      }
      case 'deferred_tools_record':
      case 'deferred_tools_delta': {
        this.addStartup(LABELS.deferred, size);
        const names: string[] = Array.isArray(a.addedNames) ? a.addedNames
          : Array.isArray(a.entries) ? a.entries.map((e: any) => e?.name).filter(Boolean) : [];
        // With tool search on, deferred MCP tools are listed by name (a line each); their schemas load when used.
        const lines: string[] = Array.isArray(a.addedLines) ? a.addedLines.filter((x: unknown) => typeof x === 'string') : [];
        for (const n of names) {
          const m = mcpSplit(String(n));
          if (!m) continue;
          if (!s.mcpSeen.includes(m.server)) s.mcpSeen.push(m.server);
          if (!c.startupDone) {
            const ln = lines.find((l) => l === n || l.startsWith(`${n}:`) || l.startsWith(`${n} `));
            const per = (s.mcpToolNames ??= {});
            per[m.server] = (per[m.server] ?? 0) + (ln ?? String(n)).length + 1;
          }
        }
        this.mcpIssues(a, ts);
        return;
      }
      case 'agent_listing_delta': this.addStartup(LABELS.agents, size); return;
      case 'instructions':
      case 'nested_memory': {
        this.addStartup(LABELS.claudeMd, size);
        if (c.startupDone) return;
        // 'instructions': { files: [{ path, type, content }] }; 'nested_memory': { path, content: { path, type, content } }.
        const files: any[] = a.type === 'instructions' ? (Array.isArray(a.files) ? a.files : []) : [a.content && typeof a.content === 'object' ? { path: a.path, ...a.content } : a];
        for (const f of files) {
          if (!f || typeof f !== 'object' || typeof f.path !== 'string' || typeof f.content !== 'string' || !f.content) continue;
          const mf = (s.memoryFiles ??= {});
          // A refresh before the first reply repeats the file: keep its largest size, not the sum.
          mf[f.path] = { type: String(f.type ?? f.kind ?? ''), chars: Math.max(mf[f.path]?.chars ?? 0, f.content.length) };
        }
        return;
      }
      case 'prompt_snapshot': {
        // There can be several snapshots (the first is partial); keep the largest system prompt size.
        const sp = Array.isArray(a.systemPrompt) ? a.systemPrompt : [];
        const chars = sp.reduce((n: number, x: unknown) => n + (typeof x === 'string' ? x.length : 0), 0) || lineLen;
        if (chars > (s.startup[LABELS.system] ?? 0)) s.startup[LABELS.system] = chars;
        // Newer versions also put built-in tool definitions into the snapshot.
        if (Array.isArray(a.tools) && a.tools.length) {
          const tc = JSON.stringify(a.tools).length;
          if (tc > (s.startup[LABELS.toolDefs] ?? 0)) s.startup[LABELS.toolDefs] = tc;
          // MCP tools that are not deferred come with their full definitions: chars per server (largest snapshot).
          if (!c.startupDone) {
            const per: Record<string, number> = {};
            for (const t of a.tools) {
              const m = t && typeof t.name === 'string' ? mcpSplit(t.name) : null;
              if (m) per[m.server] = (per[m.server] ?? 0) + JSON.stringify(t).length;
            }
            const defs = (s.mcpToolDefs ??= {});
            for (const [k, n] of Object.entries(per)) if (n > (defs[k] ?? 0)) defs[k] = n;
          }
        }
        return;
      }
      default:
        if (ENV_TYPES.has(a.type)) this.addStartup(LABELS.env, rendered);
        else if (rendered) this.addStartup(LABELS.other, rendered);
    }
  }

  /** `failedMcpServers` ({ name, error?, errorCode? }) and `needsAuthMcpServers` (names) of a deferred tools attachment. */
  private mcpIssues(a: any, ts: number) {
    const failed: any[] = Array.isArray(a.failedMcpServers) ? a.failedMcpServers : [];
    const auth: unknown[] = Array.isArray(a.needsAuthMcpServers) ? a.needsAuthMcpServers : [];
    if (!failed.length && !auth.length) return;
    const issues = (this.s.mcpIssues ??= {});
    const at = (name: string) => (issues[name] ??= { failed: 0, auth: 0, last: 0 });
    for (const f of failed) {
      const name = typeof f === 'string' ? f : typeof f?.name === 'string' ? f.name : null;
      if (!name) continue;
      const it = at(name);
      it.failed++; it.last = Math.max(it.last, ts);
      const err = typeof f?.error === 'string' ? f.error : typeof f?.errorCode === 'string' ? f.errorCode : null;
      if (err) it.error = trimText(err, 80);
    }
    for (const n of auth) {
      if (typeof n !== 'string' || !n) continue;
      const it = at(n);
      it.auth++; it.last = Math.max(it.last, ts);
    }
  }

  /** Trims per-minute buckets to the last hour of activity. */
  finish() {
    const s = this.s;
    const minKeep = Math.floor(s.lastTs / 60_000) - 60;
    for (const k of Object.keys(s.minutes)) if (Number(k) < minKeep) delete s.minutes[k];
  }
}

export interface ScanResult { summary: FileSummary; changed: boolean; resumed: boolean; bytes: number }

/**
 * Scans a file: returns the previous summary unchanged, reads the new tail, or parses from scratch.
 */
export async function scanFile(
  projectsDir: string, file: string, prev: FileSummary | null, opts: ScanOptions, onEvent?: (e: ScanEvent) => void,
): Promise<ScanResult | null> {
  let st: fs.Stats;
  try { st = fs.statSync(file); } catch { return null; }
  const id = identify(projectsDir, file);
  if (!id) return null;
  const meta = id.agentId ? readMeta(file) : null;
  if (prev && prev.v === SUMMARY_VERSION && prev.size === st.size && prev.mtimeMs === st.mtimeMs) {
    const metaChanged = JSON.stringify(prev.meta) !== JSON.stringify(meta);
    if (metaChanged) prev.meta = meta;
    return { summary: prev, changed: metaChanged, resumed: false, bytes: 0 };
  }
  let s: FileSummary;
  let resumed = false;
  if (prev && prev.v === SUMMARY_VERSION && st.size >= prev.offset) {
    s = structuredClone(prev);
    resumed = true;
  } else {
    s = newSummary(file, id);
  }
  s.meta = meta;
  const start = s.offset;
  const sc = new FileScanner(s, opts, onEvent);
  s.offset = await readLines(file, start, sc);
  sc.finish();
  s.size = st.size;
  s.mtimeMs = st.mtimeMs;
  return { summary: s, changed: true, resumed, bytes: s.offset - start };
}

/** Parses from a string (for tests). */
export function scanText(file: string, id: { sessionId: string; agentId: string | null; projectDir: string }, text: string, opts: ScanOptions, prev?: FileSummary): FileSummary {
  const s = prev ? structuredClone(prev) : newSummary(file, id);
  const sc = new FileScanner(s, opts);
  for (const ln of text.split('\n')) {
    if (!ln) continue;
    const b = Buffer.from(ln);
    const k = classifyPrefix(b);
    if (k) sc.skipped(k, b.length); else sc.line(b);
  }
  sc.finish();
  return s;
}
