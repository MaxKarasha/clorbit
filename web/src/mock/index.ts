import type { Range } from '@shared/api';
import { demoValue } from '../lib/demo';
import { mockAttribution, mockInsights, mockLive, mockOverview, mockSessionDetail, mockSessions } from './fixtures';
import { mockLimits, mockLimitsHistory } from './limits';
import { mockReplay } from './replay';

/** 'YYYY-MM-DD' (local day; `end` = its last millisecond) or epoch ms. */
function tsOf(v: string | null, end: boolean, fallback: number): number {
  if (!v) return fallback;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + (end ? 1 : 0)).getTime();
    return end ? d - 1 : d;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rangeOf(q: URLSearchParams): Range {
  const to = q.get('to') ?? today();
  const from = q.get('from') ?? to;
  return { from, to };
}

/** Demo response for any GET endpoint from shared/api.ts. Text follows the current UI language. */
export function mockResolve(path: string): unknown {
  const [p, qs = ''] = path.split('?');
  const q = new URLSearchParams(qs);
  const range = rangeOf(q);
  // `?mock=scan` (or `?demo=scan`): demo mode with a history scan in progress.
  if (p === '/api/live') return mockLive(demoValue() === 'scan');
  if (p === '/api/analytics/overview') return mockOverview(range);
  if (p === '/api/analytics/attribution') return mockAttribution(range);
  if (p === '/api/analytics/sessions') return mockSessions(range, q.get('project'));
  if (p === '/api/insights') return mockInsights(range);
  if (p === '/api/limits/forecast') return mockLimits().forecast;
  if (p === '/api/limits/history') {
    const now = Date.now();
    const to = tsOf(q.get('to'), true, now);
    return mockLimitsHistory(tsOf(q.get('from'), false, to - 7 * 86_400_000), to, now);
  }
  const rp = p.match(/^\/api\/session\/([^/]+)\/replay$/);
  if (rp) return mockReplay(decodeURIComponent(rp[1]));
  const m = p.match(/^\/api\/session\/(.+)$/);
  if (m) {
    // Look the session up in the last 90 days so links from any range resolve.
    const to = today();
    const d = new Date();
    d.setDate(d.getDate() - 89);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return mockSessionDetail(decodeURIComponent(m[1]), { from, to });
  }
  throw new Error(`No demo data for ${p}`);
}
