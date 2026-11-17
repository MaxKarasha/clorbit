// Galaxy demo mode (explicit only: ?demo=1 / ?mock=1 or "Try the demo"): invented sessions that live and emit events.
// Prose (task descriptions, latest thoughts, titles, status reasons) is stored as dictionary keys and
// translated on every snapshot/event, so switching the UI language updates the demo within one tick.
import type { AgentNode, ClorbitEvent, LiveSession, LiveSnapshot, Tokens } from '@shared/api';
import { t } from '../i18n';
import type enMock from '../i18n/en/mock';
import { rng } from '../mock/rng';

type MK = keyof typeof enMock;

const TYPES = ['Explore', 'Plan', 'general-purpose', 'code-reviewer', 'test-runner', 'web-fetch'];
const TOOLS = [
  'Read webhook.ts', 'Grep "useAuth"', 'Glob **/*.tsx', 'Edit orders.ts', 'Bash: pnpm test', 'WebFetch hono.dev/docs',
  'WebSearch', 'Read README.md', 'Bash: git diff --stat', 'Write PLAN.md', 'Grep "rateLimit"', 'Edit rate-limit.ts',
  'Bash: pnpm lint', 'claude-in-chrome · screenshot', 'context7 · get-library-docs',
];
const TASKS: Record<string, MK[]> = {
  Explore: ['mock.task.explore.1', 'mock.task.explore.2'],
  Plan: ['mock.task.plan.1', 'mock.task.plan.2'],
  'code-reviewer': ['mock.task.review.1', 'mock.task.review.2'],
  'test-runner': ['mock.task.test.1', 'mock.task.test.2'],
  'general-purpose': ['mock.task.general.1', 'mock.task.general.2', 'mock.task.sql.1'],
  'web-fetch': ['mock.task.web.1', 'mock.task.web.2'],
};
const THOUGHTS: MK[] = ['mock.thought.1', 'mock.thought.2', 'mock.thought.3', 'mock.thought.4', 'mock.thought.5', 'mock.thought.6', 'mock.thought.7'];
const EFFORTS = ['high', 'medium', 'high', 'xhigh', 'low'];
const tok = (n: number): Tokens => ({ input: n * 0.02, output: n * 0.05, cacheRead: n * 0.85, cacheWrite: n * 0.08 });
const sum = (x: Tokens) => x.input + x.output + x.cacheRead + x.cacheWrite;
const tr = (k: string | null) => (k ? t(k as MK) : null);

type Wait = 'permission' | 'you';
interface MS { s: LiveSession; next: number; titleKey: MK; wait: Wait | null; lastByMain: boolean }

interface Def {
  project: string;
  branch: string;
  title: MK;
  status: LiveSession['status'];
  alive: boolean;
  finished: number;
  model?: string;
  wait?: Wait;
  rootTool?: string;
  rootText?: MK;
  kids?: (r: AgentNode) => void;
}

export class MockFeed {
  private list: MS[] = [];
  private timer = 0;
  private uid = 0;
  // Seeded, so the initial fleet looks the same on every visit (handy for screenshots).
  private r = rng('clorbit-galaxy-demo');
  private burn: number[] = Array.from({ length: 30 }, () => 1500 + this.r.next() * 2500);

  constructor(private onSnap: (s: LiveSnapshot) => void, private onEvent: (e: ClorbitEvent) => void) {
    const n = (type: string, depth: number, extra: Partial<AgentNode> = {}) => this.node(type, depth, extra);
    const defs: Def[] = [
      {
        project: 'aurora-web', branch: 'feat/server-components', title: 'mock.title.aurora.1', status: 'working', alive: true,
        finished: 120, model: 'claude-opus-5-5[1m]',
        kids: (r) => {
          const p = n('Plan', 1); p.children.push(n('Explore', 2), n('Explore', 2));
          const g = n('general-purpose', 2); g.children.push(n('web-fetch', 3)); p.children.push(g);
          r.children.push(p, n('code-reviewer', 1));
        },
      },
      {
        project: 'billing-service', branch: 'feat/webhook-rate-limit', title: 'mock.title.billing.1', status: 'working', alive: true,
        finished: 44, rootText: 'mock.thought.7',
        kids: (r) => { const x = n('test-runner', 1); x.children.push(n('Explore', 2)); r.children.push(x, n('code-reviewer', 1)); },
      },
      {
        project: 'mobile-api', branch: 'fix/orders-pagination', title: 'mock.title.mobile.1', status: 'waiting', alive: true,
        finished: 18, wait: 'permission', rootTool: 'Bash: pnpm db:migrate', rootText: 'mock.thought.10',
      },
      {
        project: 'docs-site', branch: 'docs/rest-api', title: 'mock.title.docs.1', status: 'idle', alive: true,
        finished: 9, rootTool: 'Bash: pnpm build', rootText: 'mock.thought.8',
      },
      {
        project: 'data-pipeline', branch: 'perf/parquet-export', title: 'mock.title.data.2', status: 'working', alive: true,
        finished: 26,
        kids: (r) => { const g = n('general-purpose', 1); g.children.push(n('web-fetch', 2), n('web-fetch', 2)); r.children.push(g); },
      },
      {
        project: 'cli-tools', branch: 'feat/status-json', title: 'mock.title.cli.1', status: 'waiting', alive: true,
        finished: 3, wait: 'you', model: 'claude-sonnet-4-6', rootTool: 'Read src/commands/status.ts', rootText: 'mock.thought.9',
      },
      { project: 'infra-k8s', branch: 'chore/hpa-tuning', title: 'mock.title.infra.1', status: 'stopped', alive: false, finished: 61 },
      { project: 'design-system', branch: 'feat/combobox', title: 'mock.title.design.1', status: 'stopped', alive: false, finished: 140 },
    ];
    for (const d of defs) this.add(d);
    this.list.forEach((m) => this.recount(m.s));
    this.emit();
    this.timer = window.setInterval(() => this.tick(), 450);
  }
  stop() { clearInterval(this.timer); }

