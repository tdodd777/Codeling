import { describe, it, expect } from 'vitest';
import { EVOLUTIONS, stageForOutputTokens } from './evolution';

describe('stageForOutputTokens', () => {
  it('returns stage 0 with zero tokens', () => {
    expect(stageForOutputTokens('wizard', 0)).toBe(0);
  });

  it('returns stage 0 just below the first threshold', () => {
    const t1 = EVOLUTIONS.wizard[0]!;
    expect(stageForOutputTokens('wizard', t1 - 1)).toBe(0);
  });

  it('returns stage 1 exactly at the first threshold', () => {
    const t1 = EVOLUTIONS.wizard[0]!;
    expect(stageForOutputTokens('wizard', t1)).toBe(1);
  });

  it('advances by one per threshold crossed', () => {
    const [t1, t2, t3] = EVOLUTIONS.wizard as readonly number[];
    expect(stageForOutputTokens('wizard', t1!)).toBe(1);
    expect(stageForOutputTokens('wizard', t2!)).toBe(2);
    expect(stageForOutputTokens('wizard', t3!)).toBe(3);
  });

  it('caps at the highest defined stage', () => {
    expect(stageForOutputTokens('wizard', 10_000_000)).toBe(EVOLUTIONS.wizard.length);
  });

  it('treats unknown species as no-evolution if missing from EVOLUTIONS', () => {
    // Defensive — caller passes an unknown species string. Our table covers all
    // declared Species today; this asserts the helper doesn't throw on a stale
    // species name from a future save migration.
    const stage = stageForOutputTokens('mystery' as 'wizard', 999_999);
    expect(stage).toBe(0);
  });
});
