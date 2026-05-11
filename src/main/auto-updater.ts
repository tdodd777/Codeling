import { app } from 'electron';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';
import { getDb } from './db/client';

// Auto-update lifecycle. Uses update.electronjs.org as the free hosting feed
// — it consumes the repo's GitHub Releases and serves Squirrel.Windows /
// Squirrel.Mac feeds without our running any infra. The publisher-github
// config in forge.config.ts is what populates the releases this feed reads.
//
// Defaults ON. The persisted toggle lives in meta (`auto_update_enabled`),
// mirroring the telemetry pattern; a Settings toggle can flip it later
// without touching this file. Failures are silent — the app still works
// without updates.
//
// Skipped entirely when not packaged (dev mode) — the underlying autoUpdater
// throws on non-Squirrel binaries, and we don't want to spam the user's
// terminal during `npm start`.

const META_KEY = 'auto_update_enabled';

export function getAutoUpdateEnabled(): boolean {
  try {
    const row = getDb()
      .prepare<[string], { value: string }>(`SELECT value FROM meta WHERE key = ?`)
      .get(META_KEY);
    if (!row) return true;
    return row.value === '1';
  } catch {
    return true;
  }
}

export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    console.log('[updater] skipped — dev mode');
    return;
  }
  if (!getAutoUpdateEnabled()) {
    console.log('[updater] skipped — disabled in meta');
    return;
  }
  try {
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: 'tdodd777/Codeling',
      },
      // 10-min default is fine; the underlying autoUpdater enforces a 5-min
      // minimum, so anything lower would be silently clamped. Also debounces
      // on the user's bandwidth — checks once at startup, then on interval.
      updateInterval: '10 minutes',
      logger: {
        log: (...args: unknown[]) => console.log('[updater]', ...args),
        info: (...args: unknown[]) => console.log('[updater]', ...args),
        warn: (...args: unknown[]) => console.warn('[updater]', ...args),
        error: (...args: unknown[]) => console.error('[updater]', ...args),
      },
      notifyUser: true,
    });
  } catch (err) {
    // Unsigned macOS builds throw here. We log and move on — the app still
    // runs, users just won't get update prompts until certs are wired.
    console.error('[updater] init failed', err);
  }
}
