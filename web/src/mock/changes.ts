// Demo "what did this agent change?" (?demo=1): files with believable diffs and a live step feed, seeded by the
// session and agent ids. The changed files are fixed per agent; the step feed slides with time (one step every few
// seconds), so a working demo agent keeps doing things. Everything is a function of (ids, now): deterministic.
import type { AgentChanges, AgentNode, AgentStep, DiffHunk, FileChange, FileRead, Range } from '@shared/api';
import { t, type MsgKey } from '../i18n';
import { THOUGHTS } from '../galaxy/mock';
import { demoAgentTypes, demoSessions } from './demo-sessions';
import { mockSessionDetail, mockSessions } from './fixtures';
import { hashStr, rng, type Rng } from './rng';

const FILES: Record<string, string[]> = {
  'aurora-web': ['app/(shop)/page.tsx', 'components/ProductGrid.tsx', 'lib/fetch-products.ts', 'app/layout.tsx', 'next.config.ts', 'components/CartBadge.tsx'],
  'billing-service': ['src/webhook.ts', 'src/rate-limit.ts', 'src/rate-limit.test.ts', 'src/config.ts', 'README.md', 'src/stripe/verify.ts'],
  'mobile-api': ['src/orders/pagination.ts', 'src/orders/orders.controller.ts', 'migrations/0042_orders_cursor.sql', 'test/orders.e2e.ts'],
  'docs-site': ['docs/rest-api/auth.md', 'docs/rest-api/orders.md', 'sidebars.ts', 'docs/rest-api/errors.md'],
  'data-pipeline': ['pipeline/export_parquet.py', 'pipeline/schema.py', 'tests/test_export.py', 'pipeline/config.yaml'],
  'cli-tools': ['src/commands/status.ts', 'src/output/json.ts', 'src/commands/status.test.ts'],
  'nightly-ci': ['scripts/triage.ts', '.github/workflows/nightly.yml'],
};
const GENERIC = ['src/index.ts', 'src/utils.ts', 'src/server.ts', 'test/server.test.ts', 'README.md'];
const READS = ['package.json', 'tsconfig.json', 'src/types.ts', 'docs/ARCHITECTURE.md', 'src/logger.ts', 'CHANGELOG.md'];

/** Small old → new snippets per kind of file; '-' / '+' / ' ' lines like the server's previews. */
const SNIPPETS: Record<string, string[][]> = {
  ts: [
    [' export async function handle(req: Request) {', '-  const body = await req.json();', '+  const body = await req.json().catch(() => null);', '+  if (!body) return new Response("bad json", { status: 400 });', '   const sig = req.headers.get("x-signature");'],
    [' const WINDOW_MS = 60_000;', '-const MAX_HITS = 100;', '+const MAX_HITS = Number(process.env.RATE_LIMIT ?? 120);', ' '],
    ['-export function paginate(items, page) {', '-  return items.slice(page * 20, page * 20 + 20);', '+export function paginate<T>(items: T[], cursor: string | null, size = 20) {', '+  const from = cursor ? items.findIndex((x) => idOf(x) === cursor) + 1 : 0;', '+  return { items: items.slice(from, from + size), next: idOf(items[from + size - 1]) ?? null };', ' }'],
    [' import { describe, expect, it } from "vitest";', '+', '+it("rejects a replayed webhook", async () => {', '+  const res = await handle(signed(body, { ts: Date.now() - 600_000 }));', '+  expect(res.status).toBe(401);', '+});'],
  ],
  tsx: [
    [' export default function ProductGrid({ items }: Props) {', '-  return <div className="grid">{items.map((p) => <Card p={p} />)}</div>;', '+  if (!items.length) return <Empty />;', '+  return <div className="grid">{items.map((p) => <Card key={p.id} p={p} />)}</div>;', ' }'],
    ['-"use client";', ' import { Suspense } from "react";', '+import { fetchProducts } from "@/lib/fetch-products";'],
  ],
  py: [
    [' def export(df, path):', '-    df.to_parquet(path)', '+    df.to_parquet(path, compression="zstd", row_group_size=128_000)', '+    log.info("exported %s rows", len(df))'],
    [' SCHEMA = pa.schema([', '+    ("event_ts", pa.timestamp("ms", tz="UTC")),', '     ("user_id", pa.string()),'],
  ],
  md: [
    [' ## Authentication', '-Send the token in the query string.', '+Send the token in the `Authorization: Bearer <token>` header.', '+Query-string tokens are rejected since v2.'],
    ['+### Errors', '+', '+| Code | Meaning |', '+| --- | --- |', '+| 429 | Too many requests: retry after `Retry-After` seconds |'],
  ],
  sql: [['+ALTER TABLE orders ADD COLUMN cursor_id bigint;', '+CREATE INDEX orders_cursor_idx ON orders (created_at, id);']],
  yml: [[' on:', '   schedule:', "-    - cron: '0 3 * * *'", "+    - cron: '30 2 * * *'"]],
  yaml: [[' export:', '-  compression: snappy', '+  compression: zstd']],
};
const snippetsFor = (file: string) => SNIPPETS[file.split('.').pop() ?? ''] ?? SNIPPETS.ts;

