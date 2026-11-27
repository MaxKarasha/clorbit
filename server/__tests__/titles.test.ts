// Session titles: a Clorbit name, then Claude Code's /rename title, then a Cowork title, then the ai-title.
import { afterEach, describe, expect, it } from 'vitest';
import { scanText } from '../scanner';
import { autoTitle, sessionTitle, setSessionNames, titleFields } from '../titles';

const id = { sessionId: 's-1', agentId: null, projectDir: 'p' };
const lines = (...recs: object[]) => recs.map((r) => JSON.stringify(r)).join('\n');
afterEach(() => setSessionNames({}));

describe('session titles', () => {
  it('reads /rename titles (custom-title, the last one wins) next to the ai-title', () => {
    const s = scanText('/x.jsonl', id, lines(
      { type: 'ai-title', aiTitle: 'Fix login bug', sessionId: 's-1' },
      { type: 'custom-title', customTitle: 'Auth rewrite', sessionId: 's-1' },
      { type: 'custom-title', customTitle: '  Auth rewrite v2 ', sessionId: 's-1' },
    ), { knownPlugins: [] });
    expect(s.title).toBe('Fix login bug');
    expect(s.customTitle).toBe('Auth rewrite v2');
    expect(autoTitle(s, '')).toBe('Auth rewrite v2');
  });

  it('a Clorbit name wins, and the API carries the title it replaced', () => {
    const main = { sessionId: 's-1', path: '/x.jsonl', title: 'Fix login bug', customTitle: null };
    expect(sessionTitle(main, '')).toBe('Fix login bug');
    expect(titleFields('s-1', main, '')).toEqual({ title: 'Fix login bug' });
    setSessionNames({ 's-1': 'Login' });
    expect(sessionTitle(main, '')).toBe('Login');
    expect(titleFields('s-1', main, '')).toEqual({ title: 'Login', autoTitle: 'Fix login bug' });
    // A renamed session without any title of its own (or without a main transcript yet).
    expect(titleFields('s-1', null, '')).toEqual({ title: 'Login', autoTitle: null });
    expect(titleFields('other', main, '')).toEqual({ title: 'Fix login bug' });
    // Not fooled by keys of Object.prototype.
    expect(titleFields('constructor', { ...main, sessionId: 'constructor' }, '')).toEqual({ title: 'Fix login bug' });
  });
});
