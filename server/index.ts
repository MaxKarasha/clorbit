// Clorbit HTTP server: REST + SSE, bound to 127.0.0.1 only.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { attribution, overview, parseRange, sessions } from './analytics';
import { INSIGHT_PAGES, type AboutInfo, type InsightPage } from '../shared/api';
import { RECOMMEND_DAYS } from '../shared/settings';
import { CACHE_DIR, DATA_DIR, DB_FILE, DIST_DIR, HOST, PORT, PROJECTS_DIR, SERVE_WEB, VERSION, env, hookPluginEnabled, knownPlugins, migrateLegacyDb } from './config';
import { ClorbitDb } from './db';
import { HookLog } from './hook-log';
import { Hooks } from './hooks';
import { errorText, localizeEvent, parseLang, type Lang, type ServerEvent } from './i18n';
import { insights } from './insights';
import { LimitsForecaster } from './limits-forecast';
import { LimitsLog, parseTsRange } from './limits-log';
import { Live, readLimits } from './live';
import { readPlan } from './plan';
import { RecentEvents } from './recent-events';
import { ServerNotifications, SystemNotifier, notifyTestBody } from './notifier';
import { SettingsStore } from './settings';
import { sessionDetail } from './session-detail';
import { sessionReplay } from './replay';
import { sessionAgentChanges } from './changes';
import { Store } from './store';

const t0 = Date.now();
const migratedFrom = migrateLegacyDb();
if (migratedFrom) console.log(`[clorbit] copied the database from ${migratedFrom} to ${DB_FILE} (one-time migration; the old file is left untouched)`);
// SQLite is the persistence layer; if it cannot be opened, the server still runs in memory only.
let db: ClorbitDb | null = null;
try { db = ClorbitDb.open(DB_FILE); } catch (e) {
  console.error(`[clorbit] could not open ${DB_FILE}, running without persistence:`, (e as Error).message);
}
const store = new Store(PROJECTS_DIR, db, { knownPlugins: knownPlugins() });
store.loadCache(CACHE_DIR);
if (store.persist.imported) console.log(`[clorbit] imported ${store.persist.imported.count} summaries from ${store.persist.imported.file}`);
const hooks = new Hooks();
const hookLog = new HookLog(db);
const limitsLog = new LimitsLog(db, () => readLimits().limits);
const live = new Live(store, hooks);
const forecaster = new LimitsForecaster((from, to) => limitsLog.history(from, to), () => store.files.values());
live.forecast = (limits, now) => forecaster.get(limits, now);
const settings = new SettingsStore(db);
const systemNotifier = new SystemNotifier();
new ServerNotifications(() => settings.get(), systemNotifier).attach(live);

function about(): AboutInfo {
  const st = db ? (hookLog.flush(), db.stats()) : null;
  const lim = readLimits();
  const lastHook = hooks.recent.length ? hooks.recent[hooks.recent.length - 1].ts : null;
  return {
    version: VERSION,
    dataDir: DATA_DIR,
    hooks: { pluginEnabled: hookPluginEnabled(), eventsReceived: hooks.installed || (st?.rows.hookEvents ?? 0) > 0, lastEventAt: lastHook },
    limits: { capture: lim.capture, updatedAt: lim.limits?.updatedAt ?? null },
    store: { enabled: !!st, fileSummaries: st?.rows.fileSummaries ?? 0, archived: st?.rows.archived ?? 0, hookEvents: st?.rows.hookEvents ?? 0, limits: st?.rows.limits ?? 0 },
    system: { available: systemNotifier.available, tool: systemNotifier.tool, platform: process.platform },
    plan: readPlan(),
  };
}

/** Writes from the UI must come from a local page: a cross-site page in the browser cannot change settings. */
function localOrigin(req: http.IncomingMessage): boolean {
  const o = req.headers.origin;
  if (!o) return true;
  try { return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(o).hostname); } catch { return false; }
}

function dbHealth() {
  if (!db) return { enabled: false };
  hookLog.flush();
  return {
    enabled: true, ...db.stats(),
    archivedInMemory: store.missing.size, warmLoadMs: store.stats.loadMs, pendingWrites: store.isDirty,
    lastFlush: { at: store.persist.lastFlushAt, ms: store.persist.lastFlushMs, rows: store.persist.lastFlushRows, count: store.persist.flushes },
  };
}