/** Agent types that only look around (no edits in the demo). */
const READ_ONLY = new Set(['Explore', 'Plan', 'code-reviewer', 'web-fetch']);

const STEP_MS = 5200;
const base = (p: string) => p.split('/').pop() ?? p;

/** The last 90 days: demo analytics sessions live there. */
function range90(): Range {
  const d = new Date();
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { from: key(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 89)), to: key(d) };
}

function projectOf(sessionId: string): { project: string; alive: boolean } {
  const g = demoSessions.get(sessionId);
  if (g) return { project: g.project, alive: g.alive };
  const s = mockSessions(range90()).find((x) => x.sessionId === sessionId);
  return { project: s?.project ?? 'aurora-web', alive: false };
}

/** Agent ids of a demo Session page's tree (so the file list can color them like the tree). */
function treeIds(sessionId: string): string[] {
  const out: string[] = [];
  const walk = (n: AgentNode) => { out.push(n.id); n.children.forEach(walk); };
  walk(mockSessionDetail(sessionId, range90()).tree);
  return out;
}

/** The changed files of one agent (fixed for the agent). */
function agentFiles(r: Rng, pool: string[], n: number): string[] {
  const out: string[] = [];
  const bag = [...pool];
  while (out.length < n && bag.length) out.push(bag.splice(Math.floor(r.next() * bag.length), 1)[0]);
  return out;
}

function hunksFor(r: Rng, file: string, edits: number, write: FileChange['write'], lastTs: number): { hunks: DiffHunk[]; added: number; removed: number } {
  const pool = snippetsFor(file);
  const hunks: DiffHunk[] = [];
  let added = 0, removed = 0;
  for (let i = 0; i < edits; i++) {
    const lines = write && i === 0 ? pool[0].filter((l) => l[0] !== '-').map((l) => '+' + l.slice(1)) : r.pick(pool);
    hunks.push({ ts: lastTs - (edits - 1 - i) * 47_000, tool: write && i === 0 ? 'Write' : 'Edit', lines: [...lines], more: write && i === 0 ? r.int(8, 60) : 0 });
    added += lines.filter((l) => l[0] === '+').length + (write && i === 0 ? hunks[i].more : 0);
    removed += lines.filter((l) => l[0] === '-').length;
  }
  return { hunks: hunks.slice(-8), added, removed };
}

interface StepPlan { kind: AgentStep['kind']; tool?: string; label: (r: Rng) => string; fail?: number }

function stepAt(seed: string, i: number, files: string[], readOnly: boolean, project: string): AgentStep & { file?: string } {
  const r = rng(`${seed}:step:${i}`);
  const reads = [...(FILES[project] ?? GENERIC), ...READS];
  const plans: [StepPlan, number][] = [
    [{ kind: 'tool', tool: 'Read', label: (x) => `Read ${base(x.pick(reads))}` }, 5],
    [{ kind: 'tool', tool: 'Grep', label: (x) => `Grep "${x.pick(['useAuth', 'rateLimit', 'cursor', 'TODO', 'webhook', 'parquet'])}"` }, 3],
    [{ kind: 'tool', tool: 'Glob', label: (x) => `Glob ${x.pick(['**/*.ts', 'src/**/*.test.ts', '**/*.md'])}` }, 1],
    [{ kind: 'text', label: (x) => t(x.pick(THOUGHTS) as MsgKey) }, 3],
    [{ kind: 'tool', tool: 'Bash', label: (x) => `Bash: ${x.pick(['pnpm test', 'pnpm lint', 'git diff --stat', 'pnpm typecheck', 'pytest -q'])}`, fail: 0.18 }, 2],
    [{ kind: 'tool', tool: 'WebFetch', label: (x) => `WebFetch ${x.pick(['hono.dev', 'docs.stripe.com', 'nextjs.org', 'arrow.apache.org'])}` }, readOnly ? 2 : 0.5],
  ];
  if (!readOnly && files.length) plans.push([{ kind: 'tool', tool: 'Edit', label: () => '', fail: 0.08 }, 4]);
  const plan = r.weighted(plans);
  const ts = i * STEP_MS + Math.floor(r.next() * STEP_MS * 0.6);
  if (plan.tool === 'Edit') {
    const file = r.pick(files);
    const write = r.next() < 0.15;
    return { ts, kind: 'tool', tool: write ? 'Write' : 'Edit', label: `${write ? 'Write' : 'Edit'} ${base(file)}`, status: r.next() < (plan.fail ?? 0) ? 'error' : 'ok', file };
  }
  const step: AgentStep & { file?: string } = { ts, kind: plan.kind, label: plan.label(r) };
  if (plan.tool) { step.tool = plan.tool; step.status = r.next() < (plan.fail ?? 0) ? 'error' : 'ok'; }
  return step;
}

