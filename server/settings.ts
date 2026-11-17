// User settings (GET/PUT /api/settings): one validated JSON document in the SQLite `settings` table.
import { EventEmitter } from 'node:events';
import { DEFAULT_SETTINGS, type Settings } from '../shared/api';
import { cloneSettings, normalizeSettings } from '../shared/settings';
import type { ClorbitDb } from './db';

const KEY = 'app';

export class SettingsStore extends EventEmitter {
  private current: Settings;

  constructor(private db: ClorbitDb | null) {
    super();
    let saved: unknown = null;
    try {
      const raw = db?.getSetting(KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {
      console.warn('[clorbit] stored settings are unreadable, using defaults:', (e as Error).message);
    }
    this.current = normalizeSettings(saved, DEFAULT_SETTINGS);
  }

  get(): Settings {
    return cloneSettings(this.current);
  }

  /** Merges a (partial) settings object, validates it, persists it and returns the result. */
  update(patch: unknown, now = Date.now()): Settings {
    this.current = normalizeSettings(patch, this.current, now);
    try {
      this.db?.setSetting(KEY, JSON.stringify(this.current), now);
    } catch (e) {
      console.error('[clorbit] could not save settings:', (e as Error).message);
    }
    this.emit('change', this.get());
    return this.get();
  }
}
