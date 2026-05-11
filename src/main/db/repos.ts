import {
  PET_NAME_MAX_LENGTH,
  SPECIES_CATALOG,
  SPIN_THRESHOLD_MAX,
  SPIN_THRESHOLD_MIN,
  type AchievementView,
  type LifetimeStats,
  type PetState,
  type SignalType,
  type SpinState,
  type Transport,
  type UnlockedItem,
  type Species,
} from '@shared/types';
import { ACHIEVEMENTS } from '../achievements';
import type { SessionField, SessionOp } from '../otel/aggregator';
import { getDb, seedDefaults } from './client';

const VALID_FIELDS: ReadonlySet<SessionField> = new Set([
  'message_count',
  'input_tokens',
  'output_tokens',
  'cache_read_tokens',
  'cache_creation_tokens',
  'cost_usd',
]);

interface PetRow {
  species: string;
  name: string;
  level: number;
  xp: number;
  bits: number;
  created_at: number;
}

interface SpinRow {
  spins_available: number;
  messages_since_last_spin: number;
  spin_threshold: number;
}

export function getPet(): PetState {
  const row = getDb().prepare<[], PetRow>(`SELECT * FROM pet WHERE id = 1`).get();
  if (!row) throw new Error('pet row missing — seed did not run');
  return {
    species: row.species as PetState['species'],
    name: row.name,
    level: row.level,
    xp: row.xp,
    bits: row.bits,
    createdAt: row.created_at,
  };
}

// Switch active pet. Validates ownership via the unlocks table — every species
// the player can become must have been auto-granted (starter) or purchased.
export function setActiveSpecies(species: Species): { ok: true; species: Species; name: string } | { error: 'not-owned' } {
  if (!(species in SPECIES_CATALOG)) return { error: 'not-owned' };
  const db = getDb();
  const owned = db
    .prepare<[string], { item_id: string }>(
      `SELECT item_id FROM unlocks WHERE category = 'species' AND item_id = ?`,
    )
    .get(`species:${species}`);
  if (!owned) return { error: 'not-owned' };
  db.prepare<[string]>(`UPDATE pet SET species = ? WHERE id = 1`).run(species);
  const pet = getPet();
  return { ok: true, species, name: pet.name };
}

// Spin threshold range constants live in shared/types.ts so renderer + main agree.
// Below 5 turns spins into spam; above 1000 makes the wheel feel unreachable.
export function setSpinThreshold(n: number): number {
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error('not-integer');
  if (n < SPIN_THRESHOLD_MIN || n > SPIN_THRESHOLD_MAX) throw new Error('out-of-range');
  getDb().prepare<[number]>(`UPDATE spin_state SET spin_threshold = ? WHERE id = 1`).run(n);
  return n;
}

// Wipe everything except schema, then re-seed defaults. Atomic — if anything
// throws mid-wipe the user's save stays intact.
export function resetSave(): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.exec(`DELETE FROM otel_events`);
    db.exec(`DELETE FROM achievements`);
    db.exec(`DELETE FROM daily_activity`);
    db.exec(`DELETE FROM meta`);
    db.exec(`DELETE FROM unlocks`);
    db.exec(`DELETE FROM sessions`);
    db.exec(`DELETE FROM spin_state`);
    db.exec(`DELETE FROM pet`);
    seedDefaults(db);
  });
  tx();
}

// Constraints: trim outer whitespace, reject empty, cap at PET_NAME_MAX_LENGTH.
// Returns the canonical name actually written, or throws if invalid — callers
// surface the error as a renderer-side validation message.
export function renamePet(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('empty-name');
  if (trimmed.length > PET_NAME_MAX_LENGTH) throw new Error('name-too-long');
  getDb().prepare<[string]>(`UPDATE pet SET name = ? WHERE id = 1`).run(trimmed);
  return trimmed;
}

export function getSpinState(): SpinState {
  const row = getDb().prepare<[], SpinRow>(`SELECT * FROM spin_state WHERE id = 1`).get();
  if (!row) throw new Error('spin_state row missing — seed did not run');
  return {
    spinsAvailable: row.spins_available,
    messagesSinceLastSpin: row.messages_since_last_spin,
    spinThreshold: row.spin_threshold,
  };
}

