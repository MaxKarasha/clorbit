# Clorbit architecture

Clorbit is two small programs that share one TypeScript contract:

```
~/.claude (read-only)                    ~/.clorbit
  projects/**/<session>.jsonl  ─┐          clorbit.db (SQLite)
  projects/**/subagents/*.jsonl ├─► server/ ──────────────► web/
  sessions/<pid>.json          ─┤  (Node 22, built-ins)  REST + SSE  (Vite + React, canvas)
  settings.json                ─┘          ▲
                                           │ POST /api/hook (optional)
                     plugin/ (Claude Code hooks, async curl)
```

| Folder | What lives there |
| --- | --- |
| `server/` | HTTP server (`index.ts`), scanner, store, SQLite layer, live status, analytics, insights, server-side i18n. Only Node built-ins plus `tsx` to run TypeScript. |
| `web/` | Single-page app: the canvas galaxy (`web/src/galaxy/`), analytics pages (`web/src/pages/`), the i18n runtime and dictionaries (`web/src/i18n/`), demo data (`web/src/mock/`). |
| `shared/api.ts` | The API contract — every type the server returns and the list of endpoints. |
| `plugin/` | The `clorbit` Claude Code plugin — the only folder Claude Code copies into its plugin cache, so everything the plugin runs lives here: `hooks/` (async event hooks and the silent autostart), `skills/clorbit/` (the `/clorbit` command), `app/` (build output, committed: `server.mjs`, `web/`, plus the hand-written `cli.mjs`). |
| `scripts/build.mjs` | `pnpm build`: Vite builds the web app into `plugin/app/web`, esbuild bundles `server/bundle.ts` into `plugin/app/server.mjs`, and the `package.json` version is synced into the plugin manifest. |
| `scripts/install-hooks.mjs` | Optional, dry-run-by-default helper that adds the status-line capture (and, if forced, raw hooks) to `~/.claude/settings.json`. |

## Plugin, CLI and the bundled server

```
SessionStart hook ── node plugin/app/cli.mjs ensure ──► (not running?) spawn detached
/clorbit [cmd]    ── node plugin/app/cli.mjs <cmd>  ──►   node plugin/app/server.mjs
                                                           ├─ main thread: HTTP server, serves ./web
                                                           └─ worker threads: the same file, scanner role
```

- `server/bundle.ts` is the bundle's entry point: the main thread imports `server/index.ts`, worker threads import `server/scan-worker.ts`. The scan pool starts its workers from the bundle file itself, so the bundle stays one file. Build-time constants (`__CLORBIT_BUNDLED__`, `__CLORBIT_VERSION__`) switch the web folder to `./web` next to the bundle and serve it by default.
- `cli.mjs` starts the server with `CLORBIT_PID_FILE` and `CLORBIT_START_LOCK`. The server writes the pid file only after it owns the port and removes the start lock, so sessions that start at the same time never spawn two servers or leave a stale pid. `GET /api/health` identifies a running Clorbit (version, pid, data dir); `stop` only signals a pid that `/api/health` confirms.
- The autostart hook and the event hooks are `async: true` and print nothing, so they never add text to a session's context or delay it. In `claude -p` runs Claude Code kills async hooks at teardown, which is why the server is spawned fully detached.

## Data sources

All of them are read-only:

- **`~/.claude/projects/<project>/<session>.jsonl`** — the main transcript of a session. One JSON record per line: user prompts, assistant messages with `usage`, tool calls and results, attachments (system prompt snapshot, skill listing, MCP instructions, hook output), compaction boundaries, AI-generated titles.
- **`~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl`** plus **`agent-<id>.meta.json`** — one transcript per subagent (including workflow subagents). The meta file holds the agent type, the task description, the spawn depth and the `toolUseId` of the `Agent` call that created it, which links it to its parent.
- **`~/.claude/sessions/<pid>.json`** — live Claude Code processes: pid, session id, cwd, start time. A pid that answers `kill(pid, 0)` means the session is alive.
- **`~/.claude/settings.json`** — enabled plugins (to recognize plugin hooks and to detect the `clorbit` plugin) and `env`.
- **Hook events** (optional) — POSTed by the plugin to `/api/hook`.
- **Status-line capture** (optional) — `~/.clorbit/statusline.json`, the JSON Claude Code passes to the status-line command, which includes subscription rate limits.

## Scanning

`server/scanner.ts` turns one `.jsonl` file into a `FileSummary` (`server/types.ts`):

