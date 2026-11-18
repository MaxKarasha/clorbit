// Demo galaxy sessions (MockFeed) register what a demo replay needs to look like them: project, title, model.
// A tiny module of its own, so the galaxy feed and the replay generator do not import each other.
export interface DemoSessionMeta { project: string; title: () => string | null; model: string | null; effort: string | null; alive: boolean }

export const demoSessions = new Map<string, DemoSessionMeta>();