// SSE clients with their language; status reasons are rendered per language.
const clients = new Map<http.ServerResponse, Lang>();
const recent = new RecentEvents();
const broadcast = (e: ServerEvent) => {
  // Names are resolved once, now: the console keeps meaningful lines after agents are gone.
  const ctx = e.kind === 'text' ? {} : live.context(e);
  recent.push(e, ctx);
  const byLang = new Map<Lang, string>();
  for (const [c, lang] of clients) {
    let data = byLang.get(lang);
    if (!data) byLang.set(lang, (data = `data: ${JSON.stringify({ ...localizeEvent(e, lang), ...ctx })}\n\n`));
    c.write(data);
  }
};
live.on('event', broadcast);

function json(res: http.ServerResponse, code: number, body: unknown) {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(s);
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json',
  '.ico': 'image/x-icon', '.webp': 'image/webp',
};

function serveStatic(res: http.ServerResponse, urlPath: string) {
  const safe = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(DIST_DIR, safe);
  if (!file.startsWith(DIST_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('dist is not built: run pnpm build'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
}

function readBody(req: http.IncomingMessage, limit = 2_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let n = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => { n += c.length; if (n > limit) { reject(new Error(errorText('en').tooLarge)); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}`);
  const p = url.pathname;
  const lang = parseLang(url.searchParams);
  const err = errorText(lang);
  try {
    if (req.method === 'POST' && p === '/api/hook') {
      const body = await readBody(req);
      let j: any = null;
      try { j = JSON.parse(body); } catch { /* not JSON */ }
      for (const e of hooks.ingest(j)) live.emitEvent(e);
      hookLog.record(j);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'PUT' && p === '/api/settings') {
      if (!localOrigin(req)) return json(res, 403, { error: err.forbidden });
      if (!String(req.headers['content-type'] ?? '').includes('application/json')) return json(res, 415, { error: err.jsonOnly });
      let j: unknown;
      try { j = JSON.parse(await readBody(req, 64_000)); } catch { return json(res, 400, { error: err.badJson }); }
      return json(res, 200, settings.update(j));
    }
    if (req.method === 'POST' && p === '/api/notify/test') {
      if (!localOrigin(req)) return json(res, 403, { error: err.forbidden });
      if (!systemNotifier.available) return json(res, 200, { ok: false, error: 'unavailable' });
      const ok = systemNotifier.send('Clorbit', notifyTestBody(lang));
      return json(res, 200, ok ? { ok } : { ok, error: 'rate-limited' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: err.getOnly });
    if (p === '/api/health') return json(res, 200, { app: 'clorbit', version: VERSION, pid: process.pid, port: PORT, dataDir: DATA_DIR, uptimeMs: Date.now() - t0 });
    if (p === '/api/live') return json(res, 200, live.snapshot(lang));
    if (p === '/api/settings') return json(res, 200, settings.get());
    if (p === '/api/about') return json(res, 200, about());
    if (p === '/api/events/recent') return json(res, 200, recent.list(lang, Number(url.searchParams.get('limit') ?? 500)));
    if (p === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
      res.write(': clorbit\n\n');
      clients.set(res, lang);
      const hb = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
      req.on('close', () => { clearInterval(hb); clients.delete(res); });
      return;
    }
    if (p === '/api/analytics/overview') return json(res, 200, overview(store, parseRange(url.searchParams)));
    if (p === '/api/analytics/attribution') return json(res, 200, attribution(store, parseRange(url.searchParams), lang));
    if (p === '/api/analytics/sessions') return json(res, 200, sessions(store, parseRange(url.searchParams), url.searchParams.get('project')));
    const rp = /^\/api\/session\/([^/]+)\/replay$/.exec(p);
    if (rp) {
      const id = decodeURIComponent(rp[1]);
      if (!/^[\w-]{8,64}$/.test(id)) return json(res, 400, { error: err.badSession });
      const r = await sessionReplay(store, id, !!live.pids.get(id)?.alive, lang);
      return r ? json(res, 200, r) : json(res, 404, { error: err.notFound });
    }
    const ac = /^\/api\/session\/([^/]+)\/agent\/([^/]+)\/changes$/.exec(p);
    if (ac) {
      const id = decodeURIComponent(ac[1]);
      const agent = decodeURIComponent(ac[2]);
      if (!/^[\w-]{8,64}$/.test(id) || !/^[\w-]{1,80}$/.test(agent)) return json(res, 400, { error: err.badSession });
      const r = await sessionAgentChanges(store, id, agent);
      return r ? json(res, 200, r) : json(res, 404, { error: err.notFound });
    }
    if (p.startsWith('/api/session/')) {
      const id = decodeURIComponent(p.slice('/api/session/'.length));
      if (!/^[\w-]{8,64}$/.test(id)) return json(res, 400, { error: err.badSession });
      const pid = live.pids.get(id);
      const alive = !!pid?.alive;
      const d = await sessionDetail(store, id, alive, lang, alive ? pid?.status ?? null : null);
      return d ? json(res, 200, d) : json(res, 404, { error: err.notFound });
    }
    if (p === '/api/insights') {
      const page = url.searchParams.get('page');
      if (page !== null && !INSIGHT_PAGES.includes(page as InsightPage)) return json(res, 200, []);
      const nd = Number(url.searchParams.get('unusedDays'));
      const unusedDays = Number.isFinite(nd) && nd > 0
        ? Math.round(Math.min(RECOMMEND_DAYS.max, Math.max(RECOMMEND_DAYS.min, nd)))
        : settings.get().recommendations.unusedDays;
      const session = url.searchParams.get('session');
      if (session !== null && !/^[\w-]{8,64}$/.test(session)) return json(res, 400, { error: err.badSession });
      return json(res, 200, insights(store, parseRange(url.searchParams), hookLog, lang, {
        page: (page as InsightPage | null) ?? undefined,
        unusedDays,
        session: session ?? undefined,
        limits: () => forecaster.get(readLimits().limits),
      }));
    }
    if (p === '/api/limits/history') { const r = parseTsRange(url.searchParams); return json(res, 200, limitsLog.history(r.from, r.to)); }
    if (p === '/api/limits/forecast') return json(res, 200, forecaster.get(readLimits().limits));
    if (p === '/api/debug/scan') return json(res, 200, { ...store.stats, files: store.files.size, archived: store.missing.size, hooksRecent: hooks.recent.slice(-20), uptimeMs: Date.now() - t0, db: dbHealth() });
    if (p === '/api/debug/db') return json(res, 200, dbHealth());
    if (p.startsWith('/api/')) return json(res, 404, { error: err.unknownRoute });
    if (SERVE_WEB) return serveStatic(res, p);
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Clorbit API. To serve the web app from here: pnpm start (or CLORBIT_SERVE_WEB=1 after pnpm build).');
  } catch (e) {
    console.error('[clorbit] request failed', p, e);
    if (!res.headersSent) json(res, 500, { error: String((e as Error)?.message ?? e) });
    else res.end();
  }
});

// The CLI (plugin/app/cli.mjs) passes CLORBIT_PID_FILE: the file is written only once the port is ours,
// so two sessions racing to autostart never leave a stale pid behind.
const PID_FILE = env('PID_FILE');
const ownsPidFile = () => { try { return PID_FILE && JSON.parse(fs.readFileSync(PID_FILE, 'utf8')).pid === process.pid; } catch { return false; } };

server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') console.error(`[clorbit] port ${PORT} on ${HOST} is already in use. Stop the other process or pick another port with CLORBIT_PORT.`);
  else console.error('[clorbit] server error', e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  if (PID_FILE) {
    try { fs.writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, port: PORT, version: VERSION, startedAt: new Date().toISOString() }) + '\n'); } catch (e) {
      console.error(`[clorbit] could not write ${PID_FILE}:`, (e as Error).message);
    }
  }
  const lock = env('START_LOCK');
  if (lock) try { fs.rmSync(lock, { force: true }); } catch { /* the CLI cleans up stale locks */ }
  console.log(`[clorbit] v${VERSION} http://${HOST}:${PORT} ready in ${Date.now() - t0} ms; ${store.files.size} files in the database, ${store.missing.size} archived (loaded in ${store.stats.loadMs} ms)`);
  live.start();
  hookLog.start();
  limitsLog.start();
  store.coldScan().then(() => {
    const st = store.stats;
    console.log(`[clorbit] scan: ${st.filesTotal} files, parsed ${st.filesParsed} (${(st.bytesParsed / 1e9).toFixed(2)} GB), from cache ${st.fromCache}, ${st.finishedAt! - st.startedAt} ms`);
  }).catch((e) => console.error('[clorbit] scan failed', e));
});

const shutdown = () => {
  live.stop();
  limitsLog.stop();
  try { hookLog.stop(); store.saveNow(); db?.close(); } catch { /* ignore on shutdown */ }
  for (const c of clients.keys()) c.end();
  if (ownsPidFile()) try { fs.unlinkSync(PID_FILE!); } catch { /* already gone */ }
  server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
