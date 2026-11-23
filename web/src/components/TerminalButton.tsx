// "Open in Warp / iTerm2 / …": asks the local server to bring a live session's terminal to the front.
// Hidden in demo mode, when the setting is off, and when the server cannot reach the session's terminal.
import { useEffect, useRef, useState } from 'react';
import type { TerminalFocusResult, TerminalInfo } from '@shared/api';
import { t, withLang, type MsgKey } from '../i18n';
import { useDemo } from '../lib/demo';
import { useSetting } from '../lib/settings';
import { cx } from './ui';

export async function focusTerminal(sessionId: string): Promise<TerminalFocusResult> {
  try {
    const r = await fetch(withLang(`/api/session/${encodeURIComponent(sessionId)}/terminal`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: '{}',
    });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error(String(r.status));
    return (await r.json()) as TerminalFocusResult;
  } catch {
    return { ok: false, name: null, precision: 'none', error: 'failed' };
  }
}

const ERRORS: Record<NonNullable<TerminalFocusResult['error']>, MsgKey> = {
  'not-live': 'term.err.notLive',
  off: 'term.err.off',
  unsupported: 'term.err.unsupported',
  failed: 'term.err.failed',
};

/** What to tell the user after a click; null when it simply worked. */
export function focusMessage(r: TerminalFocusResult, fallbackName: string): { text: string; tone: 'warn' | 'err' } | null {
  const app = r.name ?? fallbackName;
  if (!r.ok) return { text: t(ERRORS[r.error ?? 'failed']), tone: 'err' };
  if (r.warning === 'permission') return { text: t('term.warn.permission', { app }), tone: 'warn' };
  if (r.warning === 'tab-not-found') return { text: t('term.warn.tab', { app }), tone: 'warn' };
  return null;
}

function Glyph() {
  return (
    <svg className="term-btn__glyph" viewBox="0 0 16 16" aria-hidden>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 6.2 6.8 8 4.5 9.8M8.3 10.2h3.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TerminalButton({ sessionId, info, className = 'gx-btn' }: { sessionId: string; info: TerminalInfo | null | undefined; className?: string }) {
  const demo = useDemo();
  const choice = useSetting((s) => s.terminal.app);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'warn' | 'err' } | null>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (demo || choice === 'off' || !info || info.precision === 'none') return null;
  const name = info.name ?? '';
  const label = name ? t('term.open', { app: name }) : t('term.openGeneric');
  const title = info.precision === 'tab' ? t('term.title.tab', { app: name }) : t('term.title.app', { app: name });
  const click = async () => {
    setBusy(true);
    window.clearTimeout(timer.current);
    const m = focusMessage(await focusTerminal(sessionId), name);
    setBusy(false);
    setMsg(m);
    if (m) timer.current = window.setTimeout(() => setMsg(null), 9000);
  };
  return (
    <span className="term">
      <button type="button" className={cx(className, 'term-btn')} onClick={click} disabled={busy} title={title} aria-busy={busy}>
        <Glyph />
        {busy ? t('term.opening') : label}
      </button>
      {msg && (
        <span className={`term-msg term-msg--${msg.tone}`} role="status">
          {msg.text}
        </span>
      )}
    </span>
  );
}
