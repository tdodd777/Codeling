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
  cleanupInvalidSpecies(db);
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

// Data fix for saves carrying species keys that have since been removed from
// `SPECIES_CATALOG` (e.g., `robot` deleted in the no-art cleanup). Without
// this, an old save's active pet renders as a broken sprite in the tray + Home
// and the player has no in-app way to recover short of Reset Save. Cleans up
// dangling unlock rows and home-animation prefs for the same species.
function cleanupInvalidSpecies(d: Database.Database): void {
  const speciesKeys = Object.keys(SPECIES_CATALOG) as Species[];
  const valid = new Set<string>(speciesKeys);

  const pet = d
    .prepare<[], { species: string }>(`SELECT species FROM pet WHERE id = 1`)
    .get();
  if (pet && !valid.has(pet.species)) {
    const replacement = speciesKeys[Math.floor(Math.random() * speciesKeys.length)]!;
    d.prepare<[string]>(`UPDATE pet SET species = ? WHERE id = 1`).run(replacement);
    console.log(`[migrate] active species '${pet.species}' no longer valid; switched to '${replacement}'`);
  }

  const speciesUnlocks = d
    .prepare<[], { item_id: string }>(`SELECT item_id FROM unlocks WHERE category = 'species'`)
    .all();
  for (const row of speciesUnlocks) {
    if (!row.item_id.startsWith('species:')) continue;
    const key = row.item_id.slice('species:'.length);
    if (!valid.has(key)) {
      d.prepare<[string]>(`DELETE FROM unlocks WHERE item_id = ?`).run(row.item_id);
      console.log(`[migrate] dropped stale species unlock '${row.item_id}'`);
    }
  }

  const animUnlocks = d
    .prepare<[], { item_id: string }>(`SELECT item_id FROM unlocks WHERE category = 'animation'`)
    .all();
  for (const row of animUnlocks) {
    // anim:<species>:<name>
    const rest = row.item_id.startsWith('anim:') ? row.item_id.slice('anim:'.length) : null;
    if (!rest) continue;
    const colon = rest.indexOf(':');
    if (colon < 0) continue;
    const species = rest.slice(0, colon);
    if (!valid.has(species)) {
      d.prepare<[string]>(`DELETE FROM unlocks WHERE item_id = ?`).run(row.item_id);
      console.log(`[migrate] dropped stale animation unlock '${row.item_id}'`);
    }
  }

  const homeAnimRows = d
    .prepare<[], { key: string }>(`SELECT key FROM meta WHERE key LIKE 'home_animation:%'`)
    .all();
  for (const row of homeAnimRows) {
    const species = row.key.slice('home_animation:'.length);
    if (!valid.has(species)) {
      d.prepare<[string]>(`DELETE FROM meta WHERE key = ?`).run(row.key);
    }
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
