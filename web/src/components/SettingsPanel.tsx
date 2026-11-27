// Profile button and the settings slide-over: notifications matrix, sounds, do not disturb, recommendations,
// interface and a read-only connection summary. One instance at the app root.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NOTIFY_EVENTS, SOUND_THEMES, TERMINAL_APPS, TERMINAL_NAMES, type NotifyChannel, type NotifyEventType, type NotifyRule, type Plan, type SoundTheme, type TerminalChoice } from '@shared/api';
import { isSilenced, isTerminalChoice, RECOMMEND_DAYS } from '@shared/settings';
import { LANGS, locale, setLang, t, tp, useLang, type MsgKey } from '../i18n';
import { useData } from '../lib/api';
import { fmtAgo, fmtInt } from '../lib/format';
import {
  closeSettings,
  loadAbout,
  openSettings,
  resetLayout,
  sendTestNotification,
  takeSettingsSection,
  updateSettings,
  useAbout,
  useSettings,
  useSettingsOpen,
  useSettingsState,
} from '../lib/settings';
import { EVENT_COLOR, eventLabel } from '../notify/rules';
import LimitsHowTo from './LimitsHowTo';
import PlanBadge, { planLabel, planSince } from './PlanBadge';
import { MOCK_PLAN } from '../mock/limits';
import { playSound } from '../notify/sound';

/* ---------------- profile button ---------------- */

function ProfileGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="prof__glyph">
      <circle cx="12" cy="9.2" r="3.1" fill="currentColor" />
      <path d="M6.4 18.2c.9-2.6 3-4 5.6-4s4.7 1.4 5.6 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <ellipse cx="12" cy="12" rx="10.4" ry="4.2" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1" transform="rotate(-28 12 12)" />
      <circle cx="20.6" cy="7.4" r="1.5" className="prof__moon" />
    </svg>
  );
}

