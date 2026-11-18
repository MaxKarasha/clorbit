// Demo replay (?demo=1): a believable 25–40 minute Claude Code run for any demo session id, seeded by the id, so
// the same session always replays the same way. Waves of nested subagents, a permission wait, a long idle gap
// while "the user is away", a compaction, and the final answer. Prose follows the UI language.
import type { ReplayEvent, SessionReplay, SessionStatus } from '@shared/api';
import { normalizeReplayEvents } from '@shared/replay';
import { t, type MsgKey } from '../i18n';
import { TASKS, THOUGHTS, TOOLS } from '../galaxy/mock';
import { demoSessions } from './demo-sessions';
import { mockSessions } from './fixtures';
import { rng } from './rng';

const SEC = 1000;
const MIN = 60_000;
const DEMO_PROJECTS = ['aurora-web', 'billing-service', 'mobile-api', 'docs-site', 'data-pipeline'];
const MAIN_TOOLS = ['Read webhook.ts', 'Grep "rateLimit"', 'Glob **/*.tsx', 'Read README.md', 'Bash: git diff --stat', 'Edit rate-limit.ts', 'Edit orders.ts', 'Bash: pnpm test', 'Bash: pnpm lint', 'Write PLAN.md'];

function metaOf(id: string): { project: string; title: string | null; model: string | null; effort: string | null; start: number | null; alive: boolean } {
  const g = demoSessions.get(id);
  if (g) return { project: g.project, title: g.title(), model: g.model, effort: g.effort, start: null, alive: g.alive };
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 89);
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const s = mockSessions({ from: key(from), to: key(d) }).find((x) => x.sessionId === id);
  if (s) return { project: s.project, title: s.title, model: s.model, effort: s.effort, start: s.startedAt, alive: false };
  const r = rng(`replay-meta:${id}`);
  return { project: r.pick(DEMO_PROJECTS), title: t('mock.prompt.1'), model: 'claude-opus-5-5', effort: 'high', start: null, alive: false };
}

