import { PET_NAME_MAX_LENGTH, type LifetimeStats, type PetState, type SignalType, type SpinState, type Transport, type UnlockedItem } from '@shared/types';
import type { SessionField, SessionOp } from '../otel/aggregator';
import { COSMETICS } from '../spin/rewards';
import { getDb } from './client';

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
  evolution_stage: number;
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
    evolutionStage: row.evolution_stage,
    level: row.level,
    xp: row.xp,
    bits: row.bits,
    createdAt: row.created_at,
  };
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
  equipped: number;
}

export function getUnlocks(): UnlockedItem[] {
  const rows = getDb()
    .prepare<[], UnlockRow>(`SELECT * FROM unlocks ORDER BY acquired_at DESC`)
    .all();
  return rows.map((r) => {
    // Cosmetic catalog is the source of truth for label/tier; if an item somehow
    // lands here without a registry entry (legacy save?), fall back gracefully.
    const def = COSMETICS[r.item_id];
    return {
      itemId: r.item_id,
      category: r.category,
      acquiredVia: r.acquired_via,
      acquiredAt: r.acquired_at,
      equipped: r.equipped !== 0,
      label: def?.label ?? r.item_id,
      tier: def?.tier ?? 'common',
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
