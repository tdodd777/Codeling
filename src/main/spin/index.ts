import { evaluateAchievements } from '../achievements';
import { getDb } from '../db/client';
import { RULES } from '../economy';
import { CONSOLATION_BITS, drawReward, type Reward, type Tier } from './rewards';

// Result handed back to the renderer. `applied` describes what actually happened
// (separate from `reward` because a duplicate cosmetic falls back to bits).
export interface SpinResult {
  reward: { id: string; kind: Reward['kind']; tier: Tier; label: string };
  applied:
    | { kind: 'bits'; amount: number; consolationFor?: string } // consolationFor = duplicate cosmeticId
    | { kind: 'xp'; amount: number; levelsGained: number }
    | { kind: 'cosmetic'; cosmeticId: string };
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

    // Cosmetic. PRIMARY KEY conflict on duplicate roll → INSERT OR IGNORE returns
    // changes=0, and we hand out consolation bits scaled by tier instead.
    const ins = db
      .prepare<[string, number]>(
        `INSERT OR IGNORE INTO unlocks (item_id, category, acquired_via, acquired_at) VALUES (?, 'cosmetic', 'spin', ?)`,
      )
      .run(reward.cosmeticId, Date.now());
    if (ins.changes === 0) {
      const amount = CONSOLATION_BITS[reward.tier];
      db.prepare<[number]>(`UPDATE pet SET bits = bits + ? WHERE id = 1`).run(amount);
      outcome = {
        reward: rewardSummary,
        applied: { kind: 'bits', amount, consolationFor: reward.cosmeticId },
        spinsRemaining: remaining,
      };
      return;
    }
    outcome = {
      reward: rewardSummary,
      applied: { kind: 'cosmetic', cosmeticId: reward.cosmeticId },
      spinsRemaining: remaining,
    };
  });
  tx();

  // Cosmetic-from-wheel and (future) spin-count achievements may flip after a
  // successful spin. Eval outside the txn — listener side-effects shouldn't run
  // with the SQLite write-lock held.
  if (!('error' in outcome)) evaluateAchievements();

  return outcome;
}