- Lines are streamed with exact byte offsets (`server/lines.ts`). Huge irrelevant lines (`api-request*`, `file-history-*` blobs) are skipped by prefix without decoding or `JSON.parse`; the duplicate `toolUseResult` copy on user records is cut before parsing.
- Usage is **deduplicated by `requestId`** (fallback `message.id`): Claude Code writes one record per content block of the same API call, each with the same usage. A small ring of recent request ids is enough because duplicates are adjacent.
- Tokens are aggregated into **per-day buckets** (local dates) with per-hour sub-buckets, per-model, per-skill, per-plugin, per-MCP-server/tool and per-tool aggregates, plus per-minute buckets for the last hour (burn rate).
- Tool results are sized by characters (÷ 3.6 ≈ tokens); results over 20K tokens are kept as "big results" for insights. Repeated `Read` of the same path is counted per file.
- **Startup context** is everything attached before the first assistant reply. It is stored under language-neutral keys (`system`, `toolDefs`, `skills`, `mcp`, `deferred`, `agents`, `claudeMd`, `env`, `other`, `hook:plugin:<name>`, `hook:event:<name>`) and rendered per language by the server.
- Hook runs reported in transcripts (`hook_success`, `hook_error`, …) are attributed to plugins by path (`plugins/cache/<marketplace>/<plugin>/`) or by plugin name mentions.
- A `Carry` object keeps the minimal parser state (pending tool calls, recent request ids, last tool/text, context size), so parsing can **resume from the last byte offset** when a transcript grows. Tests assert that a file read in several chunks gives the same summary as a full parse.

The cold scan runs on a pool of worker threads (`server/scan-worker.ts`), freshest files first, so live sessions appear quickly. HTTP answers while the scan runs; the web shows a progress banner.

## Caching and SQLite

`server/db.ts` wraps one SQLite file (`node:sqlite`, WAL mode) with versioned, append-only migrations:

- **`file_summaries`** — one row per transcript: path, session/agent ids, size, mtime, byte offset, the summary as JSON, and `missing_since`. On start, all summaries of the current `SUMMARY_VERSION` are loaded into memory (a warm start takes tens of milliseconds); only files whose size or mtime changed are re-read, from their stored offset.
- **`hook_events`** — trimmed hook payloads (top-level scalars, a shallow `tool_input` with short strings, only the size of `tool_response`; at most 4 KB), pruned after **90 days**.
- **`limits`** — a row whenever the captured subscription percentages change (polled every 30 s).

Writes are batched and flushed in the background; `GET /api/debug/db` shows row counts, file sizes and flush stats.

### Archiving

Claude Code deletes transcripts older than 30 days by default. When a known transcript disappears from disk, Clorbit keeps its summary and sets `missing_since` instead of deleting it. Analytics, sessions and insights keep counting that history. For an archived session the detail view has the summary, the agent tree, startup context and tools, but no timeline or token series (`SessionDetail.archived = true`), because those are parsed on demand from the transcript itself.

Analytics are computed in memory from the summaries and memoized per store version, range and language.

## Live status heuristics

`server/live.ts` builds the live snapshot every request (cached for 500 ms) and runs a 2-second tick that compares statuses and broadcasts changes over SSE. Transcripts are watched with recursive `fs.watch`, with a 3-second polling fallback for live sessions and a 60-second re-listing for missed files.

Without hooks, a session's status (`server/tree.ts`) is inferred:

- no live process → **stopped**;
- a tool call without a result for more than 10 s while nothing else was written (and the permission mode is not `bypassPermissions`) → **waiting** ("probably waiting for permission");
- a pid status mentioning wait/permission/input → **waiting**;
- a record within the last 20 s, working subagents, or pending tool calls → **working**;
- the last stop reason is `end_turn` → **idle** ("answer ready").

A subagent is **finished** when its meta says so, the session is gone, it ended its turn with nothing pending, or it has been quiet for 10 minutes with nothing pending (30 minutes in any case).

With the hooks plugin installed, hook events (`Notification`, `PermissionRequest`, `Stop`, `PreToolUse`, …) set the status directly; they win over the heuristic as long as the transcript is not newer than the last hook event.

Status reasons are stored as language-neutral codes (`server/i18n.ts`) and rendered per request (`/api/live?lang=…`) and per SSE client (`/api/events?lang=…`).

## Hooks

The plugin (`plugin/hooks/hooks.json`) registers one command for SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, Notification, Stop, SubagentStart, SubagentStop, PreCompact and SessionEnd. Every hook is `async: true` and runs `plugin/hooks/send.sh`, which pipes the payload to `curl` with a 0.3 s connect timeout and a 1 s total timeout and always exits 0. When the server is down, the hook is a no-op.

On the server, `server/hooks.ts` turns payloads into live events and statuses, and `server/hook-log.ts` stores them and derives **wait intervals** (from a permission request or a "waiting for input" notification to the next activity; a single wait is capped at 6 h) for the "you kept agents waiting" insight.

