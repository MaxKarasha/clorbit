# Changelog

All notable changes to Clorbit are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

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
