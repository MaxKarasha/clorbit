// Intake of Claude Code hook events (POST /api/hook). Active only when the user installed the hooks plugin.
import type { SessionStatus } from '../shared/api.ts';
import type { Reason, ServerEvent } from './i18n';
import { toolLabel } from './util';

export interface HookStatus { status: SessionStatus; reason: Reason | null; ts: number }

export class Hooks {
  installed = false;
  recent: { ts: number; event: string; sessionId: string | null; tool: string | null }[] = [];
  bySession = new Map<string, HookStatus>();

  /** Takes a hook's JSON payload and returns the events that clearly follow from it. */
  ingest(body: any): ServerEvent[] {
    if (!body || typeof body !== 'object') return [];
    this.installed = true;
    const ts = Date.now();
    const ev = String(body.hook_event_name ?? body.hookEventName ?? '');
    const sessionId = body.session_id ? String(body.session_id) : null;
    const tool = body.tool_name ? String(body.tool_name) : null;
    this.recent.push({ ts, event: ev, sessionId, tool });
    if (this.recent.length > 500) this.recent.splice(0, this.recent.length - 500);
    if (!sessionId) return [];
    const agentId = body.agent_id ? String(body.agent_id) : 'main';
    const out: ServerEvent[] = [];
    const setStatus = (status: SessionStatus, reason: Reason | null) => {
      const prev = this.bySession.get(sessionId);
      this.bySession.set(sessionId, { status, reason, ts });
      if (!prev || prev.status !== status || JSON.stringify(prev.reason) !== JSON.stringify(reason)) out.push({ kind: 'status', ts, sessionId, status, reason });
    };
    switch (ev) {
      case 'SessionStart': setStatus('idle', { k: 'sessionStarted' }); break;
      case 'UserPromptSubmit': out.push({ kind: 'prompt', ts, sessionId }); setStatus('working', { k: 'gotPrompt' }); break;
      case 'PreToolUse':
        if (tool) out.push({ kind: 'tool', ts, sessionId, agentId, tool, label: toolLabel(tool, body.tool_input) });
        if (agentId === 'main') setStatus('working', tool ? { k: 'running', a: toolLabel(tool, body.tool_input) } : { k: 'working' });
        break;
      case 'PostToolUse': if (agentId === 'main') setStatus('working', { k: 'working' }); break;
      case 'Notification': {
        const msg = String(body.message ?? '');
        const type = String(body.notification_type ?? '');
        const m = /permission to use ([\w:.-]+)/i.exec(msg);
        if (type === 'idle_prompt' || /waiting for your input/i.test(msg)) setStatus('waiting', { k: 'waitingInput' });
        else setStatus('waiting', m ? { k: 'waitingPermission', a: m[1] } : { k: 'waitingYou' });
        break;
      }
      case 'PermissionRequest': setStatus('waiting', tool ? { k: 'waitingPermission', a: tool } : { k: 'waitingPermissionAny' }); break;
      case 'Stop': setStatus('idle', { k: 'answerReady' }); break;
      case 'SubagentStart':
        out.push({ kind: 'spawn', ts, sessionId, parentId: 'main', agentId, agentType: String(body.agent_type ?? 'general-purpose'), description: null });
        break;
      case 'SubagentStop': out.push({ kind: 'finish', ts, sessionId, agentId, parentId: 'main', tokens: 0 }); break;
      case 'PreCompact': out.push({ kind: 'compact', ts, sessionId }); break;
      case 'SessionEnd': setStatus('stopped', { k: 'sessionEnded' }); break;
    }
    return out;
  }
}
