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
  seedIfEmpty(db);

  return db;
}

function seedIfEmpty(d: Database.Database): void {
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