export function getLifetimeStats(): LifetimeStats {
  const row = getDb()
    .prepare<[], {
      total_messages: number | null;
      total_input: number | null;
      total_output: number | null;
      total_cache_read: number | null;
      total_cache_create: number | null;
      total_cost: number | null;
      session_count: number;
    }>(
      `SELECT
         COALESCE(SUM(message_count), 0)         AS total_messages,
         COALESCE(SUM(input_tokens), 0)          AS total_input,
         COALESCE(SUM(output_tokens), 0)         AS total_output,
         COALESCE(SUM(cache_read_tokens), 0)     AS total_cache_read,
         COALESCE(SUM(cache_creation_tokens), 0) AS total_cache_create,
         COALESCE(SUM(cost_usd), 0)              AS total_cost,
         COUNT(*)                                AS session_count
       FROM sessions`,
    )
    .get();

  return {
    totalMessages: row?.total_messages ?? 0,
    totalInputTokens: row?.total_input ?? 0,
    totalOutputTokens: row?.total_output ?? 0,
    totalCacheReadTokens: row?.total_cache_read ?? 0,
    totalCacheCreationTokens: row?.total_cache_create ?? 0,
    totalCostUsd: row?.total_cost ?? 0,
    sessionCount: row?.session_count ?? 0,
  };
}

interface UnlockRow {
  item_id: string;
  category: string;
  acquired_via: string;
  acquired_at: number;
}

export function getUnlocks(): UnlockedItem[] {
  const rows = getDb()
    .prepare<[], UnlockRow>(
      `SELECT item_id, category, acquired_via, acquired_at FROM unlocks ORDER BY acquired_at DESC`,
    )
    .all();
  return rows.map((r) => {
    let label = r.item_id;
    let tier: UnlockedItem['tier'] = 'common';
    if (r.category === 'species' && r.item_id.startsWith('species:')) {
      const species = r.item_id.slice('species:'.length) as Species;
      const info = SPECIES_CATALOG[species];
      if (info) {
        label = info.label;
        tier = info.tier;
      }
    }
    return {
      itemId: r.item_id,
      category: r.category,
      acquiredVia: r.acquired_via,
      acquiredAt: r.acquired_at,
      label,
      tier,
    };
  });
}

export function getAchievementsView(): AchievementView[] {
  const rows = getDb()
    .prepare<[], { id: string; earned_at: number }>(
      `SELECT id, earned_at FROM achievements`,
    )
    .all();
  const earnedMap = new Map(rows.map((r) => [r.id, r.earned_at]));
  return ACHIEVEMENTS.map((def) => {
    const earnedAt = earnedMap.get(def.id);
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      tier: def.tier,
      earned: earnedAt !== undefined,
      earnedAt,
    };
  });
}

export function recordOtelEvent(
  signalType: SignalType,
  transport: Transport,
  payload: unknown,
): void {
  getDb()
    .prepare(
      `INSERT INTO otel_events (signal_type, transport, received_at, payload) VALUES (?, ?, ?, ?)`,
    )
    .run(signalType, transport, Date.now(), JSON.stringify(payload));
}

export function applySessionOps(ops: SessionOp[]): void {
  if (ops.length === 0) return;
  const db = getDb();

  const ensure = db.prepare<[string, number, number]>(
    `INSERT OR IGNORE INTO sessions (session_id, started_at, last_seen_at) VALUES (?, ?, ?)`,
  );
  const ping = db.prepare<[number, string]>(
    `UPDATE sessions SET last_seen_at = MAX(last_seen_at, ?) WHERE session_id = ?`,
  );
  // Field name comes from a typed enum and is validated against an allow-list,
  // so interpolating it into the SQL string is injection-safe.
  type UpdateStmt = ReturnType<typeof db.prepare<[number, number, string]>>;
  const updateStmts = new Map<SessionField, UpdateStmt>();
  function updateFor(field: SessionField): UpdateStmt {
    let s = updateStmts.get(field);
    if (!s) {
      s = db.prepare<[number, number, string]>(
        `UPDATE sessions
            SET ${field} = ${field} + ?,
                last_seen_at = MAX(last_seen_at, ?)
          WHERE session_id = ?`,
      );
      updateStmts.set(field, s);
    }
    return s;
  }

  const tx = db.transaction((batch: SessionOp[]) => {
    for (const op of batch) {
      ensure.run(op.sessionId, op.timestampMs, op.timestampMs);
      if (op.field && op.delta && op.delta !== 0) {
        if (!VALID_FIELDS.has(op.field)) continue;
        updateFor(op.field).run(op.delta, op.timestampMs, op.sessionId);
      } else {
        ping.run(op.timestampMs, op.sessionId);
      }
    }
  });
  tx(ops);
}
