import { dialog } from 'electron';
import fs from 'node:fs/promises';
import { getDb, seedDefaults } from './db/client';

// Save export/import format. Version is bumped any time the on-disk JSON shape
// changes incompatibly — older versions can be migrated forward in
// `importSave`, never backward (newer version on older app = error).
export const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  exportedAt: number;
  pet: unknown[];
  sessions: unknown[];
  unlocks: unknown[];
  spin_state: unknown[];
  achievements: unknown[];
  daily_activity: unknown[];
}

const TABLES = ['pet', 'sessions', 'unlocks', 'spin_state', 'achievements', 'daily_activity'] as const;
type TableName = (typeof TABLES)[number];

function dumpTable(name: TableName): unknown[] {
  return getDb().prepare(`SELECT * FROM ${name}`).all();
}

function buildSave(): SaveFile {
  return {
    version: SAVE_VERSION,
    exportedAt: Date.now(),
    pet: dumpTable('pet'),
    sessions: dumpTable('sessions'),
    unlocks: dumpTable('unlocks'),
    spin_state: dumpTable('spin_state'),
    achievements: dumpTable('achievements'),
    daily_activity: dumpTable('daily_activity'),
  };
}

export async function exportSaveDialog(): Promise<
  { ok: true; path: string } | { error: 'cancelled' | 'write-failed'; detail?: string }
> {
  const defaultName = `codeling-save-${new Date().toISOString().slice(0, 10)}.json`;
  const result = await dialog.showSaveDialog({
    title: 'Export Codeling save',
    defaultPath: defaultName,
    filters: [{ name: 'Codeling save', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { error: 'cancelled' };

  try {
    const json = JSON.stringify(buildSave(), null, 2);
    await fs.writeFile(result.filePath, json, 'utf8');
    return { ok: true, path: result.filePath };
  } catch (err) {
    return { error: 'write-failed', detail: (err as Error).message };
  }
}

// Replace strategy: wipe all user tables, then insert each row from the save
// file into its table by column name. Atomic txn — if any insert fails, the
// previous save is intact. Re-seed defaults afterward so any tables the save
// didn't include (e.g., empty `pet` from a malformed export) come back to a
// known-good state. Unknown columns in the JSON are silently dropped — useful
// when importing an older save into a newer schema.
function applySave(file: SaveFile): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.exec(`DELETE FROM otel_events`); // event log isn't exported; clear so user sees a fresh log
    for (const t of TABLES) db.exec(`DELETE FROM ${t}`);

    for (const t of TABLES) {
      const rows = file[t] as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(rows) || rows.length === 0) continue;
      // Discover real columns to filter unknown keys.
      const tableCols = (db.pragma(`table_info(${t})`) as { name: string }[]).map((c) => c.name);
      const allowed = new Set(tableCols);
      for (const row of rows) {
        const cols = Object.keys(row).filter((k) => allowed.has(k));
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => '?').join(', ');
        const stmt = db.prepare(
          `INSERT OR REPLACE INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`,
        );
        stmt.run(...cols.map((c) => row[c]));
      }
    }

    seedDefaults(db); // any tables left empty get default rows back
  });
  tx();
}

export async function importSaveDialog(): Promise<
  | { ok: true; path: string }
  | { error: 'cancelled' | 'read-failed' | 'invalid-format' | 'unsupported-version'; detail?: string }
> {
  const result = await dialog.showOpenDialog({
    title: 'Import Codeling save',
    filters: [{ name: 'Codeling save', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return { error: 'cancelled' };

  const path = result.filePaths[0]!;
  let raw: string;
  try {
    raw = await fs.readFile(path, 'utf8');
  } catch (err) {
    return { error: 'read-failed', detail: (err as Error).message };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { error: 'invalid-format', detail: (err as Error).message };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { error: 'invalid-format', detail: 'not an object' };
  }
  const file = parsed as Partial<SaveFile>;
  if (typeof file.version !== 'number') {
    return { error: 'invalid-format', detail: 'missing version' };
  }
  if (file.version > SAVE_VERSION) {
    return { error: 'unsupported-version', detail: `save v${file.version} > app v${SAVE_VERSION}` };
  }

  applySave(file as SaveFile);
  return { ok: true, path };
}
