// Spin wheel reward catalog. Tiers drive both visual treatment in the toast and
// the consolation amount when a cosmetic is rolled but already owned.
//
// Rebalance freely — weights are relative, the draw normalizes them. Total weight
// across all rewards roughly correlates to perceived rarity; legendary at 1/100
// is rare enough to feel exciting without being mythical.

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
  | (Base & { kind: 'cosmetic'; cosmeticId: string; description?: string });

export const REWARDS: readonly Reward[] = [
  // bits drops — the bread and butter
  { id: 'bits_small',    kind: 'bits', tier: 'common',    weight: 40, amount: 25,   label: '+25 bits' },
  { id: 'bits_medium',   kind: 'bits', tier: 'uncommon',  weight: 18, amount: 75,   label: '+75 bits' },
  { id: 'bits_large',    kind: 'bits', tier: 'rare',      weight: 6,  amount: 200,  label: '+200 bits' },
  { id: 'bits_jackpot',  kind: 'bits', tier: 'legendary', weight: 1,  amount: 1000, label: '+1000 bits' },

  // xp boosts
  { id: 'xp_small', kind: 'xp', tier: 'uncommon', weight: 12, amount: 50,  label: '+50 XP' },
  { id: 'xp_large', kind: 'xp', tier: 'rare',     weight: 3,  amount: 200, label: '+200 XP' },

  // cosmetics — wheel-exclusive for now; shop catalog will introduce paid ones in M1.4
  { id: 'cos_party_hat', kind: 'cosmetic', tier: 'uncommon',  weight: 8, cosmeticId: 'party_hat', label: 'Party Hat' },
  { id: 'cos_monocle',   kind: 'cosmetic', tier: 'rare',      weight: 4, cosmeticId: 'monocle',   label: 'Monocle' },
  { id: 'cos_crown',     kind: 'cosmetic', tier: 'legendary', weight: 2, cosmeticId: 'crown',     label: 'Royal Crown' },
];

export interface CosmeticDef {
  label: string;
  description?: string;
  tier: Tier;
}

// Authoritative cosmetic registry — keyed by the value stored in unlocks.item_id.
// The Shop's "owned" section resolves item_id → label/tier through this map.
// Includes both wheel-rolled and shop-buyable cosmetics; the SHOP_ITEMS list in
// shop/catalog.ts references entries here by id.
export const COSMETICS: Record<string, CosmeticDef> = {
  // wheel-rolled
  party_hat: { label: 'Party Hat',   tier: 'uncommon' },
  monocle:   { label: 'Monocle',     tier: 'rare' },
  crown:     { label: 'Royal Crown', tier: 'legendary' },
  // shop-buyable
  glasses:   { label: 'Glasses',     tier: 'common' },
  witch_hat: { label: 'Witch Hat',   tier: 'uncommon' },
};

// Bits handed out when a cosmetic roll lands on something the pet already owns.
// Scales with tier so a duplicated legendary still feels like a win.
export const CONSOLATION_BITS: Record<Tier, number> = {
  common: 10,
  uncommon: 25,
  rare: 75,
  legendary: 250,
};

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
