import { describe, it, expect } from 'vitest';
import { localDateString } from './streaks';

describe('localDateString', () => {
  it('formats as YYYY-MM-DD', () => {
    const d = new Date(2026, 0, 7); // Jan 7 2026 local
    expect(localDateString(d)).toBe('2026-01-07');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDateString(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(localDateString(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('uses local time, not UTC', () => {
    // Construct a Date that's late evening local time on Jan 1 — the UTC date
    // for many timezones would be Jan 2. localDateString should still return
    // the local-day. The exact result depends on the test runner's TZ; we just
    // assert the returned string parses to a date whose local components match
    // the inputs.
    const d = new Date(2026, 5, 15, 23, 30, 0); // June 15 11:30 PM local
    expect(localDateString(d)).toBe('2026-06-15');
  });

  it('defaults to today when called with no argument', () => {
    const result = localDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
