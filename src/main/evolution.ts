import type { Species } from '@shared/types';

// Cumulative output-token thresholds for advancing the pet's `evolution_stage`.
// Each entry is the lifetime output-token count required to *enter* that stage.
// Stage 0 is the starting form (no threshold). Stage N requires crossing
// EVOLUTIONS[species][N - 1].
//
// Numbers are placeholders tuned for "feels reachable in a few weeks of normal
// Claude Code use" — rebalance once art for stage 2/3 lands and we see real
// player pacing.
export const EVOLUTIONS: Record<Species, readonly number[]> = {
  wizard: [50_000, 200_000, 500_000],
  slime:  [50_000, 200_000, 500_000],
  robot:  [50_000, 200_000, 500_000],
};

export function stageForOutputTokens(species: Species, cumulativeOutputTokens: number): number {
  const thresholds = EVOLUTIONS[species] ?? [];
  let stage = 0;
  for (const t of thresholds) {
    if (cumulativeOutputTokens >= t) stage += 1;
    else break;
  }
  return stage;
}
