import type { Species } from '@shared/types';
import { getDb } from './db/client';
import { events } from './events';
import { stageForOutputTokens } from './evolution';

// Tunables — central so they're easy to rebalance later from a single place.
export const RULES = {
  xpPerMessage: 10,
  xpPerOutputTokens: 100, // 1 XP per N output tokens (integer division)
  bitsPerMessage: 5,
  bitsPerOutputTokens: 1000, // 1 bit per N output tokens
  xpForLevel: (level: number) => level * 100, // XP needed to clear level → level+1
} as const;

export interface RewardDeltas {
  messages: number;
  outputTokens: number;
}

export interface EconomyResult {
  xpGained: number;
  bitsGained: number;
  levelsGained: number;
  spinsGranted: number;
  evolved: boolean;
  newStage: number;
  changed: boolean;
}

interface PetRow {
  species: string;
  level: number;
  xp: number;
  bits: number;
  evolution_stage: number;
}

interface SpinRow {
  spins_available: number;
  messages_since_last_spin: number;
  spin_threshold: number;
}

export function applyEconomy(d: RewardDeltas): EconomyResult {
  const result: EconomyResult = {
    xpGained: 0,
    bitsGained: 0,
    levelsGained: 0,
    spinsGranted: 0,
    evolved: false,
    newStage: 0,
    changed: false,
  };
  if (d.messages <= 0 && d.outputTokens <= 0) return result;

  const xpGained =
    d.messages * RULES.xpPerMessage +
    Math.floor(d.outputTokens / RULES.xpPerOutputTokens);
  let bitsGained =
    d.messages * RULES.bitsPerMessage +
    Math.floor(d.outputTokens / RULES.bitsPerOutputTokens);

  if (xpGained === 0 && bitsGained === 0 && d.messages === 0) return result;

  const db = getDb();
  let evolution: { species: Species; from: number; to: number } | null = null;
  const tx = db.transaction(() => {
    // Permanent upgrades that scale earnings. Cheap query (one indexed lookup);
    // run inside the txn so a purchase that lands mid-batch is consistent.
    const has2xBits = !!db
      .prepare<[], { item_id: string }>(
        `SELECT item_id FROM unlocks WHERE category = 'upgrade' AND item_id = 'bit_multiplier_2x' LIMIT 1`,
      )
      .get();
    if (has2xBits) bitsGained *= 2;
    // Pet: apply XP/bits, then unroll level-ups carrying XP forward.
    const pet = db
      .prepare<[], PetRow>(
        `SELECT species, level, xp, bits, evolution_stage FROM pet WHERE id = 1`,
      )
      .get();
    if (!pet) throw new Error('pet row missing');

    let level = pet.level;
    let xp = pet.xp + xpGained;
    let levelsGained = 0;
    while (xp >= RULES.xpForLevel(level)) {
      xp -= RULES.xpForLevel(level);
      level += 1;
      levelsGained += 1;
      if (levelsGained > 100) break; // safety on absurd batches
    }
    const bits = pet.bits + bitsGained;

    // Evolution: derive from cumulative lifetime output tokens (sum across all
    // sessions). Session ops have already been committed by the time this runs
    // — see ingest.ts ordering. Stage only ever increases.
    const totals = db
      .prepare<[], { total: number | null }>(
        `SELECT COALESCE(SUM(output_tokens), 0) AS total FROM sessions`,
      )
      .get();
    const cumulativeOutput = totals?.total ?? 0;
    const targetStage = stageForOutputTokens(pet.species as Species, cumulativeOutput);
    const evolutionStage = Math.max(pet.evolution_stage, targetStage);

    db.prepare<[number, number, number, number]>(
      `UPDATE pet SET level = ?, xp = ?, bits = ?, evolution_stage = ? WHERE id = 1`,
    ).run(level, xp, bits, evolutionStage);

    if (evolutionStage > pet.evolution_stage) {
      evolution = { species: pet.species as Species, from: pet.evolution_stage, to: evolutionStage };
      result.evolved = true;
    }
    result.newStage = evolutionStage;
    result.xpGained = xpGained;
    result.bitsGained = bitsGained;
    result.levelsGained = levelsGained;

    // Spin: only user messages bump the counter.
    if (d.messages > 0) {
      const spin = db
        .prepare<[], SpinRow>(
          `SELECT spins_available, messages_since_last_spin, spin_threshold FROM spin_state WHERE id = 1`,
        )
        .get();
      if (!spin) throw new Error('spin_state row missing');

      let pending = spin.messages_since_last_spin + d.messages;
      let granted = 0;
      while (pending >= spin.spin_threshold) {
        pending -= spin.spin_threshold;
        granted += 1;
        if (granted > 100) break;
      }

      db.prepare<[number, number]>(
        `UPDATE spin_state SET spins_available = spins_available + ?, messages_since_last_spin = ? WHERE id = 1`,
      ).run(granted, pending);

      result.spinsGranted = granted;
    }

    result.changed = true;
  });
  tx();

  // Emit outside the txn — listeners (tray refresh, future notifications) shouldn't
  // run with the SQLite write-lock held.
  if (evolution) {
    const e = evolution as { species: Species; from: number; to: number };
    events.emit('pet:evolved', { species: e.species, fromStage: e.from, toStage: e.to });
  }

  return result;
}
