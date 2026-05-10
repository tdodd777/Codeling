import { getDb } from './db/client';
import { events } from './events';

// Achievement registry. Each entry is checked against a Snapshot of current
// state (cheap derived totals) on every "tick" — defined as ingest, spin, or
// purchase. Newly-eligible defs get persisted + an event fires; persisted
// achievements are skipped on subsequent checks.
//
// Design intent: derive everything from existing tables. No new tracking
// columns, no high-water-mark fields. If a player resets their save, all
// achievements unearn cleanly with the rest.

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface AchievementDef {
  id: string;
  label: string;
  description: string;
  tier: AchievementTier;
  check: (s: Snapshot) => boolean;
}

interface Snapshot {
  pet: { level: number; evolutionStage: number };
  totals: { messages: number; outputTokens: number; costUsd: number };
  unlockCounts: { cosmetic: number; upgrade: number };
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // Engagement
  { id: 'first_message', label: 'First word',  description: 'Send your first message',
    tier: 'bronze', check: (s) => s.totals.messages >= 1 },
  { id: 'msg_100',       label: 'Chatterbox',  description: '100 messages',
    tier: 'silver', check: (s) => s.totals.messages >= 100 },
  { id: 'msg_1000',      label: 'Loquacious',  description: '1,000 messages',
    tier: 'gold',   check: (s) => s.totals.messages >= 1000 },

  // Progression
  { id: 'level_5',  label: 'Apprentice',  description: 'Reach level 5',
    tier: 'bronze', check: (s) => s.pet.level >= 5 },
  { id: 'level_25', label: 'Adept',       description: 'Reach level 25',
    tier: 'silver', check: (s) => s.pet.level >= 25 },
  { id: 'level_100', label: 'Master',     description: 'Reach level 100',
    tier: 'gold',   check: (s) => s.pet.level >= 100 },

  // Evolution
  { id: 'evolve_1', label: 'Glow up',     description: 'First evolution',
    tier: 'bronze', check: (s) => s.pet.evolutionStage >= 1 },
  { id: 'evolve_2', label: 'Ascendant',   description: 'Reach evolution stage 2',
    tier: 'silver', check: (s) => s.pet.evolutionStage >= 2 },
  { id: 'evolve_3', label: 'Apotheosis',  description: 'Reach evolution stage 3',
    tier: 'gold',   check: (s) => s.pet.evolutionStage >= 3 },

  // Collection
  { id: 'first_cosmetic', label: 'Drip',       description: 'Own your first cosmetic',
    tier: 'bronze', check: (s) => s.unlockCounts.cosmetic >= 1 },
  { id: 'first_upgrade',  label: 'Power play', description: 'Buy your first upgrade',
    tier: 'silver', check: (s) => s.unlockCounts.upgrade >= 1 },

  // Cost milestones — Claude's not free; track the dollars
  { id: 'spend_1usd',  label: 'Tokens count',   description: '$1 of session cost',
    tier: 'bronze', check: (s) => s.totals.costUsd >= 1 },
  { id: 'spend_10usd', label: 'Heavy lifting',  description: '$10 of session cost',
    tier: 'silver', check: (s) => s.totals.costUsd >= 10 },
];

function buildSnapshot(): Snapshot {
  const db = getDb();
  const pet = db
    .prepare<[], { level: number; evolution_stage: number }>(
      `SELECT level, evolution_stage FROM pet WHERE id = 1`,
    )
    .get();
  const totals = db
    .prepare<[], {
      messages: number | null;
      output_tokens: number | null;
      cost_usd: number | null;
    }>(
      `SELECT
         COALESCE(SUM(message_count), 0) AS messages,
         COALESCE(SUM(output_tokens), 0) AS output_tokens,
         COALESCE(SUM(cost_usd), 0) AS cost_usd
       FROM sessions`,
    )
    .get();
  const counts = db
    .prepare<[], { cosmetic: number; upgrade: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN category = 'cosmetic' THEN 1 ELSE 0 END), 0) AS cosmetic,
         COALESCE(SUM(CASE WHEN category = 'upgrade'  THEN 1 ELSE 0 END), 0) AS upgrade
       FROM unlocks`,
    )
    .get();

  return {
    pet: {
      level: pet?.level ?? 1,
      evolutionStage: pet?.evolution_stage ?? 0,
    },
    totals: {
      messages: totals?.messages ?? 0,
      outputTokens: totals?.output_tokens ?? 0,
      costUsd: totals?.cost_usd ?? 0,
    },
    unlockCounts: {
      cosmetic: counts?.cosmetic ?? 0,
      upgrade: counts?.upgrade ?? 0,
    },
  };
}

// Persists newly-earned defs + emits `achievement:earned` for each. Idempotent
// — re-running with no state change is a no-op. Safe to call from any state-
// mutating path; we centralize it so a single place owns the timing decision.
//
// `silent`: skip event emission. Used for the boot-time backfill — an existing
// save updated to a new version with new achievement defs would otherwise
// flood the OS notification stack with everything-eligible-at-once on the
// first ingest tick. Subsequent calls emit normally so genuine progress still
// notifies.
export function evaluateAchievements(silent = false): void {
  const db = getDb();
  const earnedRows = db
    .prepare<[], { id: string }>(`SELECT id FROM achievements`)
    .all();
  const earned = new Set(earnedRows.map((r) => r.id));

  const snapshot = buildSnapshot();
  const insert = db.prepare<[string, number]>(
    `INSERT OR IGNORE INTO achievements (id, earned_at) VALUES (?, ?)`,
  );
  const now = Date.now();
  const newlyEarned: AchievementDef[] = [];

  for (const def of ACHIEVEMENTS) {
    if (earned.has(def.id)) continue;
    if (!def.check(snapshot)) continue;
    insert.run(def.id, now);
    newlyEarned.push(def);
  }

  if (silent) return;
  for (const def of newlyEarned) {
    events.emit('achievement:earned', {
      id: def.id,
      label: def.label,
      description: def.description,
      tier: def.tier,
      earnedAt: now,
    });
  }
}
