// A session's title with a pencil to rename it. The name is a Clorbit setting (Settings.sessionNames): it is
// shown everywhere in Clorbit and never written to ~/.claude, so Claude Code's own /resume list keeps its titles.
import { useEffect, useRef, useState } from 'react';
import { MAX_SESSION_NAME, cleanSessionName, withSessionName } from '@shared/settings';
import { t } from '../i18n';
import { getSettings, updateSettings, useSetting } from '../lib/settings';

/** The title a session had before a Clorbit name (the server sends `autoTitle` only for a renamed session). */
export function originalTitle(s: { title: string | null; autoTitle?: string | null }): string | null {
  return s.autoTitle !== undefined ? s.autoTitle : s.title;
}

/** The title to show right now: the local name wins at once, without waiting for the next snapshot. */
export function shownTitle(s: { title: string | null; autoTitle?: string | null }, name: string | undefined): string | null {
  return name ?? originalTitle(s);
}

export function renameSession(sessionId: string, name: string | null) {
  updateSettings({ sessionNames: withSessionName(getSettings().sessionNames, sessionId, name) });
}

interface Props {
  sessionId: string;
  title: string | null;
  autoTitle?: string | null;
  /** Shown when the session has no title at all. */
  fallback: string;
  /** 'gx': the galaxy's side panel; 'page': the Session page heading. */
  variant: 'gx' | 'page';
}

export default function RenameTitle({ sessionId, title, autoTitle, fallback, variant }: Props) {
  const name = useSetting((s) => s.sessionNames[sessionId]);
  const orig = originalTitle({ title, autoTitle });
  const shown = name ?? orig ?? fallback;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  // Another session got focused while editing: drop the draft.
  useEffect(() => setEditing(false), [sessionId]);
  useEffect(() => { if (editing) input.current?.select(); }, [editing]);

  const start = () => { setDraft(name ?? orig ?? ''); setEditing(true); };
  const commit = () => {
    if (!editing) return;
    setEditing(false);
    const n = cleanSessionName(draft);
    // An empty name, or the original title typed back, removes the name.
    renameSession(sessionId, n && n !== orig ? n : null);
  };

  if (editing) {
    return (
      <span className={`rn rn--${variant} rn--editing`}>
        <input
          ref={input}
          className="rn__input"
          value={draft}
          maxLength={MAX_SESSION_NAME}
          placeholder={orig ?? t('rename.placeholder')}
          aria-label={t('rename.label')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation(); // the galaxy's keys (Esc goes up, +/− zoom) stay out of the input
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') setEditing(false);
          }}
        />
        <span className="rn__hint">{t('rename.hint')}</span>
      </span>
    );
  }
  return (
    <span className={`rn rn--${variant}`}>
      <span className="rn__text" onDoubleClick={start}>{shown}</span>
      <button type="button" className="rn__btn" onClick={start} title={t('rename.title')} aria-label={t('rename.title')}>
        <svg viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.6 2.6l2.8 2.8L6 12.8l-3.4.6.6-3.4z" /><path d="M9.2 4l2.8 2.8" />
        </svg>
      </button>
      {name && (
        <button type="button" className="rn__reset" onClick={() => renameSession(sessionId, null)} title={orig ? t('rename.resetTo', { title: orig }) : t('rename.reset')}>
          {t('rename.reset')}
        </button>
      )}
    </span>
  );
}