/**
 * Demo answer of GET /api/session/:id/agent/:agentId/changes. `now` drives the sliding step feed; asleep demo
 * sessions are frozen at the start of the hour.
 */
export function mockAgentChanges(sessionId: string, agentId: string, now = Date.now()): AgentChanges {
  const { project, alive } = projectOf(sessionId);
  const cwd = `/home/dev/code/${project}`;
  const seed = `changes:${sessionId}:${agentId}`;
  const r = rng(seed);
  const pool = FILES[project] ?? GENERIC;
  const type = agentId === 'main' || agentId === 'all' ? 'main' : demoAgentTypes.get(agentId) ?? (hashStr(agentId) % 3 ? 'general-purpose' : 'Explore');
  const readOnly = READ_ONLY.has(type);
  const at = alive ? now : Math.floor(now / 3_600_000) * 3_600_000 - 3 * 3_600_000;

  // Files: fixed per agent; the newest change is a little while ago.
  const names = readOnly ? [] : agentFiles(r, pool, agentId === 'all' ? pool.length : r.int(2, Math.min(5, pool.length)));
  const ids = agentId === 'all' ? treeIds(sessionId) : [];
  const files: FileChange[] = names.map((p, k) => {
    const edits = r.int(1, 5);
    const write = r.next() < 0.25 ? (r.next() < 0.7 ? 'created' : 'overwritten') : null;
    const lastTs = at - (k * 95_000 + r.int(8, 80) * 1000);
    const h = hunksFor(r, p, edits, write, lastTs);
    const c: FileChange = { path: p, name: base(p), added: h.added, removed: h.removed, edits, failed: r.next() < 0.2 ? 1 : 0, reads: r.int(0, 3), lastTs, write, hunks: h.hunks };
    if (agentId === 'all') c.agents = [...new Set([r.next() < 0.6 ? 'main' : r.pick(ids), ...(r.next() < 0.5 ? [r.pick(ids)] : [])])];
    return c;
  });
  // One attempt that never succeeded, now and then.
  if (!readOnly && r.next() < 0.4) {
    files.push({ path: '.env.local', name: '.env.local', added: 0, removed: 0, edits: 0, failed: 1, reads: 0, lastTs: at - 400_000, write: null, hunks: [] });
  }
  const reads: FileRead[] = agentFiles(r, [...pool, ...READS], readOnly ? 6 : 3)
    .filter((p) => !names.includes(p))
    .map((p, k) => ({ path: p, name: base(p), count: r.int(1, 4), lastTs: at - (k + 1) * 61_000 }));

  // Steps: a sliding window over an endless deterministic sequence.
  const steps: AgentStep[] = [];
  let stepsTotal = 0;
  if (agentId !== 'all') {
    const last = Math.floor(at / STEP_MS);
    const count = r.int(70, 140);
    stepsTotal = count + r.int(0, 300);
    for (let i = last - Math.min(count, 200) + 1; i <= last; i++) {
      const s = stepAt(seed, i, names, readOnly, project);
      if (s.ts > at) continue;
      delete s.file;
      if (s.status && alive && at - s.ts < 1500) s.status = 'pending';
      else if (s.status) s.endTs = s.ts + 300 + (hashStr(`${seed}:${i}`) % 2400);
      steps.push(s);
    }
  }
  const ok = files.filter((f) => f.edits > 0);
  return {
    sessionId, agentId, cwd,
    files: [...ok.sort((a, b) => b.lastTs - a.lastTs), ...files.filter((f) => f.edits === 0)],
    filesTotal: files.length,
    reads,
    readsTotal: reads.length,
    totals: {
      files: ok.length,
      added: ok.reduce((n, f) => n + f.added, 0),
      removed: ok.reduce((n, f) => n + f.removed, 0),
      edits: ok.reduce((n, f) => n + f.edits, 0),
      failed: files.reduce((n, f) => n + f.failed, 0),
    },
    steps,
    stepsTotal: Math.max(stepsTotal, steps.length),
    generatedAt: now,
  };
}
