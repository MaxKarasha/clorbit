// One-time copy of the pre-rename database (<repo>/data/fleet.db) into the data dir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { migrateLegacyDb } from '../config';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clorbit-config-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function legacyDb(name: string): string {
  const dir = path.join(tmp, name, 'repo-data');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'fleet.db');
  fs.writeFileSync(f, 'legacy');
  fs.writeFileSync(f + '-wal', 'wal');
  return f;
}

describe('legacy database migration', () => {
  it('copies fleet.db (with its WAL) into the default data dir once', () => {
    const legacy = legacyDb('default');
    const dbFile = path.join(tmp, 'default', 'home-clorbit', 'clorbit.db');
    expect(migrateLegacyDb({ dbFile, legacy, explicitDataDir: false })).toBe(legacy);
    expect(fs.readFileSync(dbFile, 'utf8')).toBe('legacy');
    expect(fs.readFileSync(dbFile + '-wal', 'utf8')).toBe('wal');
    // Second start: the database exists, nothing is copied again.
    fs.writeFileSync(dbFile, 'current');
    expect(migrateLegacyDb({ dbFile, legacy, explicitDataDir: false })).toBeNull();
    expect(fs.readFileSync(dbFile, 'utf8')).toBe('current');
  });

  it('leaves an explicitly configured data dir empty', () => {
    const legacy = legacyDb('explicit');
    const dbFile = path.join(tmp, 'explicit', 'custom-dir', 'clorbit.db');
    expect(migrateLegacyDb({ dbFile, legacy, explicitDataDir: true })).toBeNull();
    expect(fs.existsSync(dbFile)).toBe(false);
    expect(fs.existsSync(path.dirname(dbFile))).toBe(false);
  });

  it('does nothing when there is no legacy database', () => {
    const dbFile = path.join(tmp, 'none', 'clorbit.db');
    expect(migrateLegacyDb({ dbFile, legacy: path.join(tmp, 'none', 'fleet.db'), explicitDataDir: false })).toBeNull();
    expect(fs.existsSync(dbFile)).toBe(false);
  });
});
