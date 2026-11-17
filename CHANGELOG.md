# Changelog

All notable changes to Clorbit are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased] — planned 0.2.0

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
