import { app } from 'electron';
import Database from 'better-sqlite3';
import path from 'node:path';
import { SPECIES_CATALOG, type Species } from '@shared/types';
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
  if (!sessionCols.includes('stop_event_count')) {
    d.exec(`ALTER TABLE sessions ADD COLUMN stop_event_count INTEGER NOT NULL DEFAULT 0`);
  }
}

// Insert default pet + spin_state rows if missing. Exported so reset-save can
// re-seed after wiping all rows; INSERT OR IGNORE keeps it safe to call any
// time the DB is in an unknown state. Also back-fills the current pet.species
// as an `unlocks` row so the player always owns whatever creature they're
// currently rendering as — this is the migration path for pre-pivot saves.
export function seedDefaults(d: Database.Database): void {
  const now = Date.now();

  // Random starter — picked once on first launch (or after resetSave). The
  // INSERT OR IGNORE means subsequent boots leave the existing pet untouched,
  // so the random pick is sticky for the life of the save.
  const speciesKeys = Object.keys(SPECIES_CATALOG) as Species[];
  const starter = speciesKeys[Math.floor(Math.random() * speciesKeys.length)]!;
  const starterLabel = SPECIES_CATALOG[starter].label;
  d.prepare(
    `INSERT OR IGNORE INTO pet (id, species, name, created_at) VALUES (1, ?, ?, ?)`,
  ).run(starter, starterLabel, now);

  d.prepare(
    `INSERT OR IGNORE INTO spin_state (id) VALUES (1)`,
  ).run();

  // Grant the current pet's species as an owned unlock. Idempotent — fresh
  // installs get the starter pre-owned; existing saves (pre-pivot) get their
  // active species back-filled so the shop's "owned" list isn't empty and the
  // achievement evaluator can count it.
  d.prepare(
    `INSERT OR IGNORE INTO unlocks (item_id, category, acquired_via, acquired_at)
     SELECT 'species:' || species, 'species', 'starter', created_at
       FROM pet WHERE id = 1`,
  ).run();
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
