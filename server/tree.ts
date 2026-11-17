// A session's agent tree and the live-status heuristics.
import type { AgentNode, AgentStatus, SessionStatus } from '../shared/api.ts';
import type { Reason } from './i18n';
import type { FileSummary } from './types';
import { toTokens } from './util';

export const WORKING_MS = 20_000;     // a fresh record means working
export const WAIT_MS = 10_000;        // a tool_use without a result for longer than this is probably waiting
export const SUB_QUIET_MS = 10 * 60_000;  // a subagent with no records and no pending calls has finished
export const SUB_STALE_MS = 30 * 60_000;  // a subagent silent for this long is surely not working

function pendingList(s: FileSummary) {
  return Object.entries(s.carry.pending).map(([id, p]) => ({ id, ...p }));
}

/** Has the subagent finished? */
export function subagentDone(s: FileSummary, now: number, sessionAlive: boolean): boolean {
  if (s.meta?.finished === true) return true;
  if (!sessionAlive) return true;
  const pend = pendingList(s);
  if (s.carry.lastStop === 'end_turn' && pend.length === 0) return true;
  const quiet = now - s.lastTs;
  if (quiet > SUB_STALE_MS) return true;
  if (quiet > SUB_QUIET_MS && pend.length === 0) return true;
  return false;
}

/** Status of a single (unfinished) agent. */
export function agentStatus(s: FileSummary, now: number): AgentStatus {
  const pend = pendingList(s).filter((p) => p.name !== 'Agent' && p.name !== 'Task');
  const quiet = now - s.lastTs;
  if (pend.length && quiet > WAIT_MS && pend.some((p) => now - p.ts > WAIT_MS)) return 'waiting';
  if (quiet < WORKING_MS) return 'working';
  if (pendingList(s).length) return 'working';
  if (s.carry.lastStop === 'tool_use') return 'working';
  return 'idle';
}

export interface TreeResult { root: AgentNode; total: number; active: number; working: number; finished: { s: FileSummary; parentId: string }[] }

/** Builds the tree. includeDone=false keeps only active children (the live view). */
export function buildTree(main: FileSummary | null, subs: FileSummary[], now: number, sessionAlive: boolean, includeDone: boolean): TreeResult {
  const owner = new Map<string, string>();
  const spawnInfo = new Map<string, { type: string; desc: string | null }>();
  if (main) for (const [id, sp] of Object.entries(main.spawns)) { owner.set(id, 'main'); spawnInfo.set(id, sp); }
  for (const s of subs) for (const [id, sp] of Object.entries(s.spawns)) { owner.set(id, s.agentId!); spawnInfo.set(id, sp); }

  const mkNode = (s: FileSummary | null, id: string, depth: number, status: AgentStatus): AgentNode => ({
    id,
    type: id === 'main' ? 'main' : (s?.meta?.agentType ?? (s?.meta?.toolUseId ? spawnInfo.get(s.meta.toolUseId)?.type : undefined) ?? 'general-purpose'),
    description: id === 'main' ? null : (s?.meta?.description ?? (s?.meta?.toolUseId ? spawnInfo.get(s.meta.toolUseId)?.desc ?? null : null)),
    depth,
    status,
    model: s?.model ?? null,
    effort: s?.effort ?? null,
    currentTool: s?.carry.lastTool ?? null,
    lastText: s?.carry.lastText ?? null,
    startedAt: s?.firstTs ?? now,
    lastActivity: s?.lastTs ?? now,
    tokens: toTokens(s?.total ?? [0, 0, 0, 0]),
    toolCalls: s?.toolCalls ?? 0,
    finishedChildren: 0,
    children: [],
  });

  const rootStatus: AgentStatus = !main ? 'idle' : !sessionAlive ? 'done' : agentStatus(main, now);
  const root = mkNode(main, 'main', 0, rootStatus);
  const nodes = new Map<string, { node: AgentNode; parent: string; done: boolean }>();
  const finished: TreeResult['finished'] = [];
  let active = 0;
  let working = 0;
  for (const s of subs) {
    const done = subagentDone(s, now, sessionAlive);
    const st: AgentStatus = done ? 'done' : agentStatus(s, now);
    const parent = s.meta?.toolUseId ? owner.get(s.meta.toolUseId) ?? 'main' : 'main';
    const depth = s.meta?.spawnDepth ?? 1;
    nodes.set(s.agentId!, { node: mkNode(s, s.agentId!, depth, st), parent, done });
    if (done) finished.push({ s, parentId: parent });
    else { active++; if (st === 'working' || st === 'waiting') working++; }
  }
  // Visible: an active node, or a node with an active descendant.
  const visible = new Set<string>();
  for (const [id, n] of nodes) {
    if (includeDone || !n.done) {
      let cur: string | undefined = id;
      let guard = 0;
      while (cur && cur !== 'main' && !visible.has(cur) && guard++ < 10) { visible.add(cur); cur = nodes.get(cur)?.parent; }
    }
  }
  const byId = (id: string) => (id === 'main' ? root : nodes.get(id)?.node);
  for (const [id, n] of nodes) {
    const p = byId(n.parent) ?? root;
    if (n.done) p.finishedChildren++;
    if (visible.has(id)) p.children.push(n.node);
  }
  const sortRec = (n: AgentNode) => { n.children.sort((a, b) => a.startedAt - b.startedAt); n.children.forEach(sortRec); };
  sortRec(root);
  return { root, total: subs.length, active, working, finished };
}

/** Session status without hooks (heuristic) plus a language-neutral reason. */
export function sessionStatus(
  main: FileSummary | null, subs: FileSummary[], tree: TreeResult, now: number, alive: boolean, pidStatus: string | null,
): { status: SessionStatus; reason: Reason | null } {
  if (!alive) return { status: 'stopped', reason: { k: 'processEnded' } };
  if (!main) return { status: 'idle', reason: { k: 'justStarted' } };
  const lastAct = Math.max(main.lastTs, ...subs.map((s) => s.lastTs));
  const pend = Object.values(main.carry.pending).filter((p) => p.name !== 'Agent' && p.name !== 'Task');
  const oldest = pend.reduce((m, p) => Math.min(m, p.ts), Infinity);
  // In bypassPermissions mode nothing asks for permission, so a long call is just working.
  const asks = main.permissionMode !== 'bypassPermissions';
  if (asks && pend.length && now - oldest > WAIT_MS && now - lastAct > WAIT_MS) {
    const p = pend.find((x) => x.ts === oldest)!;
    return { status: 'waiting', reason: { k: 'probablyPermission', a: p.name } };
  }
  if (pidStatus && /wait|permission|input/i.test(pidStatus)) return { status: 'waiting', reason: { k: 'waitingYou' } };
  if (now - main.lastTs < WORKING_MS) return { status: 'working', reason: main.carry.lastTool && pend.length ? { k: 'running', a: main.carry.lastTool } : { k: 'working' } };
  if (tree.working > 0) return { status: 'working', reason: { k: 'subagentsWorking', a: tree.working } };
  if (pend.length) return { status: 'working', reason: { k: 'running', a: pend[pend.length - 1].label } };
  if (pidStatus === 'busy') return { status: 'working', reason: { k: 'working' } };
  if (main.carry.lastStop === 'end_turn') return { status: 'idle', reason: { k: 'answerReady' } };
  return { status: 'idle', reason: null };
}
