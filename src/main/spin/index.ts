import { SPECIES_CATALOG, type Species } from '@shared/types';
import { evaluateAchievements } from '../achievements';
import { getDb } from '../db/client';
import { RULES } from '../economy';
import { drawReward, SPECIES_TOKEN_CONSOLATION_BITS, type Reward, type Tier } from './rewards';

// Result handed back to the renderer. `applied` describes what actually happened
// — for species_token, `applied` may degrade to bits if all species are owned.
export interface SpinResult {
  reward: { id: string; kind: Reward['kind']; tier: Tier; label: string };
  applied:
    | { kind: 'bits'; amount: number; consolationFor?: 'species_token' }
    | { kind: 'xp'; amount: number; levelsGained: number }
    | { kind: 'species'; species: Species };
  spinsRemaining: number;
}

export type SpinError = { error: 'no-spins' };

export function performSpin(rng?: () => number): SpinResult | SpinError {
  const db = getDb();
  let outcome: SpinResult | SpinError = { error: 'no-spins' };

  const tx = db.transaction(() => {
    const spin = db
      .prepare<[], { spins_available: number }>(
        `SELECT spins_available FROM spin_state WHERE id = 1`,
      )
      .get();
    if (!spin || spin.spins_available <= 0) {
      outcome = { error: 'no-spins' };
      return;
    }

    db.prepare(`UPDATE spin_state SET spins_available = spins_available - 1 WHERE id = 1`).run();
    const remaining = spin.spins_available - 1;

    const reward = drawReward(rng);
    const rewardSummary = { id: reward.id, kind: reward.kind, tier: reward.tier, label: reward.label };

    if (reward.kind === 'bits') {
      db.prepare<[number]>(`UPDATE pet SET bits = bits + ? WHERE id = 1`).run(reward.amount);
      outcome = {
        reward: rewardSummary,
        applied: { kind: 'bits', amount: reward.amount },
        spinsRemaining: remaining,
      };
      return;
    }

    if (reward.kind === 'xp') {
      const pet = db
        .prepare<[], { level: number; xp: number }>(`SELECT level, xp FROM pet WHERE id = 1`)
        .get();
      if (!pet) throw new Error('pet row missing');
      let level = pet.level;
      let xp = pet.xp + reward.amount;
      let levelsGained = 0;
      while (xp >= RULES.xpForLevel(level)) {
        xp -= RULES.xpForLevel(level);
        level += 1;
        levelsGained += 1;
        if (levelsGained > 100) break;
      }
      db.prepare<[number, number]>(`UPDATE pet SET level = ?, xp = ? WHERE id = 1`).run(level, xp);
      outcome = {
        reward: rewardSummary,
        applied: { kind: 'xp', amount: reward.amount, levelsGained },
        spinsRemaining: remaining,
      };
      return;
    }

    // species_token — pick a random unowned species; if all owned, fall back
    // to consolation bits scaled to the legendary tier.
    const ownedRows = db
      .prepare<[], { item_id: string }>(
        `SELECT item_id FROM unlocks WHERE category = 'species'`,
      )
      .all();
    const ownedKeys = new Set(
      ownedRows.map((r) => r.item_id.slice('species:'.length) as Species),
    );
    const unowned = (Object.keys(SPECIES_CATALOG) as Species[]).filter((s) => !ownedKeys.has(s));
    if (unowned.length === 0) {
      db.prepare<[number]>(`UPDATE pet SET bits = bits + ? WHERE id = 1`).run(SPECIES_TOKEN_CONSOLATION_BITS);
      outcome = {
        reward: rewardSummary,
        applied: { kind: 'bits', amount: SPECIES_TOKEN_CONSOLATION_BITS, consolationFor: 'species_token' },
        spinsRemaining: remaining,
      };
      return;
    }
    // rng()-deterministic random pick for the species. The reward's RNG is the
    // same one passed into drawReward, so test seeds reach all the way through.
    const picker = rng ?? Math.random;
    const idx = Math.min(unowned.length - 1, Math.floor(picker() * unowned.length));
    const picked = unowned[idx]!;
    db.prepare<[string, number]>(
      `INSERT OR IGNORE INTO unlocks (item_id, category, acquired_via, acquired_at) VALUES (?, 'species', 'spin', ?)`,
    ).run(`species:${picked}`, Date.now());
    outcome = {
      reward: rewardSummary,
      applied: { kind: 'species', species: picked },
      spinsRemaining: remaining,
    };
  });
  tx();

  // A species_token landing adds a species to the collection — may flip an
  // unlock_species_* milestone. Player explicitly opts in to swap via the
  // shop's Set Active button, so no tray refresh fires from here.
  if (!('error' in outcome)) evaluateAchievements();

  return outcome;
}
