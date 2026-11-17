// The last few hundred console-worthy live events in memory (GET /api/events/recent), with
// project and agent names resolved when they happened.
import type { EventContext, RecentEvent } from '../shared/api.ts';
import { localizeEvent, type Lang, type ServerEvent } from './i18n';

export const RECENT_MAX = 500;

/** Events the console shows: tool calls, spawns, finishes, waits, prompts, compactions. */
export function consoleWorthy(e: ServerEvent): boolean {
  if (e.kind === 'text') return false;
  if (e.kind === 'status') return e.status === 'waiting';
  return true;
}

export class RecentEvents {
  private buf: (ServerEvent & EventContext)[] = [];

  constructor(private max = RECENT_MAX) {}

  push(e: ServerEvent, ctx: EventContext) {
    if (!consoleWorthy(e)) return;
    this.buf.push({ ...e, ...ctx });
    if (this.buf.length > this.max) this.buf.splice(0, this.buf.length - this.max);
  }

  /** The newest `limit` events, oldest first, with status reasons in the given language. */
  list(lang: Lang, limit = this.max): RecentEvent[] {
    const n = Math.max(0, Math.min(this.max, Math.floor(limit) || 0));
    return this.buf.slice(this.buf.length - n).map((e) => ({ ...localizeEvent(e, lang), project: e.project, agentName: e.agentName, parentName: e.parentName }) as RecentEvent);
  }

  get size() { return this.buf.length; }
}
