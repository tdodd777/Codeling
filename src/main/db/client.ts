import { app } from 'electron';
import Database from 'better-sqlite3';
import path from 'node:path';
import schemaSql from './schema.sql?raw';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'codeling.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(schemaSql);
  runMigrations(db);
  seedDefaults(db);

  return db;
}

// Idempotent column-add migrations — schema.sql is the source of truth for new
// installs, this brings older DBs in sync. SQLite has no `ADD COLUMN IF NOT
// EXISTS`, so we probe `pragma table_info` first.
function runMigrations(d: Database.Database): void {
  const sessionCols = (d.pragma('table_info(sessions)') as { name: string }[]).map((c) => c.name);
  if (!sessionCols.includes('cost_usd')) {
    d.exec(`ALTER TABLE sessions ADD COLUMN cost_usd REAL NOT NULL DEFAULT 0`);
  }
}

// Insert default pet + spin_state rows if missing. Exported so reset-save can
// re-seed after wiping all rows; INSERT OR IGNORE keeps it safe to call any
// time the DB is in an unknown state.
export function seedDefaults(d: Database.Database): void {
  const now = Date.now();

  // Default starter is the wizard so the bundled south sprite renders out of the box.
  // Random species assignment + silhouette reveal lands when species 2/3 art exists.
  d.prepare(
    `INSERT OR IGNORE INTO pet (id, species, name, created_at) VALUES (1, ?, ?, ?)`,
  ).run('wizard', 'Wizard', now);

  d.prepare(
    `INSERT OR IGNORE INTO spin_state (id) VALUES (1)`,
  ).run();
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
