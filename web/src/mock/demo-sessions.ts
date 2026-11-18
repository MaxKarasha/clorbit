// Demo galaxy sessions (MockFeed) register what a demo replay needs to look like them: project, title, model.
// A tiny module of its own, so the galaxy feed and the replay generator do not import each other.
export interface DemoSessionMeta { project: string; title: () => string | null; model: string | null; effort: string | null; alive: boolean }

export const demoSessions = new Map<string, DemoSessionMeta>();

/** Demo agent id → agent type, so demo "changes" can tell agents that only look around from ones that edit. */
export const demoAgentTypes = new Map<string, string>();
