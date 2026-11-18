// How to connect the subscription-limits source: what it is, the exact command (with a copy
// button), and that it edits ~/.claude/settings.json only when the user runs it. Clorbit never
// runs it itself. Used in Settings → Connection and in the Overview's limits panel.
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

export const LIMITS_COMMAND = 'node scripts/install-hooks.mjs --apply --statusline';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (e.g. not a secure context): the old way.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export default function LimitsHowTo({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    if (!(await copyText(LIMITS_COMMAND))) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className={`limhow${compact ? ' limhow--compact' : ''}`}>
      <p className="limhow__what">{t('con.lim.what')}</p>
      <p className="limhow__run">{t('con.lim.run')}</p>
      <div className="limhow__cmd">
        {/* Wraps only between arguments, never inside '--statusline'. */}
        <code className="mono">
          {LIMITS_COMMAND.split(' ').map((w, i) => (
            <span key={i}>{i > 0 && ' '}<span className="limhow__w">{w}</span></span>
          ))}
        </code>
        <button type="button" className={`set-btn${copied ? ' is-done' : ''}`} onClick={copy} aria-label={t('con.lim.copy')} title={t('con.lim.copy')} aria-live="polite">
          {copied ? t('ui.copied') : t('ui.copy')}
        </button>
      </div>
      <ul className="limhow__notes">
        <li>{t('con.lim.edits')}</li>
        <li>{t('con.lim.dry')}</li>
        <li className="limhow__never">{t('con.lim.never')}</li>
      </ul>
    </div>
  );
}