export function ProfileButton({ className = '' }: { className?: string }) {
  const s = useSettings();
  const open = useSettingsOpen();
  const quiet = isSilenced(s);
  return (
    <button
      type="button"
      className={`prof ${quiet ? 'prof--quiet' : ''} ${className}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={quiet ? t('set.openDnd') : t('set.open')}
      title={quiet ? t('set.openDnd') : t('set.open')}
      onClick={(e) => openSettings(e.currentTarget)}
    >
      <ProfileGlyph />
      {quiet && <span className="prof__dnd" aria-hidden />}
    </button>
  );
}

/* ---------------- controls ---------------- */

/** The switch: a planet that moves along a short orbit and lights up. */
function Orbit({ on, onChange, label, disabled, color }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; color?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      className="orb"
      style={color ? { ['--acc' as string]: color } : undefined}
      onClick={() => onChange(!on)}
    >
      <span className="orb__track" aria-hidden />
      <span className="orb__planet" aria-hidden />
    </button>
  );
}

function Row({ title, desc, children, id }: { title: string; desc?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <div className="set-row">
      <div className="set-row__text">
        <span className="set-row__title" id={id}>{title}</span>
        {desc && <span className="set-row__desc">{desc}</span>}
      </div>
      <div className="set-row__ctl">{children}</div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="set-sec" aria-labelledby={`set-${id}`}>
      <h3 className="set-sec__title" id={`set-${id}`}>{title}</h3>
      {children}
    </section>
  );
}

const ICONS: Record<NotifyChannel, ReactNode> = {
  sound: <path d="M4 9.5h3l4-3.5v12l-4-3.5H4zM15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" />,
  browser: <path d="M3.5 5.5h17v13h-17zM3.5 9h17M6.5 7.2h.01M9 7.2h.01" />,
  toast: <path d="M5 12.5h12.5v6H5zM7.5 9h12v6M10 5.5h11v6" />,
  system: <path d="M3.5 4.5h17v11h-17zM9 19.5h6M12 15.5v4" />,
};
const CHANNELS: NotifyChannel[] = ['sound', 'browser', 'toast', 'system'];

function ChannelIcon({ ch }: { ch: NotifyChannel }) {
  return (
    <svg viewBox="0 0 24 24" className="nmx__icon" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[ch]}
    </svg>
  );
}

function EyeOff() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <path d="M4 20 20 4" />
    </svg>
  );
}

/* ---------------- sections ---------------- */

function useNotificationPermission(): [NotificationPermission | 'unsupported', () => void] {
  const get = (): NotificationPermission | 'unsupported' => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [p, setP] = useState(get);
  useEffect(() => {
    const onVis = () => setP(get());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, []);
  const request = () => {
    if (typeof Notification === 'undefined') return;
    try {
      void Promise.resolve(Notification.requestPermission())
        .then((r) => setP(r))
        .catch(() => setP(get()));
    } catch {
      setP(get());
    }
  };
  return [p, request];
}

function Notifications({ demo, offline }: { demo: boolean; offline: boolean }) {
  const s = useSettings();
  const about = useAbout();
  const [perm, requestPerm] = useNotificationPermission();
  const [test, setTest] = useState<'idle' | 'sending' | 'sent' | 'limited' | 'failed'>('idle');
  const sysOk = !!about?.system.available;
  const set = (ev: NotifyEventType, patch: Partial<NotifyRule>) => updateSettings({ notifications: { [ev]: patch } });
  const chLabel = (ch: NotifyChannel) => t(`ntf.ch.${ch}` as MsgKey);
  return (
    <Section id="notifications" title={t('set.sec.notifications')}>
      <table className="nmx">
        <thead>
          <tr>
            <th scope="col" className="nmx__ev" />
            {CHANNELS.map((ch) => (
              <th key={ch} scope="col" title={t(`ntf.ch.${ch}.t` as MsgKey)}>
                <ChannelIcon ch={ch} />
                <span>{chLabel(ch)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {NOTIFY_EVENTS.map((ev) => {
            const r = s.notifications[ev];
            const name = eventLabel(ev);
            const color = EVENT_COLOR[ev];
            return (
              <tr key={ev} style={{ ['--acc' as string]: color }}>
                <th scope="row" className="nmx__ev">
                  <span className="nmx__dot" aria-hidden />
                  <span className="nmx__name">{name}</span>
                  <span className="nmx__desc">{t(`ntf.ev.${ev}.d` as MsgKey)}</span>
                </th>
                <td>
                  <Orbit on={r.sound} onChange={(v) => set(ev, { sound: v })} label={t('ntf.cell', { event: name, channel: chLabel('sound') })} color={color} />
                </td>
                <td className="nmx__browser">
                  <Orbit on={r.browser} onChange={(v) => set(ev, { browser: v })} label={t('ntf.cell', { event: name, channel: chLabel('browser') })} color={color} disabled={demo} />
                  {r.browser && !demo && (
                    <button
                      type="button"
                      className={`nmx__hidden ${r.browserHiddenOnly ? 'is-on' : ''}`}
                      aria-pressed={r.browserHiddenOnly}
                      aria-label={`${name}: ${t('ntf.hiddenOnly')}`}
                      title={t('ntf.hiddenOnly')}
                      onClick={() => set(ev, { browserHiddenOnly: !r.browserHiddenOnly })}
                    >
                      <EyeOff />
                    </button>
                  )}
                </td>
                <td>
                  <Orbit on={r.toast} onChange={(v) => set(ev, { toast: v })} label={t('ntf.cell', { event: name, channel: chLabel('toast') })} color={color} />
                </td>
                <td>
                  <Orbit on={r.system && sysOk} onChange={(v) => set(ev, { system: v })} label={t('ntf.cell', { event: name, channel: chLabel('system') })} color={color} disabled={!sysOk || demo} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="set-legend">
        <span className="set-legend__eye"><EyeOff /></span> {t('ntf.hiddenOnly')}. {sysOk && t('ntf.dedupe')}
      </p>

      <div className="set-note-list">
        <div className={`set-note ${perm === 'granted' && !demo ? 'set-note--ok' : ''}`}>
          <ChannelIcon ch="browser" />
          <div>
            {demo ? (
              t('ntf.perm.demo')
            ) : perm === 'granted' ? (
              t('ntf.perm.granted')
            ) : perm === 'denied' ? (
              t('ntf.perm.denied')
            ) : perm === 'unsupported' ? (
              t('ntf.perm.unsupported')
            ) : (
              <>
                {t('ntf.perm.default')}{' '}
                <button type="button" className="set-btn set-btn--accent" onClick={requestPerm}>
                  {t('ntf.perm.allow')}
                </button>
              </>
            )}
          </div>
        </div>
        {!demo && (
          <div className={`set-note ${sysOk ? 'set-note--ok' : ''}`}>
            <ChannelIcon ch="system" />
            <div>
              {offline || !about ? (
                t('ntf.sys.offline')
              ) : sysOk ? (
                <>
                  {t('ntf.sys.on', { tool: about.system.tool ?? '' })} {about.system.platform === 'darwin' && t('ntf.sys.mac')}{' '}
                  <button
                    type="button"
                    className="set-btn"
                    disabled={test === 'sending'}
                    onClick={async () => {
                      setTest('sending');
                      setTest(await sendTestNotification());
                    }}
                  >
                    {t('ntf.sys.test')}
                  </button>
                  {test === 'sent' && <span className="set-flash"> {t('ntf.sys.sent')}</span>}
                  {test === 'limited' && <span className="set-flash"> {t('ntf.sys.limited')}</span>}
                  {test === 'failed' && <span className="set-flash set-flash--bad"> {t('ntf.sys.failed')}</span>}
                </>
              ) : (
                t('ntf.sys.off')
              )}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

/** A tiny drawing of each theme's waveform: a decaying sine, ticks, a square wave. */
function ThemeWave({ theme }: { theme: SoundTheme }) {
  const d =
    theme === 'orbit'
      ? 'M2 12 C5 2, 8 2, 11 12 S17 20, 20 12 S25 7, 28 12 S32 14, 34 12 S38 11, 40 12 L46 12'
      : theme === 'minimal'
        ? 'M2 12 H8 M8 6 V18 M14 12 H18 M18 8 V16 M24 12 H27 M27 4 V20 M33 12 H36 M36 9 V15 M36 12 H46'
        : 'M2 12 H6 V5 H12 V19 H18 V5 H24 V19 H30 V8 H35 V16 H40 V12 H46';
  return (
    <svg className="set-theme__wave" viewBox="0 0 48 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function Sounds() {
  const s = useSettings();
  const snd = s.sound;
  const [playing, setPlaying] = useState<NotifyEventType | null>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const preview = (ev: NotifyEventType) => {
    playSound(ev, snd.theme, snd.volume, true);
    setPlaying(ev);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlaying(null), 900);
  };
  return (
    <Section id="sounds" title={t('set.sec.sounds')}>
      <Row title={t('snd.enabled')} desc={t('snd.enabled.d')}>
        <Orbit on={snd.enabled} onChange={(v) => updateSettings({ sound: { enabled: v } })} label={t('snd.enabled')} />
      </Row>
      <div className={`set-sub ${snd.enabled ? '' : 'is-off'}`}>
        <label className="set-vol">
          <span className="set-row__title">{t('snd.volume')}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(snd.volume * 100)}
            style={{ ['--fill' as string]: `${snd.volume * 100}%` }}
            onChange={(e) => updateSettings({ sound: { volume: Number(e.target.value) / 100 } })}
          />
          <output className="mono">{Math.round(snd.volume * 100)}</output>
        </label>
        <div className="set-themes" role="radiogroup" aria-label={t('snd.theme')}>
          {SOUND_THEMES.map((th) => (
            <button
              key={th}
              type="button"
              role="radio"
              aria-checked={snd.theme === th}
              className={`set-theme set-theme--${th} ${snd.theme === th ? 'is-on' : ''}`}
              onClick={() => updateSettings({ sound: { theme: th } })}
            >
              <ThemeWave theme={th} />
              <b>{t(`snd.theme.${th}` as MsgKey)}</b>
              <span>{t(`snd.theme.${th}.d` as MsgKey)}</span>
            </button>
          ))}
        </div>
        <div className="set-previews" aria-label={t('snd.preview')}>
          {NOTIFY_EVENTS.map((ev) => (
            <button
              key={ev}
              type="button"
              className={`set-chip ${playing === ev ? 'is-playing' : ''}`}
              style={{ ['--acc' as string]: EVENT_COLOR[ev] }}
              onClick={() => preview(ev)}
              aria-label={t('snd.previewEvent', { event: eventLabel(ev) })}
              title={t('snd.previewEvent', { event: eventLabel(ev) })}
            >
              <svg viewBox="0 0 12 12" aria-hidden>
                <path d="M3 2l7 4-7 4z" fill="currentColor" />
              </svg>
              {eventLabel(ev)}
            </button>
          ))}
        </div>
        <p className="set-hint">{t('snd.note')}</p>
      </div>
    </Section>
  );
}

function Dnd() {
  const s = useSettings();
  const d = s.dnd;
  const now = Date.now();
  const muted = d.mutedUntil && d.mutedUntil > now ? d.mutedUntil : null;
  const quietNow = isSilenced({ ...s, dnd: { ...d, enabled: false, mutedUntil: null } }, now);
  const clock = (ts: number) => new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  return (
    <Section id="dnd" title={t('set.sec.dnd')}>
      <Row title={t('dnd.enabled')} desc={t('dnd.enabled.d')}>
        <Orbit on={d.enabled} onChange={(v) => updateSettings({ dnd: { enabled: v } })} label={t('dnd.enabled')} />
      </Row>
      {muted && (
        <div className="set-status">
          {t('dnd.mutedUntil', { time: clock(muted) })}{' '}
          <button type="button" className="set-btn" onClick={() => updateSettings({ dnd: { mutedUntil: null } })}>
            {t('dnd.unmute')}
          </button>
        </div>
      )}
      <Row title={t('dnd.quiet')} desc={t('dnd.quiet.d')}>
        <Orbit on={d.quietHours.enabled} onChange={(v) => updateSettings({ dnd: { quietHours: { enabled: v } } })} label={t('dnd.quiet')} />
      </Row>
      <div className={`set-hours ${d.quietHours.enabled ? '' : 'is-off'}`}>
        <label>
          <span>{t('dnd.from')}</span>
          <input type="time" value={d.quietHours.from} onChange={(e) => e.target.value && updateSettings({ dnd: { quietHours: { from: e.target.value } } })} />
        </label>
        <span className="set-hours__arc" aria-hidden />
        <label>
          <span>{t('dnd.to')}</span>
          <input type="time" value={d.quietHours.to} onChange={(e) => e.target.value && updateSettings({ dnd: { quietHours: { to: e.target.value } } })} />
        </label>
        {quietNow && <span className="set-status set-status--inline">{t('dnd.nowQuiet')}</span>}
      </div>
    </Section>
  );
}

function Interface() {
  const s = useSettings();
  const lang = useLang();
  const [reset, setReset] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const pinned = Object.keys(s.layout.pins).length;
  return (
    <Section id="interface" title={t('set.sec.interface')}>
      <Row title={t('ui.lang')}>
        <div className="segmented" role="radiogroup" aria-label={t('ui.lang')}>
          {LANGS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={lang === l} className={`segmented__btn ${lang === l ? 'is-active' : ''}`} onClick={() => setLang(l)}>
              {t(l === 'en' ? 'lang.en.title' : 'lang.uk.title')}
            </button>
          ))}
        </div>
      </Row>
      <Row title={t('ui.tour')} desc={t('ui.tour.d')}>
        <Orbit on={s.interface.autoTour} onChange={(v) => updateSettings({ interface: { autoTour: v } })} label={t('ui.tour')} />
      </Row>
      <Row title={t('ui.motion')} desc={t('ui.motion.d')}>
        <Orbit on={s.interface.reduceMotion} onChange={(v) => updateSettings({ interface: { reduceMotion: v } })} label={t('ui.motion')} />
      </Row>
      <Row title={t('ui.automated')} desc={t('ui.automated.d')}>
        <Orbit on={s.interface.showAutomated} onChange={(v) => updateSettings({ interface: { showAutomated: v } })} label={t('ui.automated')} />
      </Row>
      <Row title={t('ui.cowork')} desc={t('ui.cowork.d')}>
        <Orbit on={s.interface.showCowork} onChange={(v) => updateSettings({ interface: { showCowork: v } })} label={t('ui.cowork')} />
      </Row>
      <Row title={t('ui.gravity')} desc={t('ui.gravity.d')}>
        <Orbit on={s.layout.gravity} onChange={(v) => updateSettings({ layout: { gravity: v } })} label={t('ui.gravity')} />
      </Row>
      <Row title={t('ui.layout')} desc={<>{t('ui.layout.d')}{pinned > 0 && <> {tp('ui.layout.pinned', pinned)}.</>}</>}>
        <button
          type="button"
          className="set-btn"
          onClick={() => {
            resetLayout();
            setReset(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setReset(false), 1600);
          }}
        >
          {reset ? t('ui.layout.done') : t('ui.layout.btn')}
        </button>
      </Row>
    </Section>
  );
}

/** "Open in terminal": which app, and what is detected for the live sessions right now. */
function Terminal({ demo }: { demo: boolean }) {
  const choice = useSettings().terminal.app;
  const { live } = useData();
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; precision: 'tab' | 'app' | 'none'; n: number }>();
    for (const s of live?.sessions ?? []) {
      if (!s.alive || !s.terminal) continue;
      const name = s.terminal.name ?? '?';
      const key = `${name}|${s.terminal.precision}`;
      const g = m.get(key) ?? { name, precision: s.terminal.precision, n: 0 };
      g.n++;
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [live]);
  const precision = (p: 'tab' | 'app' | 'none') => t(p === 'tab' ? 'term.set.precision.tab' : p === 'app' ? 'term.set.precision.app' : 'term.set.unreachable');
  return (
    <Section id="terminal" title={t('set.sec.terminal')}>
      <Row title={t('term.set.app')} desc={t('term.set.app.d')} id="term-app">
        <select
          className="set-select"
          value={choice}
          aria-labelledby="term-app"
          onChange={(e) => isTerminalChoice(e.target.value) && updateSettings({ terminal: { app: e.target.value as TerminalChoice } })}
        >
          <option value="auto">{t('term.set.auto')}</option>
          {TERMINAL_APPS.map((a) => (
            <option key={a} value={a}>
              {TERMINAL_NAMES[a]}
            </option>
          ))}
          <option value="off">{t('term.set.off')}</option>
        </select>
      </Row>
      <Row title={t('term.set.now')} desc={t('term.set.now.d')}>
        {demo ? (
          <span className="set-row__desc">{t('term.set.demo')}</span>
        ) : choice === 'off' ? (
          <span className="set-row__desc">{t('term.set.off')}</span>
        ) : groups.length ? (
          <ul className="term-list">
            {groups.map((g) => (
              <li key={`${g.name}|${g.precision}`} className={`term-list__item term-list__item--${g.precision}`}>
                <b>{g.name}</b> · {precision(g.precision)} · <span className="mono">{tp('term.set.sessions', g.n)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="set-row__desc">{t('term.set.none')}</span>
        )}
      </Row>
    </Section>
  );
}

/** "Consider unused after N days" and the hidden recommendations. */
function Recommendations() {
  const r = useSettings().recommendations;
  const [draft, setDraft] = useState(String(r.unusedDays));
  useEffect(() => setDraft(String(r.unusedDays)), [r.unusedDays]);
  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n > 0) updateSettings({ recommendations: { unusedDays: n } });
    else setDraft(String(r.unusedDays));
  };
  return (
    <Section id="recommendations" title={t('set.sec.recommendations')}>
      <Row title={t('rec.set.days')} desc={t('rec.set.days.d')}>
        <label className="set-num">
          <input
            type="number"
            min={RECOMMEND_DAYS.min}
            max={RECOMMEND_DAYS.max}
            step={1}
            value={draft}
            aria-label={t('rec.set.days')}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
          <span>{t('rec.set.daysUnit')}</span>
        </label>
      </Row>
      <Row title={t('rec.set.hidden')} desc={t('rec.set.hidden.d')}>
        {r.dismissed.length ? (
          <button type="button" className="set-btn" onClick={() => updateSettings({ recommendations: { dismissed: [] } })}>
            {t('rec.set.showAll')} · <span className="mono">{fmtInt(r.dismissed.length)}</span>
          </button>
        ) : (
          <span className="set-row__desc">{t('rec.set.hiddenNone')}</span>
        )}
      </Row>
    </Section>
  );
}

/** "«Max · 20×» since Feb 2026" with where it comes from; or why there is none. */
function PlanLine({ plan, demo = false }: { plan: Plan | null; demo?: boolean }) {
  if (!plan || !planLabel(plan)) return <span className="set-plan__none">{t('con.plan.none')}</span>;
  const since = planSince(plan);
  return (
    <span className="set-plan">
      <PlanBadge plan={plan} />
      {since && <span>{t('con.plan.since', { date: since })}</span>}
      <span className="set-dl__how">{t(demo ? 'con.plan.demo' : 'con.plan.src')}</span>
    </span>
  );
}

function Connection({ demo, offline, focus }: { demo: boolean; offline: boolean; focus: boolean }) {
  const a = useAbout();
  const ref = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  // Opened from "how to connect": bring this section into view once its content is there.
  useEffect(() => {
    if (!focus || scrolled.current || (!a && !demo && !offline)) return;
    scrolled.current = true;
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    el.classList.add('set-sec--flash');
    const id = window.setTimeout(() => el.classList.remove('set-sec--flash'), 1800);
    return () => window.clearTimeout(id);
  }, [focus, a, demo, offline]);
  let body: ReactNode;
  if (demo) {
    body = (
      <>
        <p className="set-hint">{t('con.demo')}</p>
        <dl className="set-dl">
          <dt>{t('con.plan')}</dt>
          <dd><PlanLine plan={MOCK_PLAN} demo /></dd>
        </dl>
      </>
    );
  }
  else if (offline || !a) body = <p className="set-hint">{t('con.offline')}</p>;
  else {
    const hooks = a.hooks.pluginEnabled
      ? a.hooks.lastEventAt
        ? t('con.hooks.events', { ago: fmtAgo(a.hooks.lastEventAt) })
        : t('con.hooks.on')
      : a.hooks.eventsReceived
        ? t('con.hooks.eventsOnly')
        : t('con.hooks.off');
    body = (
      <dl className="set-dl">
        <dt>{t('con.version')}</dt>
        <dd className="mono">Clorbit {a.version}</dd>
        {'plan' in a && (
          <>
            <dt>{t('con.plan')}</dt>
            <dd><PlanLine plan={a.plan ?? null} /></dd>
          </>
        )}
        <dt>{t('con.dataDir')}</dt>
        <dd className="mono set-dl__path" title={a.dataDir}>{a.dataDir}</dd>
        <dt>{t('con.hooks')}</dt>
        <dd>
          <i className={`set-led ${a.hooks.pluginEnabled || a.hooks.eventsReceived ? 'on' : ''}`} aria-hidden />
          {hooks}
        </dd>
        <dt>{t('con.limits')}</dt>
        <dd>
          <i className={`set-led ${a.limits.capture ? 'on' : ''}`} aria-hidden />
          {a.limits.capture ? t('con.limits.on', { ago: a.limits.updatedAt ? fmtAgo(a.limits.updatedAt) : '—' }) : t('con.limits.off')}
        </dd>
        {!a.limits.capture && (
          <dd className="set-dl__wide">
            <LimitsHowTo />
          </dd>
        )}
        <dt>{t('con.store')}</dt>
        <dd>
          {a.store.enabled
            ? t('con.store.v', { files: fmtInt(a.store.fileSummaries), archived: fmtInt(a.store.archived), hooks: fmtInt(a.store.hookEvents), limits: fmtInt(a.store.limits) })
            : t('con.store.off')}
        </dd>
      </dl>
    );
  }
  return (
    <div ref={ref} className="set-sec-anchor">
      <Section id="connection" title={t('set.sec.connection')}>
        {body}
      </Section>
    </div>
  );
}

/* ---------------- the panel ---------------- */

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function Panel() {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { status, saveError } = useSettingsState();
  const demo = status === 'demo';
  const offline = status === 'offline';
  const [section] = useState(takeSettingsSection);
  useLang();

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    if (!demo) void loadAbout();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        closeSettings();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const els = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && (document.activeElement === first || !ref.current.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !ref.current.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    // Capture: the galaxy also listens to Esc (one level up) and must not get this one.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [demo]);

  return (
    <div className="setp-layer">
      <div className="setp-backdrop" onMouseDown={() => closeSettings()} aria-hidden />
      <div className="setp" role="dialog" aria-modal="true" aria-labelledby="setp-title" ref={ref}>
        <header className="setp__head">
          <span className="setp__mark" aria-hidden>
            <ProfileGlyph />
          </span>
          <div>
            <h2 id="setp-title">{t('set.title')}</h2>
            <p className={saveError ? 'setp__err' : ''}>
              {saveError ? t('set.saveFailed') : demo ? t('set.subDemo') : offline ? t('set.subOffline') : t('set.sub')}
            </p>
          </div>
          <button type="button" className="setp__close" ref={closeRef} onClick={() => closeSettings()} aria-label={t('set.close')} title={t('set.close')}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="setp__body">
          <Notifications demo={demo} offline={offline} />
          <Sounds />
          <Dnd />
          <Interface />
          <Terminal demo={demo} />
          <Recommendations />
          <Connection demo={demo} offline={offline} focus={section === 'connection'} />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPanel() {
  const open = useSettingsOpen();
  return open ? <Panel /> : null;
}
