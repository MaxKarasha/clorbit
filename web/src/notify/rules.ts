// Which channels an event goes to, and its text. Pure functions (tested in notify.test.ts).
import type { NotifyEventType, Settings } from '@shared/api';
import type { NotifyEvent } from '@shared/notify';
import { isSilenced } from '@shared/settings';
import { t, type MsgKey } from '../i18n';

export interface ChannelContext {
  now: number;
  demo: boolean;
  /** document.hidden */
  hidden: boolean;
  /** Notification.permission, or 'unsupported'. */
  permission: NotificationPermission | 'unsupported';
  /** The server can show system notifications (then a system-enabled event skips the browser one). */
  systemAvailable: boolean;
}

export interface Channels { sound: boolean; browser: boolean; toast: boolean }

export function channelsFor(type: NotifyEventType, s: Settings, c: ChannelContext): Channels {
  const r = s.notifications[type];
  const silent = isSilenced(s, c.now);
  return {
    toast: r.toast,
    sound: r.sound && s.sound.enabled && !silent,
    browser:
      r.browser &&
      !silent &&
      !c.demo &&
      c.permission === 'granted' &&
      !(r.system && c.systemAvailable) &&
      (!r.browserHiddenOnly || c.hidden),
  };
}

/** The body of a notification or toast in the UI language. */
export function notifyBody(ev: NotifyEvent): string {
  const p = ev.project ?? '';
  const agent = ev.agentType || t('nb.subagent');
  switch (ev.type) {
    case 'session_waiting':
      if (ev.wait === 'input') return t('nb.waitInput', { p });
      if (ev.wait === 'permission') return ev.tool ? t('nb.waitPermissionTool', { p, tool: ev.tool }) : t('nb.waitPermission', { p });
      return t('nb.waitYou', { p });
    case 'session_done':
      return t('nb.done', { p });
    case 'subagent_finished':
      return (ev.count ?? 1) > 1 ? t('nb.finishedMany', { p, n: ev.count! }) : t('nb.finished', { p, agent });
    case 'subagent_spawned':
      return t('nb.spawned', { p, agent });
    case 'compaction':
      return t('nb.compaction', { p });
    case 'context_high':
      return t('nb.contextHigh', { p, pct: ev.pct ?? 85 });
    case 'limit_high':
      return t('nb.limitHigh', { w: t(ev.window === '7d' ? 'nb.w7d' : 'nb.w5h'), pct: ev.pct ?? 80 });
  }
}

export const eventLabel = (type: NotifyEventType) => t(`ntf.ev.${type}` as MsgKey);

/** Accent color per event; orange is reserved for "waiting for you". */
export const EVENT_COLOR: Record<NotifyEventType, string> = {
  session_waiting: '#ffb15c',
  session_done: '#4fe0b0',
  subagent_finished: '#5cc8ff',
  subagent_spawned: '#a78bfa',
  compaction: '#6b7cff',
  context_high: '#ff6fb0',
  limit_high: '#e6e36a',
};

// ---------- toasts ----------

export interface Toast {
  id: number;
  type: NotifyEventType;
  sessionId: string | null;
  ev: NotifyEvent;
  createdAt: number;
  /** Waiting toasts stay until the session stops waiting or the toast is dismissed. */
  sticky: boolean;
}

export const TOAST_MS = 7000;
export const MAX_TOASTS = 4;
/** Finished subagents of one session within this window merge into one toast. */
export const MERGE_MS = 4000;

/** Adds an event to the toast stack: merges bursts, replaces an older wait of the same session, caps the stack. */
export function pushToast(list: Toast[], ev: NotifyEvent, id: number, now: number): Toast[] {
  if (ev.type === 'subagent_finished') {
    const i = list.findIndex((x) => x.type === 'subagent_finished' && x.sessionId === ev.sessionId && now - x.createdAt < MERGE_MS);
    if (i >= 0) {
      const cur = list[i];
      const merged: Toast = { ...cur, createdAt: now, ev: { ...cur.ev, count: (cur.ev.count ?? 1) + (ev.count ?? 1) } };
      return [merged, ...list.slice(0, i), ...list.slice(i + 1)];
    }
  }
  const rest = ev.type === 'session_waiting' ? list.filter((x) => !(x.type === 'session_waiting' && x.sessionId === ev.sessionId)) : list;
  const next = [{ id, type: ev.type, sessionId: ev.sessionId, ev, createdAt: now, sticky: ev.type === 'session_waiting' }, ...rest];
  if (next.length <= MAX_TOASTS) return next;
  // Drop the oldest non-sticky toast first.
  const drop = [...next].reverse().find((x) => !x.sticky) ?? next[next.length - 1];
  return next.filter((x) => x !== drop);
}

/** Removes expired toasts and the waits that were resolved. */
export function pruneToasts(list: Toast[], now: number, resolved: string[] = []): Toast[] {
  return list.filter((x) => (x.sticky ? !(x.sessionId && resolved.includes(x.sessionId)) : now - x.createdAt < TOAST_MS));
}
