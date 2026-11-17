// Entry point of the single-file bundle (plugin/app/server.mjs, built by scripts/build.mjs).
// The bundle starts its own scan workers from the same file, so it picks its role by thread:
// the main thread runs the HTTP server, worker threads run the scanner.
import { isMainThread } from 'node:worker_threads';

if (isMainThread) await import('./index');
else await import('./scan-worker');
