import { describe, it, expect } from 'vitest';
import { drawReward, REWARDS } from './rewards';

// Seeded RNG: a tiny LCG so we can write deterministic distribution tests
// without bringing in seedrandom. Quality is poor in absolute terms but
// fine for "is the weighted draw deterministic for a given seed" checks.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('drawReward', () => {
  it('returns a reward for any valid roll', () => {
    const ids = new Set(REWARDS.map((r) => r.id));
    for (let i = 0; i < 100; i++) {
      const reward = drawReward(lcg(i + 1));
      expect(ids.has(reward.id)).toBe(true);
    }
  });

  it('is deterministic for a given RNG sequence', () => {
    const a = drawReward(lcg(42));
    const b = drawReward(lcg(42));
    expect(a.id).toBe(b.id);
  });

  it('respects weight ordering across many draws', () => {
    // The first reward (`bits_small`, weight 40) should land more often than
    // the rarest legendary (weight 1) over a healthy sample.
    const counts = new Map<string, number>();
    const rng = lcg(2026_05_10);
    for (let i = 0; i < 5000; i++) {
      const r = drawReward(rng);
      counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
    }
    const small = counts.get('bits_small') ?? 0;
    const jackpot = counts.get('bits_jackpot') ?? 0;
    expect(small).toBeGreaterThan(jackpot * 8); // weight 40 vs 1 — generous margin
  });

  it('handles RNG returning a value at the upper edge', () => {
    // rng() ≈ 1 should still produce a valid reward (numerical edge case).
    const r = drawReward(() => 0.999_999_999);
    expect(REWARDS.some((d) => d.id === r.id)).toBe(true);
  });
});
