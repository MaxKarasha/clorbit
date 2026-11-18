// The signed-in subscription plan, from `oauthAccount` in Claude Code's ~/.claude.json (read-only).
// That file also holds the account's email, ids, organization and project history: only the plan
// fields below are picked, and nothing from the file is logged, stored or returned beyond them.
import fs from 'node:fs';
import type { Plan } from '../shared/api.ts';
import { CLAUDE_JSON_FILES } from './config';

const NAMES: Record<string, string> = {
  claude_pro: 'Pro',
  claude_max: 'Max',
  claude_team: 'Team',
  claude_enterprise: 'Enterprise',
};

/** A short, printable string or null (the file is user data: never trust its shape). */
function str(v: unknown, max = 40): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s && s.length <= max && !/[\u0000-\u001f]/.test(s) ? s : null;
}

/** 'default_claude_max_20x' → '20×'; null without a multiplier. */
export function tierOf(rateLimitTier: unknown): string | null {
  const m = typeof rateLimitTier === 'string' ? /(?:^|_)(\d{1,3})x$/i.exec(rateLimitTier) : null;
  return m ? `${Number(m[1])}×` : null;
}

/** The plan from an `oauthAccount` object; reads only the plan fields. Null when nothing is known. */
export function planFrom(account: unknown): Plan | null {
  if (!account || typeof account !== 'object' || Array.isArray(account)) return null;
  const a = account as Record<string, unknown>;
  const type = str(a.organizationType);
  const name = str(a.planDisplayName) ?? (type ? NAMES[type] ?? null : null);
  const tier = tierOf(a.userRateLimitTier) ?? tierOf(a.organizationRateLimitTier);
  const sinceRaw = str(a.subscriptionCreatedAt, 64);
  const since = sinceRaw && Number.isFinite(Date.parse(sinceRaw)) ? sinceRaw : null;
  if (!name && !tier && !type) return null;
  return { name, tier, type, since };
}

let cache: { file: string; mtime: number; size: number; plan: Plan | null } | null = null;

/** The current plan (cached by the file's mtime); null without the file or a signed-in subscription. */
export function readPlan(files: string[] = CLAUDE_JSON_FILES): Plan | null {
  for (const file of files) {
    let st: fs.Stats;
    try { st = fs.statSync(file); } catch { continue; }
    if (cache && cache.file === file && cache.mtime === st.mtimeMs && cache.size === st.size) return cache.plan;
    let plan: Plan | null = null;
    try {
      // Parsed whole (it is plain JSON), then reduced to the plan fields right away.
      plan = planFrom((JSON.parse(fs.readFileSync(file, 'utf8')) as { oauthAccount?: unknown })?.oauthAccount);
    } catch {
      // Mid-write or not JSON: keep what was known (no details are logged — the file is private).
      if (cache && cache.file === file) return cache.plan;
    }
    cache = { file, mtime: st.mtimeMs, size: st.size, plan };
    return plan;
  }
  return null;
}

/** For tests: forget the cached plan. */
export function resetPlanCache(): void {
  cache = null;
}
