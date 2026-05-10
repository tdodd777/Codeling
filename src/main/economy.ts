import type { Species } from '@shared/types';
import { getDb } from './db/client';
import { events } from './events';
import { stageForOutputTokens } from './evolution';

// Editable rate defaults. Live values come from the `meta` table (keys
// `economy:xpPerMessage`, etc.); defaults apply when no override is set.
// `xpForLevel` stays a function — it's the level-up curve formula, not a
// single tunable rate.
export const ECONOMY_RULE_KEYS = [
  'xpPerMessage',
  'xpPerOutputTokens',
  'bitsPerMessage',
  'bitsPerOutputTokens',
] as const;
export type EconomyRuleKey = (typeof ECONOMY_RULE_KEYS)[number];

export const ECONOMY_RULE_DEFAULTS: Record<EconomyRuleKey, number> = {
  xpPerMessage: 10,
  xpPerOutputTokens: 100, // 1 XP per N output tokens (integer division)
  bitsPerMessage: 5,
  bitsPerOutputTokens: 1000, // 1 bit per N output tokens
};

// Sane caps. Lower bound > 0 to avoid division-by-zero on the *PerOutputTokens
// fields and to keep the rates meaningful. Upper bound is wide; tune later.
export const ECONOMY_RULE_BOUNDS: Record<EconomyRuleKey, { min: number; max: number }> = {
  xpPerMessage:       { min: 0,  max: 1_000 },
  xpPerOutputTokens:  { min: 1,  max: 1_000_000 },
  bitsPerMessage:     { min: 0,  max: 1_000 },
  bitsPerOutputTokens:{ min: 1,  max: 1_000_000 },
};

export const RULES = {
  xpForLevel: (level: number) => level * 100, // XP needed to clear level → level+1
} as const;

export type EconomyRules = Record<EconomyRuleKey, number>;

function metaKey(key: EconomyRuleKey): string {
  return `economy:${key}`;
}

export function getEconomyRules(): EconomyRules {
  const db = getDb();
  const rows = db
    .prepare<[], { key: string; value: string }>(
      `SELECT key, value FROM meta WHERE key LIKE 'economy:%'`,
    )
    .all();
  const overrides = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as EconomyRules;
  for (const k of ECONOMY_RULE_KEYS) {
    const raw = overrides.get(metaKey(k));
    const n = raw !== undefined ? Number(raw) : NaN;
    out[k] = Number.isFinite(n) ? n : ECONOMY_RULE_DEFAULTS[k];
  }
  return out;
}

export function setEconomyRule(key: EconomyRuleKey, value: number): EconomyRules {
  if (!ECONOMY_RULE_KEYS.includes(key)) throw new Error('unknown-key');
  if (!Number.isInteger(value)) throw new Error('not-integer');
  const { min, max } = ECONOMY_RULE_BOUNDS[key];
  if (value < min || value > max) throw new Error('out-of-range');
  getDb()
    .prepare<[string, string]>(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`)
    .run(metaKey(key), String(value));
  return getEconomyRules();
}

export function resetEconomyRules(): EconomyRules {
  getDb().prepare(`DELETE FROM meta WHERE key LIKE 'economy:%'`).run();
  return getEconomyRules();
}

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

  const rules = getEconomyRules();
  const xpGained =
    d.messages * rules.xpPerMessage +
    Math.floor(d.outputTokens / rules.xpPerOutputTokens);
  let bitsGained =
    d.messages * rules.bitsPerMessage +
    Math.floor(d.outputTokens / rules.bitsPerOutputTokens);

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
