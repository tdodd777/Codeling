import { getDb } from './db/client';

// Daily streak — count of consecutive days (in the user's local timezone) on
// which they had at least one user message ingested. We bucket by local date
// rather than UTC so "day" matches the user's perceived calendar; downside is
// streak behavior near DST transitions and traveling across timezones is
// timezone-dependent. Acceptable simplification — the alternative (UTC days)
// would cause a US user a 4 PM "day rolled over" surprise.

export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return localDateString(d);
}

export function recordActivityToday(): void {
  getDb()
    .prepare<[string]>(`INSERT OR IGNORE INTO daily_activity (date) VALUES (?)`)
    .run(localDateString());
}

// Current streak: consecutive days with activity ending today (preferred) or
// yesterday (still "alive" — user hasn't sent a message yet today). Returns 0
// if neither today nor yesterday has activity.
//
// Loading all dates into a Set is O(n) memory but n grows by at most 1 per day
// — even after years of use the set is small. Simpler than a recursive SQL
// walk and easier to reason about across timezone gotchas.
export function getCurrentStreak(): number {
  const rows = getDb()
    .prepare<[], { date: string }>(`SELECT date FROM daily_activity`)
    .all();
  const dates = new Set(rows.map((r) => r.date));

  let cursor = localDateString();
  if (!dates.has(cursor)) {
    cursor = addDays(cursor, -1);
    if (!dates.has(cursor)) return 0;
  }

  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