export function mockReplay(id: string): SessionReplay {
  const r = rng(`replay:${id}`);
  const meta = metaOf(id);
  const limit = meta.model?.includes('[1m]') ? 1_000_000 : 200_000;
  const ev: ReplayEvent[] = [];
  let uid = 0;
  let ctx = 34_000 + r.next() * 8000;
  const grow = limit / 200_000;

  // The run is laid out from t = 0 and shifted to its real start at the end.
  const status = (ts: number, st: SessionStatus, code: string | null, arg: string | null = null) => {
    const reason = code === 'gotPrompt' ? null : code === 'answerReady' ? t('mock.reason.answerReady') : code === 'waitingPermission' ? t('mock.reason.permission', { a: arg ?? 'Bash' }) : null;
    ev.push({ kind: 'status', ts, status: st, reason, code, arg });
  };
  const mainTurn = (ts: number, label: string | null, text?: MsgKey) => {
    const add = (2000 + r.next() * 5000) * grow;
    ctx += add;
    const input = Math.round(200 + r.next() * 900);
    const write = Math.round(add);
    const read = Math.round(ctx - input - write);
    ev.push({ kind: 'tokens', ts, agentId: 'main', t: [input, Math.round(150 + r.next() * 1400), read, write], context: input + read + write });
    if (label) ev.push({ kind: 'tool', ts, agentId: 'main', label });
    if (text) ev.push({ kind: 'text', ts, agentId: 'main', text: t(text) });
  };
  /** A subagent: works for `dur`, may spawn children of its own; returns when it finished. */
  const agent = (parent: string, type: string, from: number, dur: number, depth: number, kids: (id: string, at: (f: number) => number) => number[] = () => []): number => {
    const id = `a${(++uid).toString(16)}${Math.floor(r.next() * 0xffffff).toString(16)}`;
    const pool = TASKS[type] ?? TASKS['general-purpose'];
    ev.push({ kind: 'spawn', ts: from, agentId: id, parentId: parent, agentType: type, description: t(r.pick(pool)), model: r.pick(['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-5-5']), effort: r.pick(['medium', 'high']) });
    let sub = 8000 + r.next() * 6000;
    let tot = 0;
    for (let ts = from + 2 * SEC + r.next() * 3 * SEC; ts < from + dur; ts += (4 + r.next() * (depth > 1 ? 10 : 18)) * SEC) {
      sub += 1500 + r.next() * 3500;
      const tk: [number, number, number, number] = [Math.round(100 + r.next() * 400), Math.round(100 + r.next() * 700), Math.round(sub * 0.85), Math.round(sub * 0.12)];
      tot += tk[0] + tk[1] + tk[2] + tk[3];
      ev.push({ kind: 'tokens', ts, agentId: id, t: tk });
      ev.push({ kind: 'tool', ts, agentId: id, label: r.pick(TOOLS) });
      if (r.next() < 0.18) ev.push({ kind: 'text', ts, agentId: id, text: t(r.pick(THOUGHTS)) });
    }
    const ends = kids(id, (f) => from + dur * f);
    // A parent usually waits for its children; now and then it returns first (they report to the manager).
    const end = Math.max(from + dur, ...ends.map((e) => (r.next() < 0.8 ? e + 3 * SEC + r.next() * 8 * SEC : 0)));
    ev.push({ kind: 'finish', ts: end, agentId: id, tokens: tot });
    return end;
  };

  let now = 0;
  const mainWork = (n: number, gap: [number, number]) => {
    for (let i = 0; i < n; i++) { now += (gap[0] + r.next() * (gap[1] - gap[0])) * SEC; mainTurn(now, r.pick(MAIN_TOOLS), r.next() < 0.25 ? r.pick(THOUGHTS) : undefined); }
  };

  // 1. The task, a first look around.
  ev.push({ kind: 'prompt', ts: now, text: meta.title ?? t('mock.prompt.1') });
  status(now, 'working', 'gotPrompt');
  mainWork(r.int(4, 7), [3, 10]);

  // 2. Exploration wave: parallel Explore agents, one with a web-fetch moon.
  now += 3 * SEC;
  const wave1: number[] = [];
  const n1 = r.int(2, 4);
  for (let i = 0; i < n1; i++) {
    const at = now + i * (1 + r.next() * 2) * SEC;
    wave1.push(agent('main', i === 0 ? 'Explore' : r.pick(['Explore', 'Explore', 'general-purpose']), at, (100 + r.next() * 160) * SEC, 1, i === 0 ? (id, at2) => [agent(id, 'web-fetch', at2(0.35), (40 + r.next() * 40) * SEC, 2)] : undefined));
    mainTurn(at, null);
  }
  mainWork(r.int(2, 4), [15, 40]);
  now = Math.max(now, ...wave1) + 4 * SEC;
  mainWork(r.int(3, 5), [4, 12]);
  mainTurn((now += 6 * SEC), 'Write PLAN.md', 'mock.thought.5');
  status(now, 'idle', 'answerReady');

  // 3. The user is away for a while (an idle gap auto mode squeezes), then asks for the implementation.
  now += (3 + r.next() * 5) * MIN;
  ev.push({ kind: 'prompt', ts: now, text: t('mock.prompt.2') });
  status(now, 'working', 'gotPrompt');
  mainWork(2, [3, 8]);

  // 4. Plan → two general-purpose workers, one with a test-runner moon (depth 3).
  now += 4 * SEC;
  const planEnd = agent('main', 'Plan', now, (150 + r.next() * 90) * SEC, 1, (id, at) => [
    agent(id, 'general-purpose', at(0.2), (120 + r.next() * 80) * SEC, 2, (id2, at2) => [agent(id2, 'test-runner', at2(0.5), (50 + r.next() * 40) * SEC, 3)]),
    agent(id, 'general-purpose', at(0.3), (90 + r.next() * 120) * SEC, 2),
  ]);
  mainWork(r.int(3, 6), [20, 45]);
  now = Math.max(now, planEnd) + 5 * SEC;

  // 5. A command that needs permission: the session waits for the user.
  mainTurn((now += 3 * SEC), 'Bash: pnpm db:migrate', 'mock.thought.10');
  const wait = (25 + r.next() * 45) * SEC;
  status(now, 'waiting', 'waitingPermission', 'Bash');
  now += wait;
  status(now, 'working', 'working');
  mainWork(r.int(4, 7), [4, 12]);

  // 6. The context is nearly full: an automatic compaction.
  while (ctx < limit * 0.8 && limit <= 200_000) mainWork(1, [3, 7]);
  now += 2 * SEC;
  ev.push({ kind: 'compact', ts: now, auto: true, preTokens: Math.round(ctx) });
  ctx = 38_000 + r.next() * 9000;
  mainWork(2, [5, 10]);

  // 7. Review and tests in parallel, then the answer.
  now += 3 * SEC;
  const rv = agent('main', 'code-reviewer', now, (90 + r.next() * 70) * SEC, 1);
  const tr = agent('main', 'test-runner', now + 2 * SEC, (110 + r.next() * 90) * SEC, 1, (id, at) => (r.next() < 0.6 ? [agent(id, 'Explore', at(0.4), 40 * SEC, 2)] : []));
  mainWork(r.int(2, 4), [20, 40]);
  now = Math.max(now, rv, tr) + 4 * SEC;
  mainWork(r.int(2, 3), [3, 8]);
  mainTurn((now += 5 * SEC), null, 'mock.thought.8');
  status(now, 'idle', 'answerReady');

  // Real time: a galaxy star (live) ends a minute ago; a sessions-page row starts where it started.
  // Stretched or squeezed into 24–38 minutes.
  const k = Math.min(38 * MIN, Math.max(24 * MIN, now)) / now;
  const end0 = now * k;
  const start = Math.round(meta.start ?? (meta.alive ? Date.now() - end0 - MIN : Date.now() - end0 - (1 + r.next() * 5) * 3_600_000));
  const shifted = ev.map((e) => ({ ...e, ts: start + Math.round(e.ts * k) }));
  const events = normalizeReplayEvents(shifted);
  return {
    sessionId: id, project: meta.project, cwd: `/home/dev/code/${meta.project}`, title: meta.title, model: meta.model, effort: meta.effort,
    contextLimit: limit, startedAt: start, endedAt: events[events.length - 1].ts, live: false, generatedAt: Date.now(), events,
  };
}
