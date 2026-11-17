import type { Range } from '@shared/api';
import { mockAttribution, mockInsights, mockLive, mockOverview, mockSessionDetail, mockSessions } from './fixtures';

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
  if (p === '/api/live') {
    const hashMock = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('mock');
    return mockLive(hashMock === 'scan');
  }
  if (p === '/api/analytics/overview') return mockOverview(range);
  if (p === '/api/analytics/attribution') return mockAttribution(range);
  if (p === '/api/analytics/sessions') return mockSessions(range, q.get('project'));
  if (p === '/api/insights') return mockInsights(range);
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