`hooksInstalled` in the live snapshot is true when `clorbit@*` (or the legacy `fleet-hooks@*`) is enabled in `settings.json`, or when hook events have already arrived.

## API contract

All types are in [`shared/api.ts`](../shared/api.ts). Every GET accepts `lang=en|uk` (default `en`); human-readable server text follows it.

| Endpoint | Returns |
| --- | --- |
| `GET /api/live` | `LiveSnapshot`: live and recent sessions with agent trees, totals, limits, scan progress. |
| `GET /api/events` | Server-sent events, one `ClorbitEvent` per message (tool, spawn, finish, status, text, prompt, compact). |
| `GET /api/analytics/overview?from&to` | `AnalyticsOverview`: totals, daily series, projects, models, hourly profile, heatmap. |
| `GET /api/analytics/attribution?from&to` | `AttributionReport`: skills, plugins, MCP servers/tools, tools, subagent types, startup context. |
| `GET /api/analytics/sessions?from&to&project` | `SessionSummary[]`. |
| `GET /api/session/:id` | `SessionDetail`: summary, full tree, timeline, startup context, tools, token series. |
| `GET /api/insights?from&to` | `Insight[]` with severity, evidence, fix and estimated savings. |
| `GET /api/limits/history?from&to` | `LimitsPoint[]`. |
| `GET /api/debug/scan`, `GET /api/debug/db` | Diagnostics. |
| `POST /api/hook` | Accepts a Claude Code hook payload. |

Dates are local `YYYY-MM-DD`, timestamps are epoch milliseconds.

## Internationalization

- **Web:** `web/src/i18n/index.ts` is a tiny runtime: `t(key, params)`, `tp(key, n)` for plurals (forms separated by `|`), `useLang()`, `setLang()`. Dictionaries are split by area (`core`, `galaxy`, `pages`, `mock`) in `web/src/i18n/en/` and `web/src/i18n/uk/`; the Ukrainian files are type-checked against the English keys. The language comes from `?lang=`, then `localStorage`, then English. Every API request carries `lang`.
- **Server:** `server/i18n.ts` (status reasons, startup-context labels, timeline labels, errors) and `server/insights-text.ts` (insight wording). The server picks the language from the `lang` query parameter.

Adding a language means adding a dictionary folder on the web, a column in the server dictionaries, and the language code to `Lang`.

## Data source in the web app: live, offline, demo

- **Live** is the only default. The galaxy polls `/api/live` every 3 s and listens to `/api/events`; analytics pages go through `apiGet`/`useApi` in `web/src/lib/api.tsx`, and `DataProvider` polls `/api/live` for the scan state.
- **Offline.** A network error, a 502/503/504 from the dev proxy, or HTML instead of JSON marks the server as unreachable. Nothing is substituted: the galaxy replaces its HUD numbers and panels with a full-screen "server isn't running" state, and the analytics layout renders the same state (`web/src/components/ServerState.tsx`) instead of the page. Both retry every few seconds (and on Retry); the first successful response clears the state, reloads page data and reopens the event stream, without a reload.
- **Demo** is explicit only: `demo=1` (alias `mock=1`; `mock=scan` adds a running history scan) in the hash query or the page URL, set by the "Try the demo" buttons on the offline screen and on an empty galaxy. `web/src/lib/demo.ts` reads and toggles it; the param is sticky in `href()` (`web/src/lib/router.ts`), so it survives navigation. In demo mode `apiGet` answers from `web/src/mock/` and the galaxy runs `MockFeed` (`web/src/galaxy/mock.ts`); every screen shows a "Demo data — fictional" strip with "Show my data", which removes the param. The galaxy is remounted when the mode changes, so no star from one source lingers in the other.

## Privacy model

- The server binds to `127.0.0.1` only and has no authentication — anything on your machine can read it, nothing outside can.
- Clorbit never writes to `~/.claude`. The only code that can is `scripts/install-hooks.mjs`, which is a dry run unless you pass `--apply`, and backs up `settings.json` first.
- Clorbit's own data lives in `~/.clorbit` (`CLORBIT_DATA_DIR`). The one-time copy of a pre-rename `<repo>/data/fleet.db` (`migrateLegacyDb` in `server/config.ts`) only targets the default folder; an explicitly set data dir always starts empty. Transcript content is not copied wholesale: summaries hold counts, labels (tool labels such as `Read index.ts` or the first 40 characters of a Bash command), session titles, the latest assistant text (≤ 240 chars) and file paths of repeated reads. Hook payloads are trimmed as described above.
- There is no telemetry and no network access besides the Google Fonts stylesheet in `web/index.html`.
