// Streaming line-by-line .jsonl reader with exact byte offsets.
// Large irrelevant lines (api-request*, file-history-*) are skipped without decoding or JSON.parse.
import fs from 'node:fs/promises';

export type SkipKind = 'skip' | 'snapshot';

/** Decides from a line's prefix whether it can be skipped. */
export function classifyPrefix(head: Buffer): SkipKind | null {
  // Service records with `type` at the very start of the line.
  if (head[0] !== 0x7b || head[1] !== 0x22) return null;
  const p = head.subarray(0, 24).toString('latin1');
  if (p.startsWith('{"type":"api-request') || p.startsWith('{"type":"file-history-')) return 'skip';
  // prompt_snapshot is parsed fully (there are few) to know the exact system prompt length.
  return null;
}

const HEAD = 240;
const CHUNK = 4 * 1024 * 1024;

export interface LineSink {
  line(buf: Buffer): void;
  skipped(kind: SkipKind, bytes: number): void;
}

/**
 * Reads the file from `start` to the end. Returns the offset after the last complete line
 * (an incomplete tail is not processed; it is picked up next time).
 */
export async function readLines(file: string, start: number, sink: LineSink, maxBytes = Infinity): Promise<number> {
  const fh = await fs.open(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(CHUNK);
    let pos = start;
    let consumed = start;
    let carry: Buffer[] = [];
    let carryLen = 0;
    let skipping: SkipKind | null = null;
    let skipLen = 0;
    let decided = false; // the prefix of the partial line has already been checked
    const limit = start + maxBytes;
    while (pos < limit) {
      const { bytesRead: n } = await fh.read(buf, 0, Math.min(CHUNK, limit - pos), pos);
      if (n === 0) break;
      const view = buf.subarray(0, n);
      let i = 0;
      while (i < n) {
        const nl = view.indexOf(10, i);
        if (skipping) {
          if (nl === -1) { skipLen += n - i; i = n; break; }
          skipLen += nl - i;
          sink.skipped(skipping, skipLen);
          skipping = null; skipLen = 0;
          i = nl + 1; consumed = pos + i;
          continue;
        }
        if (nl === -1) {
          const piece = Buffer.from(view.subarray(i, n));
          carry.push(piece); carryLen += piece.length;
          if (!decided && carryLen >= HEAD) {
            decided = true;
            const head = carry.length === 1 ? carry[0] : Buffer.concat(carry);
            const k = classifyPrefix(head);
            if (k) { skipping = k; skipLen = carryLen; carry = []; carryLen = 0; decided = false; }
          }
          i = n;
          break;
        }
        let line: Buffer;
        if (carry.length) {
          carry.push(view.subarray(i, nl));
          line = Buffer.concat(carry);
          carry = []; carryLen = 0; decided = false;
        } else {
          line = view.subarray(i, nl);
        }
        i = nl + 1;
        consumed = pos + i;
        if (line.length === 0) continue;
        const k = classifyPrefix(line);
        if (k) sink.skipped(k, line.length);
        else sink.line(line);
      }
      pos += n;
    }
    return consumed;
  } finally {
    await fh.close();
  }
}

const TUR = Buffer.from(',"toolUseResult":');

/**
 * Parses a JSON line. For user records it drops the duplicate toolUseResult
 * (it repeats the result content and doubles parsing time).
 */
export function parseLine(line: Buffer): any {
  const cut = line.length > 4096 ? line.indexOf(TUR) : -1;
  if (cut > 0) {
    try {
      const o = JSON.parse(line.toString('utf8', 0, cut) + '}');
      if (o && o.message) return o;
    } catch { /* fall back to a full parse */ }
  }
  try {
    return JSON.parse(line.toString('utf8'));
  } catch {
    return null;
  }
}
