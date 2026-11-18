# Changelog

All notable changes to Clorbit are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- **What did this agent change?** Click a planet (or the star) and its panel gets two tabs. **Changes**: every file the agent edited or wrote (Edit, MultiEdit, Write, NotebookEdit), relative to the session's folder, with +added / −removed lines counted from the calls themselves, the number of edits, "new" / "rewritten" for whole-file writes and when it was last touched, newest first, with a totals row; click a file for an inline mini-diff (red / green, the newest 8 changes, 40 lines each). Calls whose result was an error (denied, nothing to replace, …) are not counted: the file shows "1 failed", and a file where every attempt failed is listed dimmed at the end. Files the agent only read are one click away. **Steps**: the agent's recent tool calls (tool + short argument), short texts and spawns, newest first, each with done / error / running and a relative time, 50 at a time; it follows a working agent through the galaxy's existing poll. The Session page gets a **Files changed** block for the whole session (all agents, with their branch colors). Demo mode has believable changes and a live step feed. API (additive): `GET /api/session/:id/agent/:agentId/changes` → `AgentChanges` (`agentId` = a subagent id, `main` or `all`), with `FileChange`, `DiffHunk`, `FileRead`, `AgentStep`. Transcripts are parsed incrementally (a cached parser resumes from the last byte offset), large tool results are byte-scanned rather than parsed, and previews are capped while parsing.
- **Share a run: export a replay to a video or GIF.** "Export video" in the time machine's header renders the replay on your computer, frame by frame and faster than real time, into an **MP4** (H.264 via WebCodecs, muxed by `mp4-muxer`), a **WebM** (VP9, or VP8, via WebCodecs + `webm-muxer`) or a **GIF** (`gifenc`, at most 720 px wide, 15 fps, with a size estimate). Nothing is uploaded. Aspects: 16:9 (1920×1080 or 1280×720), 1:1 (1080×1080) and 9:16 (1080×1920 for Reels, Stories and Threads); the camera fits the system into each frame with safe margins (vertical clips keep clear of the apps' top and bottom chrome). Range: the whole session or a selection (I / O keys or "start / end at playhead" in the dialog; the selection shows as a band on the timeline). Length: 15, 30 or 60 s, or real speed with idle gaps squeezed (at most 10 min, GIF 60 s): idle gaps are compressed first, then busy stretches get more of the clip than quiet ones, with a smooth, bounded change of speed; a run shorter than the clip is never slowed down. Drawn into the frames, each optional: a title card (project, session title, date, model), an end card ("Made with Clorbit · github.com/MaxKarasha/clorbit" and the run's totals), a corner clock (original time and elapsed), live counters (agents, tool calls, tokens) and caption toasts for spawns, returns and waits. Overlays follow the UI language (English or Ukrainian). **Anonymize** (on by default for real data, not shown in demo mode): the project becomes "project", the session title, prompts, agent tasks and texts are dropped, tool labels are cut to the tool's name (no paths, commands, patterns, URLs or file names), agent types are kept only when they are plain identifiers. A progress bar with a live preview of the frame being rendered and cancel; the result has a preview player, a download (`clorbit-<project|session>-<date>.mp4`) and, where the browser allows GIFs on the clipboard, "Copy GIF". MP4 is hidden, with an explanation, where the browser cannot encode H.264; GIF always works. The same session and settings give identical frames (a manual clock, seeded randomness, no wall clock in rendering). The encoders load only when the dialog opens.
- **Subscription plan badge.** The status bar, the Overview's limits panel and Settings → Connection show your Claude plan as a small glowing pill (e.g. «Ultra · 20×», with the subscription date in Settings and the tooltip). It is read from `~/.claude.json` — only the plan fields of `oauthAccount` (`planDisplayName`, `organizationType`, the rate-limit tiers, `subscriptionCreatedAt`), cached by mtime; the rest of the file is never stored, logged or returned. `CLORBIT_CLAUDE_JSON` points at the file. API (additive): `Plan`, `LiveSnapshot.plan`, `AboutInfo.plan`. Demo mode shows «Max · 20×».
- **Limit bars.** The two subscription rings in the status bar became compact gauge bars («5 h» / «7 d»): the fill is the used % on a calm → amber → red ramp, a hatched stretch and a marker show the projected % at the reset, with the percentage and the forecast line ("runs out at 14:20" / "resets Fri 05:57") under each. Without a source the bars are dashed ghosts with a "connect" link.
- **Plans without a 5-hour window (Ultra).** When the status line reports the 7-day window but no 5-hour one, the 5 h bar shows **∞** ("no 5-hour limit"), there is no 5 h forecast or notification, and Overview → Subscription limits hides the 5 h series and says why. Before the first reading a small plan table (`shared/plan.ts`) fills in (tooltip "Ultra has no 5-hour window (from your plan)"); status-line data always wins, and a 5-hour window that reappears is picked up automatically. API (additive): `Limits.fiveHourWindow` (`'present' | 'none' | 'unknown'`), `WindowForecast.noWindow`.
- **`/clorbit statusline`** (CLI: `clorbit statusline`). Connects the subscription-limits capture without a clone of the repository: a dry run by default that prints exactly what changes; `--apply` backs up `settings.json` (timestamped) and rewrites only `statusLine.command`; running it again is a no-op; `--remove` restores the original command; with no status line, `--apply --create` adds a minimal one that prints the model and both limits. Settings → Connection and the Overview now recommend it first and the repository script second. The logic lives in `plugin/app/statusline.mjs`, shared with `scripts/install-hooks.mjs`.

- **Time machine: replay a session in the galaxy.** `#/replay/<session>` (a "▶ Replay" button in the session panel, the cluster list, every row of Sessions and the Session page header) shows only that session's system, driven by a replay clock: agents are born as comets, orbit, flash on tool calls and spiral back into their parent while the belt grows, the context ring fills and the star grows with the tokens spent; the event console shows the replayed events with their original timestamps, and the side panels describe the session as it was at the playhead. A glass timeline at the bottom has play/pause, speeds 1×–60× and **auto** (idle gaps over 30 s are squeezed to a few seconds and the replay fits into a couple of minutes), the original time and elapsed time, activity density, markers for spawns (violet), waits (orange), compactions and prompts (white); drag to seek, space to play/pause, ←/→ to step through events, Shift+←/→ to jump between markers. Live sessions replay up to the moment they were opened, with an optional "follow live". "Exit replay" goes back to the live galaxy. Works in demo mode (a believable 25–40 minute run with nested agents), in English and Ukrainian, and with reduce motion (no trails, instant births and returns).
- `GET /api/session/:id/replay` → `SessionReplay` (additive): session meta and a time-ordered list of replay events (spawns with parent, type and task; returns with tokens; tool calls; short texts; prompts; compactions; status changes; per-turn tokens with the main context). Waits come from the permission decisions Claude Code records (the user decided), questions to the user (`AskUserQuestion`, `ExitPlanMode`) and, for older transcripts, the 10-second heuristic. At most 20,000 events: spawns, returns, prompts, waits and compactions are always kept, tool calls and texts are sampled evenly and token turns merged (totals stay exact). Archived sessions replay their structure (agents, lifetimes, hourly tokens) from stored summaries.
- **Activity gravity in the galaxy.** Projects with a working or waiting session slowly drift into the centre (an eased 15–30 s move, never a jump); waiting ones get the spot closest to the centre. When a session stops being active it stays where it is; idle projects move aside, outward, only when an active one needs their space. Targets are deterministic and do not change between polls with the same data. Settings → Interface → "Gravity: pull active sessions to the centre" (on by default); off restores the fixed layout by project name. With reduce motion on, moves happen at once.
- **Pinning.** Drag a star or a cluster to put it somewhere else (pressing on empty space still pans); it stays there, marked with a pin next to its label, ignores gravity and the others make room for it. Double-click, right-click or Alt-click it — or "Unpin" in its side panel — to let it go. Pins are saved on the server (`Settings.layout.pins`, keyed `star:<project>:<sessionId>` / `cluster:<project>`, positions as fractions of the galaxy so they survive a different screen; at most 64; pins of sessions that are gone are dropped). "Reset layout" in Settings → Interface and in the zoom controls unpins everything and lets the galaxy rearrange itself. In demo mode pins live in memory only.
- **Subscription limit forecast.** With the status-line capture connected, Clorbit estimates how fast each window (5 h, 7 d) burns: a recency-weighted regression over the current window's limit history (resets split windows), or — while the history is thin — your transcript token rate calibrated against the % gained in the window. The status-bar rings became fuel gauges: a faint arc and a thin tick show the projected % at the reset, and a line under each ring says "runs out at 14:20" (amber; red when it is close or used up) or "lasts until reset"; the tooltip has the rate, reset time, confidence and basis. `GET /api/limits/forecast` returns it (`LimitsForecast`), and `LiveSnapshot.limitsForecast` carries it for the HUD; `/api/limits/history` points now include the reset times (all additive).
- **Overview → Subscription limits.** A chart of the 5 h and 7 d used % over the selected period, with reset markers and the dashed forecast to the next reset; without data it explains how to connect the source.
- **"Limit runs out early" notification** (`limit_forecast`): once per 5 h window, when the forecast says it runs out more than 20 minutes before its reset with at least medium confidence. Defaults: sound + in-app card.
- **How to connect the limits source** now lives in Settings → Connection: what the capture is, the exact command with a copy button, and the fact that it edits `~/.claude/settings.json` (with a backup) only when you run it — Clorbit never does it itself. The status bar's "how to connect" link opens it.
- Demo mode has a believable limits history and forecast.
- **Edge indicators.** While you are zoomed in elsewhere, a waiting (orange) or working (blue) project out of view gets a chip at the edge of the screen pointing at it — project, status and count. Chips stack without overlapping, stay clear of the status bar, breadcrumbs, side panel, console, ticker, zoom controls and toasts, and disappear once the project is on screen. Click one to fly there.

### Changed

- The `7 days` label in English is now `7 d`, to match the bars.

### Fixed

- The transparent part of the zoom-controls column no longer swallows clicks on the galaxy behind it.

## 0.2.2

### Fixed

- The "hooks not installed" pill no longer covers the side panel; it now sits in the breadcrumb row, which has its own backdrop and never runs under panels.
- Galaxy labels avoid the HUD (status bar, breadcrumbs, demo strip, event ticker, zoom controls) instead of drawing underneath it.
- In-app cards stay visible while the settings panel is open.

### Docs

- New README media: a smoother hero GIF (plus a sharper WebP), a gallery of eight screenshots, a bright social-preview image, and a link to the one-minute promo video.

## 0.2.1

### Fixed

- **The galaxy no longer turns into a ring of overlapping stars** when a project has many sessions in a day (typically automated `claude -p` runs from scripts or CI). Each run used to be its own star on a tiny fixed circle, so a hundred runs drew a solid ring of glowing stars and identical labels.

### Added

- **Automated sessions are recognized** from Claude Code's own fields: `entrypoint` (`sdk-cli` for `claude -p`, `sdk-ts` / `sdk-py` for the Agent SDK, the GitHub Action, `mcp`), the process `kind` (`daemon`, `daemon-worker`) and the first prompt's origin (`sdk`, `scheduled`). Additive API fields: `LiveSession.kind` (`'interactive' | 'automated'`), `LiveSession.entrypoint`, `EventContext.automated`. Summaries from 0.2.0 are classified from the head of their transcript, without a rescan.
- **Star clusters:** a project's sessions without a live process — and its automated runs, even while running — fold into one cluster body (a few small stars in a soft nebula, sized by tokens, labelled `product · 137 sessions in 24 h`; a dashed ring when it is mostly automated). Clicking it opens a side panel with the sessions (title, time, tokens, kind, status): each row opens the session, live ones can be shown as a star; plus "All sessions of <project>".
- **Settings → Interface → "Show automated sessions as separate stars"** (`interface.showAutomated`, off by default). While off, automated runs stay in the cluster, their console events are grouped into one collapsible row per project (`product (automated) · 42 events`) and they never trigger notifications.
- Demo mode has an automated-heavy project, `nightly-ci`, with 60 runs over the day and two running now.

### Changed

- **Layout that scales:** a project's stars sit on a ring that grows with their number and size, project groups push each other apart instead of overlapping, and only a project's main star is labelled until you zoom in or hover (its siblings then show their session titles). Labels avoid each other and the bodies, and fade instead of popping.
- **A cap of ~24 bodies on screen:** beyond it, the quietest projects fold their idle stars into their clusters (automated runs first); working and waiting sessions always stay visible.

## 0.2.0

### Added

- **Settings panel** behind a round profile button at the right end of the galaxy HUD and the analytics navigation: a glass slide-over (Esc / click outside closes it, focus stays inside). Settings are saved by the server in SQLite (schema v2: `settings` table) through `GET/PUT /api/settings`, validated and clamped.
- **Notifications** for seven events — waiting for you, answer ready, subagent finished / started, compaction, context almost full (> 85%), subscription limit (> 80%) — on four channels: sound, browser notification (with an "only when the tab is hidden" option), in-app cards and **system notifications** shown by the server itself (macOS `osascript`, Linux `notify-send`), which work with the tab closed. One detector (`shared/notify.ts`) drives both the web and the server: baseline on load, once per wait, live sessions only, deduplicated across hooks and transcripts.
- **Sounds** synthesized with Web Audio in three themes (Orbit, Minimal, Retro), a distinct sound per event with previews, volume and a master switch.
- **Do not disturb** with optional quiet hours (may cross midnight), and "Mute 1 h" on every card.
- **In-app cards** (toasts): stacked bottom-right, colored by event, click to fly to the session; "waiting" cards stay until the session moves on.
- **Interface** settings: language, auto tour, and a new **Reduce motion** option (slow orbits, no twinkling, instant camera moves).
- **Connection** summary: server version, data folder, hooks and limits-source state, event-store counts (`GET /api/about`).
- **Event console**: the galaxy's event ticker now colors projects and agents like their stars and planets, uses a glyph per event kind and is clickable (fly to the session or the agent). It expands into a docked, resizable drawer with history, filters by project and kind, search, pause and "clear view", and pops out into its own window (`#/console`) that drives the galaxy in the main tab over `BroadcastChannel`.
- `GET /api/events/recent` (the last 500 console events, kept in memory) and project/agent names on live events (`EventContext`), so console history stays readable after agents are gone.
- Status reason codes in the live API (`statusCode` / `statusArg`, `code` / `arg` on status events), additive.
- The demo now and then finishes a turn or asks for permission, so notifications can be tried on invented data.

### Changed

- The auto-tour switch is stored in the settings (a tour enabled in 0.1.1 is carried over once).

### Fixed

- The galaxy's zoom buttons disappeared while a session or agent panel was open.

## 0.1.1

- Galaxy camera: drag to pan, scroll / pinch to zoom toward the cursor, on-screen zoom buttons and keyboard (`+`, `-`, `0` reset, `Esc` up a level).
- Auto tour is now opt-in ("Auto tour" toggle in the HUD), remembered per browser, with a clear explanation.

## [0.1.0] - 2026-11-17

First public release.

### Added

- **Galaxy:** a live canvas view of Claude Code sessions (stars), subagents (planets and moons) and finished agents (asteroid belts), with live tool-call flashes, drill-down to a session and to a single agent, a status bar with tokens, burn rate, subscription limits and cache hit rate, and an automatic tour.
- **Analytics:** overview, skills and plugins, MCP servers, tools, subagents, startup context, sessions, a per-session timeline and rule-based insights with concrete fixes.
- **Local persistence:** summaries in `~/.clorbit/clorbit.db` (SQLite via `node:sqlite`), incremental re-scans, and archived history for transcripts Claude Code has already deleted.
- **Claude Code plugin** `clorbit`, installable with `/plugin marketplace add MaxKarasha/clorbit` and `/plugin install clorbit@clorbit`:
  - `/clorbit [open|start|stop|status]` to open the dashboard and manage the local server;
  - silent, asynchronous server autostart on session start (`CLORBIT_AUTOSTART=0` turns it off);
  - asynchronous hooks that stream session and agent events for exact live status and wait times.
- **CLI** (`plugin/app/cli.mjs`): `open`, `start`, `stop`, `status`, `ensure`; detached server with pid file and log in `~/.clorbit`, health check before reporting success, and a clear message when the port is taken by another program.
- **Prebuilt plugin:** the web app and a single-file server bundle (Node built-ins only) ship in `plugin/app`, so the plugin needs no install step.
- English and Ukrainian UI.
- **Honest data source:** when the server is not running, the galaxy and analytics show a "server isn't running" screen with how to start it, a Retry button and automatic re-checks — never substitute numbers. A demo mode with invented data is available only on request ("Try the demo", or `?demo=1`; `?mock=1` is an alias) and is clearly labelled on every screen, with a "Show my data" button.

[0.1.0]: https://github.com/MaxKarasha/clorbit/releases/tag/v0.1.0
