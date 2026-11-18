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
| `server/` | HTTP server (`index.ts`), scanner, store, SQLite layer, live status, analytics, insights, settings (`settings.ts`), system notifications (`notifier.ts`), recent-events ring (`recent-events.ts`), server-side i18n. Only Node built-ins plus `tsx` to run TypeScript. |
| `web/` | Single-page app: the canvas galaxy (`web/src/galaxy/`), analytics pages (`web/src/pages/`), notifications and sounds (`web/src/notify/`), the event console (`web/src/console/`), the settings panel (`web/src/components/SettingsPanel.tsx`), the i18n runtime and dictionaries (`web/src/i18n/`), demo data (`web/src/mock/`). |
| `shared/` | `api.ts` — the API contract: every type the server returns, the list of endpoints, `DEFAULT_SETTINGS`. `settings.ts` — settings validation and quiet-hours math. `notify.ts` — the notification detector. `forecast.ts` — the subscription-limit forecast. `replay.ts` — the session-replay model (time machine) and the export time map. Used by both sides. |
| `plugin/` | The `clorbit` Claude Code plugin — the only folder Claude Code copies into its plugin cache, so everything the plugin runs lives here: `hooks/` (async event hooks and the silent autostart), `skills/clorbit/` (the `/clorbit` command), `app/` (build output, committed: `server.mjs`, `web/`, plus the hand-written `cli.mjs` and `statusline.mjs`, the status-line capture shared with `scripts/install-hooks.mjs`). |
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
- **Status-line capture** (optional) — `~/.clorbit/statusline.json`, the JSON Claude Code passes to the status-line command, which includes subscription rate limits. When it reports the 7-day window but no 5-hour one, `Limits.fiveHourWindow` is `'none'` (plans with only a weekly limit, e.g. Ultra); the 5 h forecast then has `noWindow: true` and basis `none`, and no 5 h notifications fire. A 5-hour reading switches it back.
- **`~/.claude.json`** (read-only, `CLORBIT_CLAUDE_JSON`; next to the Claude dir by default) — only the plan fields of `oauthAccount` (`planDisplayName`, `organizationType`, the rate-limit tiers, `subscriptionCreatedAt`) are read by `server/plan.ts` (cached by mtime) and returned as `Plan` (`LiveSnapshot.plan`, `AboutInfo.plan`); `server/mcp-config.ts` reads the names (only) of MCP servers configured there (`mcpServers`, `projects[<folder>].mcpServers`) and in a project's `.mcp.json`, so a recommendation can name the right command; nothing else from that file is logged, stored or returned. `shared/plan.ts` holds a small plan → windows table (Ultra: no 5-hour window) that the UI uses only until the status line reports; data always wins.

## Scanning

`server/scanner.ts` turns one `.jsonl` file into a `FileSummary` (`server/types.ts`):

