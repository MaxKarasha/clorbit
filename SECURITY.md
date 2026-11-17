# Security policy

## Model

Clorbit is a local tool:

- The server listens on **127.0.0.1 only** and has no authentication. Anyone with access to your user account (or any process on your machine) can read the dashboard; nothing on your network can.
- It **reads** Claude Code's data in `~/.claude` (transcripts, session pid files, settings) and **never writes** there at runtime. The optional `scripts/install-hooks.mjs` writes to `~/.claude/settings.json` only when you run it with `--apply`, after a dry run and with a timestamped backup.
- It stores its own data in `~/.clorbit` (SQLite database and an optional status-line capture). Transcript summaries can contain session titles, short tool labels (for example the first 40 characters of a Bash command), the latest assistant text and file paths. Treat `~/.clorbit` with the same care as `~/.claude`.
- The hooks plugin sends hook payloads to `http://127.0.0.1:4980/api/hook` (or `CLORBIT_URL`). Payloads are trimmed before storage and kept for 90 days.
- There is no telemetry. The only external request is the Google Fonts stylesheet loaded by the web page.

Please do not expose the server to other machines (reverse proxies, port forwarding, `0.0.0.0` bindings): it would expose your Claude Code activity.

## Supported versions

Only the latest release on the `main` branch receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, report privately via GitHub's [private vulnerability reporting](https://github.com/MaxKarasha/clorbit/security/advisories/new) for this repository.

Include what you found, how to reproduce it, and the impact you expect. You should get an acknowledgement within a week. Once a fix is released, you are welcome to be credited in the release notes.

Examples of what we care about: the server becoming reachable from outside localhost, writes to `~/.claude`, path traversal in static file serving, injection through transcript or hook content rendered in the UI, or leakage of data outside `~/.clorbit`.
