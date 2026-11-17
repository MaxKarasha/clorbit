# Changelog

All notable changes to Clorbit are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

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