- Lines are streamed with exact byte offsets (`server/lines.ts`). Huge irrelevant lines (`api-request*`, `file-history-*` blobs) are skipped by prefix without decoding or `JSON.parse`; the duplicate `toolUseResult` copy on user records is cut before parsing.
- Usage is **deduplicated by `requestId`** (fallback `message.id`): Claude Code writes one record per content block of the same API call, each with the same usage. A small ring of recent request ids is enough because duplicates are adjacent.
- Tokens are aggregated into **per-day buckets** (local dates) with per-hour sub-buckets, per-model, per-skill, per-plugin, per-MCP-server/tool and per-tool aggregates, plus per-minute buckets for the last hour (burn rate).
- Tool results are sized by characters (÷ 3.6 ≈ tokens); results over 20K tokens are kept as "big results" for insights. Repeated `Read` of the same path is counted per file.
- **Startup context** is everything attached before the first assistant reply. It is stored under language-neutral keys (`system`, `toolDefs`, `skills`, `mcp`, `deferred`, `agents`, `claudeMd`, `env`, `other`, `hook:plugin:<name>`, `hook:event:<name>`) and rendered per language by the server. The skill listing is also split per plugin (`skillsByPlugin`) and per skill (`skillsByName`, `plugin:skill` or an own skill's name; summary v6+), which the recommendations use. Since v7 a summary also keeps, for the startup: MCP tool definitions per server (`mcpToolDefs`, from the prompt snapshot) and deferred tool entries per server (`mcpToolNames`; with tool search only names are listed), instruction files by path with their memory type (`memoryFiles`: CLAUDE.md, CLAUDE.local.md, rules, the auto-memory index); and at any time servers reported as failed to connect or needing sign-in (`mcpIssues`, from the deferred-tools attachments) and tool results flagged as errors (`ToolAgg.err`, not counting the user declining a call). Since v8: errors by kind (`ToolAgg.errKinds`, `ERROR_KINDS` in `scanner.ts`; a Bash error is the command's own exit unless Claude Code refused the call), how subagents ended (`SpawnInfo.res` from the Agent call's result; `taskEnds` by task id from `<task-notification>` lines of background tasks), and from the subagent meta `builtIn` and `launchModel`.
- Hook runs reported in transcripts (`hook_success`, `hook_error`, …) are attributed to plugins by path (`plugins/cache/<marketplace>/<plugin>/`) or by plugin name mentions.
- A `Carry` object keeps the minimal parser state (pending tool calls, recent request ids, last tool/text, context size), so parsing can **resume from the last byte offset** when a transcript grows. Tests assert that a file read in several chunks gives the same summary as a full parse.

The cold scan runs on a pool of worker threads (`server/scan-worker.ts`), freshest files first, so live sessions appear quickly. HTTP answers while the scan runs; the web shows a progress banner.

## Caching and SQLite

`server/db.ts` wraps one SQLite file (`node:sqlite`, WAL mode) with versioned, append-only migrations:

- **`file_summaries`** — one row per transcript: path, session/agent ids, size, mtime, byte offset, the summary as JSON, and `missing_since`. On start, all summaries from `MIN_SUMMARY_VERSION` to the current `SUMMARY_VERSION` are loaded into memory; older-version rows whose transcript is still on disk are re-parsed by the next scan, archived ones keep their old summary (so fields added since `MIN_SUMMARY_VERSION` are optional) (a warm start takes tens of milliseconds); only files whose size or mtime changed are re-read, from their stored offset.
- **`hook_events`** — trimmed hook payloads (top-level scalars, a shallow `tool_input` with short strings, only the size of `tool_response`; at most 4 KB), pruned after **90 days**.
- **`limits`** — a row whenever the captured subscription percentages or reset times change (polled every 30 s).
- **`settings`** (schema v2) — `key`, `value_json`, `updated_at`; one row (`app`) holds the whole `Settings` document. It is always read through `normalizeSettings` (`shared/settings.ts`), so unknown keys are dropped and values clamped, and a corrupt row falls back to the defaults.

Writes are batched and flushed in the background; `GET /api/debug/db` shows row counts, file sizes and flush stats.

### Archiving

Claude Code deletes transcripts older than 30 days by default. When a known transcript disappears from disk, Clorbit keeps its summary and sets `missing_since` instead of deleting it. Analytics, sessions and insights keep counting that history. For an archived session the detail view has the summary, the agent tree, startup context and tools, but no timeline or token series (`SessionDetail.archived = true`), because those are parsed on demand from the transcript itself.

Analytics are computed in memory from the summaries and memoized per store version, range and language.

## Subscription-limit forecast

`shared/forecast.ts` (pure, unit-tested) forecasts each window from the limits history plus the latest reading: the series is split into windows where the reset time moves or the % drops, and only the current window counts. Basis `limits`: a recency-weighted linear regression (half-life 30 min for 5 h, 48 h for 7 d), when the window has ≥ 3 points over ≥ 10 min (5 h) / 2 h (7 d). Basis `tokens`: with ≥ 2 points but too little spread, the % gained between them divided by the weighted transcript tokens spent in the same interval (`TOKEN_WEIGHTS`), times the token rate of the last 30 min / 3 h. Otherwise `none`. The projection starts at the latest reading, or at now when the reading is stale (the status line is silent while Claude Code is idle). Output per window: `pct`, `resetsAt`, `ratePerHour`, `hitsAt` (null = lasts until the reset), `pctAtReset` (capped at 100), `confidence`, `basis`, plus `exhausted` / `reset` flags.

`server/limits-forecast.ts` feeds it: `LimitsForecaster` reads 8 days of history from SQLite and builds non-overlapping usage buckets (hourly aggregates up to an hour ago, per-minute burn after that), cached until the reading changes or 15 s pass. `Live.forecast` puts the result into every snapshot (`limitsForecast`); `GET /api/limits/forecast` returns the same. The notification detector raises `limit_forecast` once per 5 h window (identified by its reset time, ±10 min) when `forecastWarns` holds: it runs out > 20 min before the reset with medium or high confidence.

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

### Interactive vs automated sessions

Every `claude -p` run from a script or CI, every Agent SDK query and every scheduled routine is its own session, so one project can have hundreds a day. `shared/automation.ts` classifies a session as `automated` from what Claude Code writes itself:

- `entrypoint` on transcript records and in `sessions/<pid>.json`: `cli` for the interactive terminal; `claude -p` turns it into `sdk-cli`, the SDKs write `sdk-ts` / `sdk-py`, the GitHub Action `claude-code-github-action`, `claude mcp serve` `mcp`;
- `kind` in `sessions/<pid>.json`: `daemon` / `daemon-worker` are automated (`interactive` and `bg` are not);
- the first user prompt's `turnOrigin` / `promptSource` (`sdk`, `scheduled`) when no entrypoint says `cli`.

The scanner keeps the first `entrypoint` and the first prompt's origin in `FileSummary`. Summaries written by 0.2.0 lack them; `Live.kindOf()` then reads the first 64 KB of the transcript once and caches the result, so no rescan is needed. `LiveSession.kind` / `entrypoint` and `EventContext.automated` carry the result (additive). Unless `interface.showAutomated` is on, the notification detector ignores automated sessions (its `includeAutomated` callback reads the setting on every decision, on the server and in the web).

Status reasons are stored as language-neutral codes (`server/i18n.ts`) and rendered per request (`/api/live?lang=…`) and per SSE client (`/api/events?lang=…`).

## Hooks

The plugin (`plugin/hooks/hooks.json`) registers one command for SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, Notification, Stop, SubagentStart, SubagentStop, PreCompact and SessionEnd. Every hook is `async: true` and runs `plugin/hooks/send.sh`, which pipes the payload to `curl` with a 0.3 s connect timeout and a 1 s total timeout and always exits 0. When the server is down, the hook is a no-op.

On the server, `server/hooks.ts` turns payloads into live events and statuses, and `server/hook-log.ts` stores them and derives **wait intervals** (from a permission request or a "waiting for input" notification to the next activity; a single wait is capped at 6 h) for the "you kept agents waiting" insight.

`hooksInstalled` in the live snapshot is true when `clorbit@*` (or the legacy `fleet-hooks@*`) is enabled in `settings.json`, or when hook events have already arrived.

## Galaxy layout

`web/src/galaxy/plan.ts` (pure, unit-tested) decides what is drawn: live interactive sessions are stars; a project's sessions without a live process fold into one cluster (a lone asleep interactive session stays a dim star); automated sessions fold even while running unless `showAutomated` is on; focused and revealed sessions are pinned as stars. Above `MAX_BODIES` (24) stars + clusters, the least active projects fold their idle stars — automated ones first, least recently active first, only as many as needed; working and waiting sessions are never folded.

`GalaxyEngine.layout()` puts a project's bodies (cluster first, then stars by start time) on a ring whose radius (`ringRadius`) keeps neighbours from overlapping; each project's footprint is a disc. Where the discs go:

- **Classic** (gravity off, and the starting point of new groups): a sunflower spiral in name order; `relaxGroups` pushes overlapping discs apart inside the screen, deterministically, so positions only change when membership does.
- **Gravity** (`web/src/galaxy/gravity.ts`, pure, unit-tested; `Settings.layout.gravity`, on by default): every group keeps an anchor (its last target). Groups with a working or waiting session (pull 1 / 2) are placed in order — waiting first, then by distance to the centre, then name — at the first free spot on the ray from the centre towards their anchor (`firstFree`), unless they are already central (inside the centre region, or packed against a body that is) and free. Everything else keeps its anchor; `relaxGroups` with fixed discs then pushes only overlapped idle groups outward. The pass is repeated to a fixed point, so feeding the result back gives the same targets and polls never make things wander.
- **Pins** (`Settings.layout.pins`): a dragged star or cluster sits at its pin (fractions of the canvas, so screen-independent), is excluded from its group's ring, keeps its session a star (`planGalaxy`'s `pinned`), and is a fixed obstacle for both steps above. Keys are `star:<project>:<sessionId>` and `cluster:<project>`; the server validates and clamps them (`normalizePins`, at most 64, the map is replaced as a whole on PUT); the web drops pins of sessions that left the snapshot once the history scan is done.

