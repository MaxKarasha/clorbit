// Worker thread: scans files sent by the main thread.
import { parentPort } from 'node:worker_threads';
import { scanFile } from './scanner';

parentPort!.on('message', async (msg: { id: number; projectsDir: string; file: string; prev: any; opts: any }) => {
  try {
    const r = await scanFile(msg.projectsDir, msg.file, msg.prev, msg.opts);
    parentPort!.postMessage({ id: msg.id, result: r });
  } catch (e) {
    parentPort!.postMessage({ id: msg.id, error: String((e as Error)?.message ?? e) });
  }
});
