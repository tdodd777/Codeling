// Spin wheel reward catalog. Bits + XP for now; species-unlock tokens (rare)
// land in M2. Tiers drive visual treatment in the toast.
//
// Rebalance freely — weights are relative, the draw normalizes them.

export type Tier = 'common' | 'uncommon' | 'rare' | 'legendary';

interface Base {
  id: string;
  tier: Tier;
  weight: number;
  label: string;
}

export type Reward =
  | (Base & { kind: 'bits'; amount: number })
  | (Base & { kind: 'xp'; amount: number })
  | (Base & { kind: 'species_token' });

export const REWARDS: readonly Reward[] = [
  // bits drops — the bread and butter
  { id: 'bits_small',    kind: 'bits', tier: 'common',    weight: 40, amount: 25,   label: '+25 bits' },
  { id: 'bits_medium',   kind: 'bits', tier: 'uncommon',  weight: 18, amount: 75,   label: '+75 bits' },
  { id: 'bits_large',    kind: 'bits', tier: 'rare',      weight: 6,  amount: 200,  label: '+200 bits' },
  { id: 'bits_jackpot',  kind: 'bits', tier: 'legendary', weight: 1,  amount: 1000, label: '+1000 bits' },

  // xp boosts
  { id: 'xp_small', kind: 'xp', tier: 'uncommon', weight: 12, amount: 50,  label: '+50 XP' },
  { id: 'xp_large', kind: 'xp', tier: 'rare',     weight: 3,  amount: 200, label: '+200 XP' },

  // Rare species unlock token — picks a random unowned species. Weight 1 keeps
  // it at roughly 1.2% of all spins (1 / 81 total weight). If the player owns
  // every species, the token converts to consolation bits in the handler.
  { id: 'species_token', kind: 'species_token', tier: 'legendary', weight: 1, label: 'New Species!' },
];

// Consolation bits for when a species_token lands but every species is owned.
// Matches the legendary tier — the rarity of the draw should still feel
// rewarding even when it can't pay out as a unique unlock.
export const SPECIES_TOKEN_CONSOLATION_BITS = 500;

// Weighted draw. `rng` is injectable for tests; defaults to Math.random.
export function drawReward(rng: () => number = Math.random): Reward {
  const total = REWARDS.reduce((sum, r) => sum + r.weight, 0);
  let roll = rng() * total;
  for (const r of REWARDS) {
    roll -= r.weight;
    if (roll < 0) return r;
  }
  // Numerical edge case (rng returns ~1.0): return the last entry.
  return REWARDS[REWARDS.length - 1]!;
}