Drawn group centres follow their targets on a critically damped spring (≈ 15 s for waiting, 22 s for working, 26 s for idle groups pushed aside; instant with reduce motion), and bodies follow their group or pin. A press on a star or cluster that moves more than 5 px drags it (and pins it on release); a press on empty space pans. **Edge indicators** (`web/src/galaxy/edge.ts`, pure): the HUD cuts the view (status bar and breadcrumbs from the top, the side panel from the right, the console from the bottom); each project with an active body outside it gets one chip where the line from the view's centre leaves it, stacked per side around the ticker, zoom controls and toasts; a click focuses that body. Labels are placed after all bodies, by priority (hovered, waiting, a project's primary star, clusters, the rest): each tries below, above, right and left of its body, avoiding other labels and bodies; secondary labels of crowded projects appear only from zoom 1.6 or on hover, and all labels fade instead of popping.

## Time machine (session replay)

`GET /api/session/:id/replay` (`server/replay.ts`, LRU like the session detail) reads a session's transcripts into a time-ordered `ReplayEvent[]`. Lines are classified from their first bytes: service records and attachments are skipped, tool results are never `JSON.parse`d (only their `tool_use_id`, `timestamp` and the trailing `permissionDecision` are picked out); transcripts are read four at a time. Subagents are linked to their parents through `meta.toolUseId` (`buildTree`); a spawn is the parent's Agent call, a return is the subagent's last record. Status changes: a prompt → working, `end_turn` → idle ("answer ready"), and waits — a tool result whose permission decision came from the user (`source: user_*`), `AskUserQuestion` / `ExitPlanMode` until their result, or, without a recorded decision, nothing written for > 10 s after a call (dropped while another agent was busy). Archived files contribute spawns, returns and their hourly token buckets. The list is capped at 20,000 events (`capReplayEvents`).