  /** Creates an agent node; `description` and `lastText` hold dictionary keys until emit(). */
  private node(type: string, depth: number, extra: Partial<AgentNode> = {}): AgentNode {
    const r = this.r;
    const now = Date.now();
    return {
      id: depth === 0 ? 'main' : `a${(++this.uid).toString(16)}${r.id(6)}`,
      type, description: depth ? (TASKS[type] ? r.pick(TASKS[type]) : null) : null, depth, status: 'working',
      model: depth === 0 ? 'claude-opus-5-5' : r.pick(['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-5-5']),
      effort: r.pick(EFFORTS), currentTool: r.pick(TOOLS), lastText: r.pick(THOUGHTS),
      startedAt: now - r.next() * 600000, lastActivity: now, tokens: tok(20000 + r.next() * 400000),
      toolCalls: Math.floor(r.next() * 40), finishedChildren: Math.floor(r.next() * 4), children: [], ...extra,
    };
  }

  private add(d: Def) {
    const r = this.r;
    const root = this.node('main', 0, { status: d.status === 'stopped' ? 'idle' : (d.status as AgentNode['status']) });
    if (d.model) root.model = d.model;
    if (d.rootTool) root.currentTool = d.rootTool;
    if (d.rootText) root.lastText = d.rootText;
    d.kids?.(root);
    const now = Date.now();
    const s: LiveSession = {
      sessionId: `${r.id(8)}-${r.id(4)}-${r.id(4)}-${r.id(4)}-${r.id(12)}`, pid: d.alive ? 41000 + r.int(0, 8000) : null, alive: d.alive,
      title: null, name: null, cwd: `/home/dev/code/${d.project}`, project: d.project, gitBranch: d.branch,
      model: root.model, effort: root.effort, permissionMode: d.status === 'waiting' && d.wait === 'permission' ? 'default' : 'acceptEdits', status: d.status,
      statusSince: now - (d.status === 'stopped' ? 3 * 3600e3 : 20000 + r.next() * 120000), statusReason: null,
      startedAt: now - (1 + r.next() * 4) * 3600e3, lastActivity: d.status === 'stopped' ? now - 3 * 3600e3 : now,
      tokens: tok(2e6 + r.next() * 8e6), tokens24h: 0,
      contextTokens: 40000 + r.next() * 120000, contextLimit: root.model?.includes('[1m]') ? 1_000_000 : 200_000,
      subagentsTotal: 0, subagentsActive: 0, compactions: Math.floor(r.next() * 3), root,
    };
    s.tokens24h = sum(s.tokens);
    s.subagentsTotal = d.finished;
    this.list.push({ s, next: 0, titleKey: d.title, wait: d.wait ?? null, lastByMain: true });
  }

  private walk(n: AgentNode, out: AgentNode[] = []) { out.push(n); n.children.forEach((c) => this.walk(c, out)); return out; }
  private parentOf(root: AgentNode, id: string): AgentNode | null {
    for (const n of this.walk(root)) if (n.children.some((c) => c.id === id)) return n;
    return null;
  }
  private recount(s: LiveSession) {
    const active = this.walk(s.root).length - 1;
    s.subagentsActive = active;
    s.subagentsTotal += active;
  }

