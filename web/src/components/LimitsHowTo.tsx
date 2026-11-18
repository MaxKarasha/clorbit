// How to connect the subscription-limits source: what it is, the exact commands (with copy
// buttons; the plugin's /clorbit command first, the repository script second), and that they edit
// ~/.claude/settings.json only when the user runs them. Clorbit never runs them itself.
// Used in Settings → Connection and in the Overview's limits panel.
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

/** In Claude Code, with the plugin installed (no clone needed). */
export const LIMITS_COMMAND = '/clorbit statusline --apply';
/** From a clone of the repository. */
export const LIMITS_REPO_COMMAND = 'node scripts/install-hooks.mjs --apply --statusline';

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

/** A command with a copy button; wraps only between arguments, never inside '--statusline'. */
function CommandRow({ command, label }: { command: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    if (!(await copyText(command))) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="limhow__cmd">
      <code className="mono">
        {command.split(' ').map((w, i) => (
          <span key={i}>{i > 0 && ' '}<span className="limhow__w">{w}</span></span>
        ))}
      </code>
      <button type="button" className={`set-btn${copied ? ' is-done' : ''}`} onClick={copy} aria-label={label} title={label} aria-live="polite">
        {copied ? t('ui.copied') : t('ui.copy')}
      </button>
    </div>
  );
}

export default function LimitsHowTo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`limhow${compact ? ' limhow--compact' : ''}`}>
      <p className="limhow__what">{t('con.lim.what')}</p>
      <p className="limhow__run">{t('con.lim.plugin')}</p>
      <CommandRow command={LIMITS_COMMAND} label={t('con.lim.copy')} />
      <p className="limhow__alt">{t('con.lim.repo')}</p>
      <CommandRow command={LIMITS_REPO_COMMAND} label={t('con.lim.copyRepo')} />
      <ul className="limhow__notes">
        <li>{t('con.lim.dry')}</li>
        <li>{t('con.lim.edits')}</li>
        <li>{t('con.lim.create')}</li>
        <li className="limhow__never">{t('con.lim.never')}</li>
      </ul>
    </div>
  );
}
