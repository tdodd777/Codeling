import { describe, it, expect } from 'vitest';
import { canonicalAnimationName, totalFrameCount } from './sprites';

// canonicalAnimationName drives the unlock id + pricing key. The mapping must
// be stable across folder-name variations or we'd duplicate-charge for the
// same animation under different aliases.
describe('canonicalAnimationName', () => {
  it('collapses idle-like folder names to "idle"', () => {
    expect(canonicalAnimationName('Breathing_Idle-3c8dc0f6')).toBe('idle');
    expect(canonicalAnimationName('Idle')).toBe('idle');
    expect(canonicalAnimationName('idle')).toBe('idle');
  });

  it('maps run/walk/attack folder prefixes to their canonical category', () => {
    expect(canonicalAnimationName('Running')).toBe('run');
    expect(canonicalAnimationName('Walking')).toBe('walk');
    expect(canonicalAnimationName('Attack')).toBe('attack');
  });

  it('preserves unrecognized folder names as their cleaned form', () => {
    expect(canonicalAnimationName('Attack2')).toBe('attack2');
    expect(canonicalAnimationName('Death-deadbeef')).toBe('death');
    expect(canonicalAnimationName('Hurt')).toBe('hurt');
  });

  it('returns one canonical name per folder (no aliasing surprises)', () => {
    // attack2 shouldn't collapse to "attack" — it's a distinct animation,
    // purchasable separately. Regression guard against future regex tweaks
    // that might over-collapse names.
    expect(canonicalAnimationName('attack2')).not.toBe('attack');
    expect(canonicalAnimationName('attack3')).not.toBe('attack');
  });
});

// totalFrameCount drives the alias-collision tiebreaker. Multiple folders
// can map to the same alias (Mimic's Idle_closed / idle_open /
// idle_transformed all → 'idle'); whichever has more frames wins.
describe('totalFrameCount', () => {
  it('sums frames across all populated directions', () => {
    expect(
      totalFrameCount({
        south: ['a.png', 'b.png', 'c.png'],
        north: ['d.png'],
      }),
    ).toBe(4);
  });

  it('returns 0 for an empty record', () => {
    expect(totalFrameCount({})).toBe(0);
  });

  it('ignores undefined direction entries', () => {
    expect(
      totalFrameCount({ south: ['a.png'], north: undefined }),
    ).toBe(1);
  });
});
