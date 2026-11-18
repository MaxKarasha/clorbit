// The subscription plan from ~/.claude.json: only the plan fields are read, private fields never leak.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { planFrom, readPlan, resetPlanCache, tierOf } from '../plan';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-plan-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
beforeEach(() => resetPlanCache());

const account = {
  accountUuid: '00000000-0000-0000-0000-000000000001',
  emailAddress: 'someone@example.com',
  organizationUuid: '00000000-0000-0000-0000-000000000002',
  organizationName: 'Secret Org',
  displayName: 'Someone',
  billingType: 'stripe_subscription',
  subscriptionCreatedAt: '2026-03-19T11:48:14.264300Z',
  organizationType: 'claude_max',
  organizationRateLimitTier: 'default_claude_max_20x',
  userRateLimitTier: null,
  planDisplayName: 'Ultra',
};

describe('plan', () => {
  it('turns rate-limit tiers into multipliers', () => {
    expect(tierOf('default_claude_max_20x')).toBe('20×');
    expect(tierOf('default_claude_max_5x')).toBe('5×');
    expect(tierOf('default_claude_pro')).toBeNull();
    expect(tierOf(null)).toBeNull();
  });

  it('picks only the plan fields', () => {
    const p = planFrom(account);
    expect(p).toEqual({ name: 'Ultra', tier: '20×', type: 'claude_max', since: '2026-03-19T11:48:14.264300Z' });
    const text = JSON.stringify(p);
    for (const secret of ['someone@example.com', 'Secret Org', '00000000', 'Someone', 'stripe']) expect(text).not.toContain(secret);
  });

  it('derives the name from the organization type and prefers the user tier', () => {
    expect(planFrom({ organizationType: 'claude_pro' })).toEqual({ name: 'Pro', tier: null, type: 'claude_pro', since: null });
    expect(planFrom({ organizationType: 'claude_max', userRateLimitTier: 'default_claude_max_5x', organizationRateLimitTier: 'default_claude_max_20x' })?.tier).toBe('5×');
  });

  it('is null without a subscription or with junk', () => {
    expect(planFrom(undefined)).toBeNull();
    expect(planFrom({ emailAddress: 'x@y.z' })).toBeNull();
    expect(planFrom([1, 2])).toBeNull();
    expect(planFrom({ planDisplayName: 42, subscriptionCreatedAt: 'not a date', organizationType: 'claude_max' })).toEqual({ name: 'Max', tier: null, type: 'claude_max', since: null });
  });

  it('reads the file, caches by mtime and keeps the last plan while the file is mid-write', () => {
    const f = path.join(tmp, '.claude.json');
    expect(readPlan([f])).toBeNull();
    fs.writeFileSync(f, JSON.stringify({ projects: { '/x': {} }, oauthAccount: account }));
    expect(readPlan([f])?.name).toBe('Ultra');
    fs.writeFileSync(f, '{"oauthAccount": {"planDisplayName": "Ma');
    expect(readPlan([f])?.name).toBe('Ultra');
    fs.writeFileSync(f, JSON.stringify({ oauthAccount: { ...account, planDisplayName: 'Max' } }));
    fs.utimesSync(f, new Date(), new Date(Date.now() + 5000));
    expect(readPlan([f])?.name).toBe('Max');
    // The first existing candidate wins.
    expect(readPlan([path.join(tmp, 'missing.json'), f])?.name).toBe('Max');
  });
});