  private tick() {
    const r = this.r;
    const now = Date.now();
    for (const m of this.list) {
      const s = m.s;
      if (s.status !== 'working' || now < m.next) continue;
      m.next = now + 500 + r.next() * 1200;
      const all = this.walk(s.root);
      const subs = all.filter((a) => a.depth > 0);
      const roll = r.next();
      if ((roll < 0.2 || subs.length < 2) && subs.length < 8) {
        const cand = all.filter((a) => a.depth < 3 && a.children.length < 3);
        if (cand.length) {
          const par = r.pick(cand);
          const c = this.node(r.pick(TYPES), par.depth + 1, { finishedChildren: 0, startedAt: now, toolCalls: 0 });
          par.children.push(c);
          s.subagentsTotal++; s.subagentsActive++;
          this.onEvent({ kind: 'spawn', ts: now, sessionId: s.sessionId, parentId: par.id, agentId: c.id, agentType: c.type, description: tr(c.description) });
          continue;
        }
      }
      if (roll < 0.34) {
        const leaves = subs.filter((a) => !a.children.length && now - a.startedAt > 8000);
        if (leaves.length) {
          const a = r.pick(leaves);
          const p = this.parentOf(s.root, a.id)!;
          p.children = p.children.filter((c) => c.id !== a.id);
          p.finishedChildren++;
          s.subagentsActive--;
          this.onEvent({ kind: 'finish', ts: now, sessionId: s.sessionId, agentId: a.id, parentId: p.id, tokens: sum(a.tokens) });
          continue;
        }
      }
      const a = r.pick(all);
      a.currentTool = r.pick(TOOLS);
      a.toolCalls++;
      a.lastActivity = now;
      m.lastByMain = a.depth === 0;
      if (r.next() < 0.5) a.lastText = r.pick(THOUGHTS);
      const add = 2000 + r.next() * 30000;
      a.tokens.cacheRead += add; s.tokens.cacheRead += add; s.tokens24h += add;
      s.lastActivity = now;
      this.burn[this.burn.length - 1] += add / 60;
      this.onEvent({ kind: 'tool', ts: now, sessionId: s.sessionId, agentId: a.id, tool: a.currentTool.split(/[ :]/)[0], label: a.currentTool });
    }
    if (r.next() < 0.05) { this.burn.shift(); this.burn.push(1500 + r.next() * 2500); }
    this.emit();
  }

  /** Status reason in the current language, worded like the server's. */
  private reason(m: MS): string | null {
    const s = m.s;
    switch (s.status) {
      case 'working':
        if (!m.lastByMain && s.subagentsActive > 0) return t('mock.reason.subagents', { n: s.subagentsActive });
        return s.root.currentTool ? t('mock.reason.running', { a: s.root.currentTool }) : null;
      case 'waiting':
        return m.wait === 'permission' ? t('mock.reason.permission', { a: 'Bash' }) : t('mock.reason.waitingYou');
      case 'idle':
        return t('mock.reason.answerReady');
      default:
        return null;
    }
  }

  /** Translates the dictionary keys held by a cloned tree. */
  private localize(n: AgentNode) {
    n.description = tr(n.description);
    n.lastText = tr(n.lastText);
    n.children.forEach((c) => this.localize(c));
  }

  private emit() {
    const sessions = this.list.map((m) => {
      const s = structuredClone(m.s);
      s.title = t(m.titleKey);
      s.statusReason = this.reason(m);
      this.localize(s.root);
      return s;
    });
    const t24: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    sessions.forEach((s) => { t24.input += s.tokens.input; t24.output += s.tokens.output; t24.cacheRead += s.tokens.cacheRead; t24.cacheWrite += s.tokens.cacheWrite; });
    const all = sessions.flatMap((s) => this.walk(s.root));
    this.onSnap({
      now: Date.now(), sessions,
      totals: {
        tokens24h: t24, tokensToday: { ...t24, cacheRead: t24.cacheRead * 0.7 },
        burnPerMin: this.burn.slice(-10).reduce((a, b) => a + b, 0) / 10, burnSeries: [...this.burn],
        activeSessions: sessions.filter((s) => s.alive).length, workingSessions: sessions.filter((s) => s.status === 'working').length,
        waitingSessions: sessions.filter((s) => s.status === 'waiting').length,
        workingSubagents: all.filter((a) => a.depth > 0 && a.status === 'working').length,
        finishedSubagents24h: sessions.reduce((a, s) => a + s.subagentsTotal - s.subagentsActive, 0),
        cacheHitRate24h: t24.cacheRead / (t24.input + t24.cacheRead + t24.cacheWrite), projects24h: sessions.length,
      },
      limits: { fiveHourPct: 37, fiveHourResetsAt: Date.now() + 2.4 * 3600e3, sevenDayPct: 61, sevenDayResetsAt: Date.now() + 3.2 * 86400e3, updatedAt: Date.now() },
      hooksInstalled: false, statuslineCapture: true, scan: { done: true, filesTotal: 1, filesDone: 1 },
    });
  }
}
