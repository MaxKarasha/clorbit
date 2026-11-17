# Contributing to Clorbit

Thanks for your interest! Bug reports, ideas and pull requests are all welcome.

## Before you start

- For anything bigger than a small fix, please open an issue first so we can agree on the approach.
- Security issues: please follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development setup

Requirements: Node.js 22.5+ and pnpm.

```bash
pnpm install
pnpm dev          # API server on :4980 + Vite on :5173
```

Use `http://127.0.0.1:5173/#/?mock=1` to work on the UI with demo data. To run a second instance next to your everyday one, use another port and data dir:

```bash
CLORBIT_PORT=4991 CLORBIT_DATA_DIR=/tmp/clorbit-dev pnpm dev
```

## Checks

Every pull request must pass:

```bash
pnpm typecheck
pnpm test
pnpm build
```

CI runs the same commands on Ubuntu and macOS.

## Guidelines

- **Read-only over `~/.claude`.** Clorbit must never write to Claude Code's folder at runtime. Anything that changes user settings belongs in an explicit, dry-run-by-default script.
- **Localhost only.** Do not add network calls, telemetry or external services.
- **No new runtime dependencies on the server.** It uses Node built-ins only (`node:http`, `node:sqlite`, `node:worker_threads`, …). The web app depends on React only; please discuss before adding a library.
- **Keep `shared/api.ts` changes additive** where possible — it is the contract between the server and the web app.
- **Translations:** every user-visible string goes through `t()`/`tp()` on the web (`web/src/i18n/en/*` and `web/src/i18n/uk/*`; the Ukrainian files are type-checked against the English keys) or through `server/i18n.ts` / `server/insights-text.ts` on the server. If you do not speak Ukrainian, add the English text and leave a `TODO(uk)` in the Ukrainian file — a maintainer will translate it.
- **Tests use synthetic data.** Never commit real transcripts, real project names or paths. Build small fake records like `server/__tests__/scanner.test.ts` does.
- **Code comments and docs are in English.** Keep comments short and explain *why*, not *what*.
- **Schema changes** go into a new entry of `MIGRATIONS` in `server/db.ts`; never edit a shipped migration. Changing the shape of `FileSummary` requires bumping `SUMMARY_VERSION`, which re-parses existing transcripts on the next start (archived ones keep their old summaries).

## Pull requests

- Keep them focused; one topic per PR.
- Describe what changed and how you tested it; include a screenshot for UI changes (demo mode is fine).
- Update `README.md` / `docs/ARCHITECTURE.md` when behavior or configuration changes.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