`shared/replay.ts` is pure and unit-tested: `normalizeReplayEvents` (stable order — same timestamp: spawn first, finish last; a spawn never after its agent's first activity, a finish never before its last), `replayStateAt(replay, t)` (fold of every event with `ts <= t`: agents, tokens, context, status, counters), `replayTree` (unfinished agents plus finished ones with unfinished descendants, each under its nearest spawned ancestor), `replaySession` (a `LiveSession` for the engine), `ReplayCursor` (forward moves apply only the events in between and return them; backward moves refold), `buildTimeMap` (idle-gap compression for "auto": gaps over 30 s keep 30 s plus a saturating ≤ 6 s, monotonic and invertible), `extractMarkers`, `densityBins`.

On the web, `#/replay/:id` (`web/src/galaxy/ReplayPage.tsx`) runs its own `GalaxyEngine` in replay mode (one system, framed by the camera, no dragging or pins, seeded randomness) and a `ReplayPlayer` (`replay-player.ts`): playing forward syncs the engine with the new state, so births, flashes and returns animate as they do live; seeks, steps and big jumps call `resetScene()` and rebuild the moment at once. The console gets the replayed events (with their original timestamps); the timeline (`Scrubber.tsx`) draws density and markers on a canvas and moves its playhead every frame without React. Because the scene at t depends only on the events and t, a recorder can step the player deterministically (video export). Demo mode generates a seeded replay per session id (`web/src/mock/replay.ts`).

### Agent changes

`server/changes.ts` answers "what did this agent change?". A `ChangesSink` reads one transcript with `readLines`: assistant records are parsed for `tool_use` blocks (Edit / MultiEdit / Write / NotebookEdit become pending changes, with line counts and previews computed at once, so the raw inputs are not kept) and texts; user records with tool results are matched by `tool_use_id` — lines under 64 KB are parsed, larger ones byte-scanned for `"tool_use_id":"`, `"is_error":true` and the timestamp before the `toolUseResult` copy (inside JSON strings quotes are escaped, so those patterns only match real keys). A change counts only when its result is not an error; Write's `toolUseResult.type` tells created from overwritten. Line counts: common prefix and suffix are trimmed, then an LCS (when old × new ≤ 250,000 lines) counts the rest; Write and NotebookEdit count added lines only. Caps applied while parsing: 200 steps, 8 previews per file, 40 lines per preview, 200 characters per line, 2,000 pending calls. Sinks are cached per transcript (32) and resumed from their byte offset when the file grows (re-read when it shrinks), so a live agent costs only its new lines. Paths are made relative to the session's (or subagent's) `cwd`, else `~/…` or the last three segments. On the web, `web/src/galaxy/AgentChanges.tsx` refetches when the focused agent's `lastActivity` / `toolCalls` / status change in the snapshot (at most every 1.5 s, one request in flight); demo data comes from `web/src/mock/changes.ts` (seeded by the ids; the step feed slides with time).

### Video export

`web/src/galaxy/export/` turns a replay into a clip; the dialog (`ExportDialog.tsx`) and the encoders are a lazy chunk loaded when "Export video" is opened.

- `plan.ts` (pure) — `planExport(replay, settings)`: the output size and fps (`layout.ts` presets: 1920×1080, 1280×720, 1080×1080, 1080×1920 at 30 fps; GIF at most 720 px wide at 15 fps), the time map, the frame schedule and the captions. The time map is `buildTargetMap` (`shared/replay.ts`): idle gaps compressed as in "auto", then the compressed axis warped into the target length — 240 bins, each weighted 0.4 + 0.6·min(3, √(activity / mean)) after a box filter, so busy stretches get more time and the speed changes smoothly (at most 5.5× between bins); monotonic and invertible; a run already shorter than the target is returned unchanged. `frameSchedule`: frame i is at video time i/fps, with a title phase (original time frozen at the start), the run (`map.toReal`) and a tail (end card or a 1 s hold); WebCodecs timestamps are exact integer µs. Captions (spawn, return, wait start) are placed on the video axis and thinned to one per 550 ms (a wait wins).
- `layout.ts` (pure) — the logical canvas (short side ≤ 600 units, scaled to the output, so 720p, 1080p and vertical clips share proportions), safe margins per aspect (16:9: 5 % / 6 %; 1:1: 6 %; 9:16: 6 % sides, 12 % top, 18 % bottom), overlay boxes, and `fitSystem` (the camera that fits the system's outer radius into the free box, keeping room for the star's label).
- `anonymize.ts` (pure) — `anonymizeReplay`: project → `project`, session id → `session`, title/cwd/prompt/text/agent task dropped, tool labels → tool names (`toolNameOf`: `Read`, `Bash`, `server · tool`, `Agent → <type>`; anything path-, file- or URL-like → `tool`), agent types kept only when they match `^[A-Za-z][\w:-]{0,39}$`, wait reasons dropped and their argument reduced to a tool name, agent ids renumbered. Timestamps, tokens, models and structure are untouched, so the clip moves exactly like the original.
- `run.ts` — `FrameRenderer`: a `GalaxyEngine` constructed with `{ manual: { width, height, scale } }` (no listeners, no resize observer, no animation loop) in replay mode with seeded randomness and `setFraming(layout.system)`; for every frame it calls `engine.renderAt(i / fps, prepare)`, where `prepare` moves a `ReplayCursor` to the frame's original time and syncs the engine (snapping on the first frame or a big jump, animating otherwise), then `overlays.ts` draws the cards, clock, counters and captions into the same canvas. The engine's clock (`T`, the ambient clock, springs and fades) only advances through `renderAt`, so the same replay and settings give the same pixels; nothing in rendering reads `Date.now()`, `performance.now()` or `Math.random()`. `runExport` streams each frame to `encode.ts` and yields to the page between frames (a `MessageChannel` macrotask); cancel is an `AbortSignal`. Video frames are made from the GPU canvas directly (`new VideoFrame(canvas)`): reading pixels back would move the canvas to the CPU, where a 1080p frame draws several times slower. Chrome resolves such a frame only when the page paints, so every rendered frame is also copied into a small visible preview canvas (the dialog's live preview; without one, a 2-px, nearly transparent canvas is added for the duration), and while an export runs the page drops its backdrop blurs (`:root[data-xp-busy]`) and the live scene is frozen (`GalaxyEngine.frozen`), because a full-page blur repainted every frame slows encoding by an order of magnitude. A background tab may pause an export until it is shown again.
- `encode.ts` — MP4: `VideoEncoder` (H.264 High/Main/Baseline level 4.0, then 5.1, whichever `isConfigSupported` accepts; ≈ 0.12 bit per pixel per frame, a key frame every 2 s) → `mp4-muxer` (`fastStart: 'in-memory'`). WebM: VP9 (`vp09.00.40.08`) or VP8 → `webm-muxer`. At most 6 frames are queued in the encoder before rendering waits for `dequeue`, so memory holds the encoded output, not the clip. GIF: a CPU-backed canvas read back every frame, `gifenc` with a 255-colour palette per frame (rgb565) plus a transparent slot: after the first frame, pixels within a small colour distance of what is already shown are written as transparent (once a second with a tight threshold, so slow fades leave no ghosts), which LZW packs into almost nothing — about 3× smaller files; frame delays alternate (60 / 70 ms at 15 fps) to keep the exact frame rate.

Dev builds expose `window.__export.run(settings)` and `window.__export.hashes(settings, frames)` on the replay page, for headless checks of the output and of determinism.

## Notifications

One detector, two places it runs. `shared/notify.ts` (`NotifyDetector`) turns live snapshots and live events into notification events; it is pure (time comes from its inputs) and unit-tested:

- the first snapshot is a baseline: nothing fires for what is already going on, and events before it are ignored;
- only sessions with a live process notify, and automated runs only when "Show automated sessions as separate stars" is on;
- **waiting**: a transition to `waiting`, once per wait (re-armed when the session leaves `waiting`); **answer ready**: `working → idle`;
- **subagent finished / started**, **compaction**: from `finish` / `spawn` / `compact` events, deduplicated (hooks and transcripts report the same thing);
- **context almost full**: fill crossing 85%, re-armed below 75%; **subscription limit**: a window crossing 80%, once per window (identified by its reset time), re-armed below 75%; **limit runs out early**: the forecast (above), once per 5 h window, no re-arm;
- a snapshot older than a session's latest status event never overrides that status (no flapping between SSE and polling).

Status reasons travel as language-neutral codes too (`LiveSession.statusCode/statusArg`, `status` events' `code/arg`), so both sides can say "waiting for permission for Bash" in their own words.

- **Web** (`web/src/notify/`): `NotificationCenter` (mounted once at the app root) feeds the detector from what the galaxy already receives (`feed.ts`), or, on analytics pages, from its own `/api/live` poll and `/api/events` stream. `rules.ts` decides channels (`channelsFor`: per-event matrix, master sound switch, do-not-disturb, browser permission, "only when hidden", system-instead-of-browser, never in demo mode) and builds toasts (bursts merged, waits sticky until resolved). `sound.ts` synthesizes the three themes with Web Audio (oscillators, envelopes, a compressor; throttled per event type).
- **Server** (`server/notifier.ts`): `ServerNotifications` runs the same detector over `Live`'s per-tick snapshot (emitted once the history scan is done) and live events, honors the saved settings and do-not-disturb, debounces per session and merges bursts of finished subagents. `SystemNotifier` runs `osascript -e 'display notification "…" with title "Clorbit"'` (AppleScript literals escaped) or `notify-send --app-name=Clorbit -- title body` through `execFile` with an argument array, at most 6 per minute and 1.5 s apart, and pauses for 10 minutes after repeated failures.

Settings live on the server (`GET/PUT /api/settings`); the web loads them on start, applies changes optimistically and saves them debounced. Offline or in demo mode the defaults apply; demo mode never writes. The language switch is a setting too, because the server writes system notifications in the chosen language.

## Event console

`server/recent-events.ts` keeps the last 500 console-worthy events (tool, spawn, finish, waiting, prompt, compact) in memory. Every live event is enriched once, when it is emitted, with `EventContext` (`project`, `agentName`, `parentName`; `Live.context()`), so old lines stay meaningful after agents are gone; SSE messages carry the same fields. `GET /api/events/recent?limit=` returns them oldest first.

On the web (`web/src/console/`), `model.ts` turns events into lines (pure: `toLine`, `mergeLines` dedupes history against the live stream, `filterLines`, `groupAutomated` folds each project's automated lines into one collapsible row placed at its newest line), `store.ts` holds the page's lines and colors, and `Console.tsx` renders the ticker, the drawer and the window. Colors come from the galaxy engine (`knownColor`, so a project is its star's hue and an agent its planet's) and are remembered, so finished agents keep theirs. The `#/console` window loads the history and listens to the stream itself (demo: its own seeded demo feed). A `BroadcastChannel('clorbit')` connects it to the main tab: focus requests (acknowledged; with no answer the window opens the galaxy in a tab named `clorbit-main` and asks again) and the main tab's color map.

## API contract

All types are in [`shared/api.ts`](../shared/api.ts). Every GET accepts `lang=en|uk` (default `en`); human-readable server text follows it.

| Endpoint | Returns |
| --- | --- |
| `GET /api/live` | `LiveSnapshot`: live and recent sessions with agent trees, totals, limits and their forecast, scan progress. |
| `GET /api/events` | Server-sent events, one `ClorbitEvent` per message (tool, spawn, finish, status, text, prompt, compact), with `EventContext` names. |
| `GET /api/events/recent?limit=` | `RecentEvent[]`: the last ≤ 500 console events, oldest first. |
| `GET /api/settings`, `PUT /api/settings` | `Settings`. PUT takes a (partial) settings object, validates and clamps it, drops unknown keys and returns the result; JSON only, local origins only. |
| `GET /api/about` | `AboutInfo`: version, data dir, hooks and limits-source state, event-store counts, system-notification availability. |
| `POST /api/notify/test` | Shows one test system notification (`{ ok, error? }`; rate-limited). |
| `GET /api/analytics/overview?from&to` | `AnalyticsOverview`: totals, daily series, projects, models, hourly profile, heatmap. |
| `GET /api/analytics/attribution?from&to` | `AttributionReport`: skills, plugins, MCP servers/tools, tools, subagent types, startup context. |
| `GET /api/analytics/sessions?from&to&project` | `SessionSummary[]`. |
| `GET /api/session/:id` | `SessionDetail`: summary, full tree, timeline, startup context, tools, token series. |
| `GET /api/session/:id/replay` | `SessionReplay`: session meta and time-ordered replay events (≤ 20,000; archived sessions: structure only). |
| `GET /api/session/:id/agent/:agentId/changes` | `AgentChanges`: files an agent edited or wrote (+/− lines, edits, failed calls, capped diff previews), files it only read, and its last ≤ 200 steps. `agentId` is a subagent id, `main` or `all` (the whole session, files only). |
| `GET /api/insights?from&to&page&unusedDays&session` | `Insight[]`: recommendations with severity, evidence, a fix or prompts, targets and estimated savings. `page` (an `InsightPage`) keeps the cards of one analytics tab (unknown → `[]`); `page=overview` returns the best cards of every tab ranked by savings (`pickOverview`); `page=session&session=<id>` returns that session's own cards over its whole span (the range is ignored); `unusedDays` overrides `Settings.recommendations.unusedDays`. |
| `GET /api/limits/history?from&to` | `LimitsPoint[]` (with the windows' reset times). |
| `GET /api/limits/forecast` | `LimitsForecast`: per window used %, reset, burn rate, projected run-out time and % at reset, confidence, basis; `source: 'none'` without the capture. |
| `GET /api/debug/scan`, `GET /api/debug/db` | Diagnostics. |
| `POST /api/hook` | Accepts a Claude Code hook payload. |

Dates are local `YYYY-MM-DD`, timestamps are epoch milliseconds.

## Recommendations

Every analytics tab can show a strip of recommendations (`web/src/components/Recommendations.tsx`, `<Recommendations page="skills" />`); the Insights page shows all of them with the same card.

- **Contract** (`shared/api.ts`): `Insight` carries `pages` (the tabs that show it), `scope` (`history` or `range`), `saving` (`perSession`, `perSubagent`, `period` over `days`, `basis`, `pctStartup`), `targets` (exact keys, labels, last use, tokens per session) and `prompts` (`{ all, ask }`). Ids are stable per rule and target set (`stableId` in `server/recommend.ts`), so a hidden card stays hidden until its items change. Hidden ids and the "unused after N days" threshold live in `Settings.recommendations`.
- **Framework** (`server/recommend.ts`): `RecommendEnv` (now, threshold, enabled plugins, display paths; injectable for tests), `usageIndex` (last use of every plugin, skill, MCP server and tool over all stored summaries, archived ones included), `costWindow`/`rangeWindow` + `costOf` (per-session/per-subagent cost of a piece of startup context and its 30-day projection), `severityOf`.
- **Rules** live in `server/recommend-<area>.ts` and are called from `server/insights.ts`; wording is in `server/insights-text.ts` (`rec`). `recommend-skills.ts`: enabled plugins unused for N+ days, plugins whose SessionStart hook loads context into every session but which are used in few projects, plugins most of whose skills are unused, own skills unused for N+ days, duplicate skill names. A plugin covered by one card is left out of the others. `recommend-mcp.ts`: connected servers unused for N+ days (one card; the command depends on the source — `mcpSource` tells user / local scope in `~/.claude.json`, a project's `.mcp.json`, a plugin, a claude.ai connector or unknown; plugins already in the unused-plugins card are skipped), servers that keep failing or erroring (range), servers with oversized results (range, one card per server on MCP and Tools; MCP tools are no longer in the per-tool cards), user-scope servers used in only some projects (move to local scope there). `recommend-startup.ts`: instruction files over 2K tokens and an auto-memory index over 1K (savings = 40% of the measured cost, an estimate), hooks from the settings (`hook:event:*`) that print context at every start, the skill listing (points to Skills & plugins via `Insight.seeAlso` with what those cards would save) and the startup total with what subagents pay again.
- **Prompts** (`shared/prompts.ts`): `buildPrompts({ lang, summary, items, verify })` with item factories (`disablePluginItem`, `enablePluginInProjectItem`, `moveSkillItem`, `removeMcpServerItem`, `moveMcpToProjectsItem`, `disableMcpJsonServerItem`, `disableClaudeAiConnectorsItem`, `compressInstructionsItem`, `consolidateMemoryItem`, `reviewItem`) and extra rules (`PROMPT_NOTES`: the one allowed removal — `claude mcp remove` after a backup of `~/.claude.json`; how to compress a CLAUDE.md; how to consolidate memory). Both variants list the exact commands and how to undo them, ask Claude to show the plan first, back up every settings file it edits, never delete, skip what fails and report, and remind that changes apply to new sessions; "ask" goes through the items one at a time (AskUserQuestion when available). The demo data uses the same builder.

`recommend-tools.ts` (Tools): permission prompts you keep approving → precise allow rules (`permissionRecommendation`, from hook events: `HookLog.permissionEvents` + `approvals` in `hook-log.ts`, computed with the wait card in `waitInsights`, which then points to Tools via `seeAlso`); a rule is suggested only if `bashRule` / `readRule` / the MCP name check produce it and `isSafeAllowRule` accepts it (`DENY_PATTERNS` always wins: no broad rules, nothing that deletes, moves, pushes, installs, downloads or runs arbitrary code); read-only rules seen in several projects go to the user settings, the rest to the project's `.claude/settings.local.json`; the saving is `InsightSaving.waitMs`. Also files re-read within one context (a note in the project's CLAUDE.md or a review), huge built-in tool results (an "Output hygiene" section in the user CLAUDE.md, one tip per item) and built-in tools that often fail (by `errKinds`). `recommend-agents.ts` (Subagents): read-only agent types on a top-tier model (`model: sonnet` in a user / project agent file found by `RecommendEnv.agentFile`, a CLAUDE.md line for built-in agents, a review for plugin agents; `modelPrice` gives relative API prices and `InsightSaving.costShare` the share of their cost), short subagents dominated by their startup context (`seeAlso: 'startup'`), bursts and deep nesting, agent types that often fail or get stopped. Prompt factories: `allowRuleItem`, `instructionNoteItem`, `agentModelItem`, with `PROMPT_NOTES.allow` / `note` / `agentModel`.

`recommend-sessions.ts` (Sessions): cache rebuilt after idle gaps (from `DayBucket.rebuilds`, v9: a main-chain turn more than 5 minutes after the previous one that wrote at least half of the previous context of 20K+ to the cache; the saving subtracts the startup context), frequent auto-compactions (a CLAUDE.md note for long tasks; `compactPre` gives the context size), a nearly full context (`ctxHi`, against the window from `contextLimitFor`), a raised effort on simple prompt rounds (`effort`; xhigh / max only, no saving), automated sessions (`sessionKind`) and days with a low cache hit rate with their visible causes (`rebuilds`, `switches`, compactions, new sessions; no saving of its own). `sessionView(store, id)` is a `Store` holding one session's files: `sessionInsights` in `insights.ts` runs these rules (scope `'session'`, lower thresholds) plus repeated reads, huge outputs and the subagent-model rule over it, retags the cards `['session']`, gives them distinct ids (`rule@session:…`) and links each to its rule's tab. `recommend-limits.ts` (the limits panel, from the forecast passed in `InsightOptions.limits`): no source → how to connect it; a window that runs out before its reset → what eats it (`windowUsage`: weighted tokens by project, agent and model since the window's start) and levers — the other cards over the window's days, their savings as `InsightSaving.windowPct` of the window; otherwise the weekly pace. A window the plan does not have (`noWindow`) is never mentioned. `shared/insights.ts` holds what the server and the web app share: `pickOverview` (savings first; limits and session cards left out, since the panel is on the Overview), `bySavings`, `insightTotals` (only `estSavingTokens`, which is set only where a card's saving is its own) and `homePage`.

To add a tab's recommendations: write rules that return `Insight`s with `pages` including that tab (use `costOf` for savings and the prompt item factories, or add a factory), call them from `insights.ts`, and mount `<Recommendations page="…" />` on the page.

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
- Clorbit never writes to `~/.claude`. The only code that can is the status-line capture — `clorbit statusline` (`/clorbit statusline` in Claude Code) and `scripts/install-hooks.mjs`, both through `plugin/app/statusline.mjs` — which is a dry run unless you pass `--apply`, backs up `settings.json` first and changes only `statusLine.command` (or, with `--create`, adds a minimal `statusLine`); `--remove` restores the original command.
- Clorbit's own data lives in `~/.clorbit` (`CLORBIT_DATA_DIR`). The one-time copy of a pre-rename `<repo>/data/fleet.db` (`migrateLegacyDb` in `server/config.ts`) only targets the default folder; an explicitly set data dir always starts empty. Transcript content is not copied wholesale: summaries hold counts, labels (tool labels such as `Read index.ts` or the first 40 characters of a Bash command), session titles, the latest assistant text (≤ 240 chars), file paths of repeated reads, paths and sizes (not contents) of instruction files, and the latest error text of an MCP server that failed to connect (≤ 80 chars). Hook payloads are trimmed as described above.
- There is no telemetry and no network access besides the Google Fonts stylesheet in `web/index.html`.
- The only programs the server starts are the notifier (`osascript` / `notify-send`), and only for events the user enabled under System; the text is passed as arguments, never through a shell. Writes from the web (`PUT /api/settings`, `POST /api/notify/test`) are refused for non-local `Origin`s.
