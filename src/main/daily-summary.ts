import { Notification } from 'electron';
import { getDb } from './db/client';
import { localDateString } from './streaks';

// Daily summary notification — once per local day, after the user's first
// activity has been recorded for *today*, show a tray balloon recapping
// yesterday's totals. We track `last_summary_date` in the `meta` table to
// dedupe: the summary fires at most once per local-day, even if the app is
// restarted multiple times.
//
// Trigger from boot (in case the user opens the panel without sending a
// message) and from ingest (in case the app was running through midnight and
// the first turn of today triggers it). Cheap idempotent check either way.

const META_KEY = 'last_summary_date';

interface YesterdaySummary {
  sessions: number;
  messages: number;
  costUsd: number;
}

function startOfLocalDayMs(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function readMeta(key: string): string | undefined {
  const row = getDb()
    .prepare<[string], { value: string }>(`SELECT value FROM meta WHERE key = ?`)
    .get(key);
  return row?.value;
}

function writeMeta(key: string, value: string): void {
  getDb()
    .prepare<[string, string]>(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`)
    .run(key, value);
}

// Returns yesterday's totals filtered by `last_seen_at` falling within the
// yesterday-local-day window. Approximate by design — a session that bridges
// midnight contributes to whichever day its `last_seen_at` lands in. Rare
// enough that the simpler query wins over per-day rollup tables.
function summarizeYesterday(): YesterdaySummary {
  const today = new Date();
  const todayStart = startOfLocalDayMs(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = startOfLocalDayMs(yesterday);

  const row = getDb()
    .prepare<
      [number, number],
      { sessions: number; messages: number | null; cost: number | null }
    >(
      `SELECT
         COUNT(*) AS sessions,
         COALESCE(SUM(message_count), 0) AS messages,
         COALESCE(SUM(cost_usd), 0) AS cost
       FROM sessions
       WHERE last_seen_at >= ? AND last_seen_at < ?`,
    )
    .get(yesterdayStart, todayStart);

  return {
    sessions: row?.sessions ?? 0,
    messages: row?.messages ?? 0,
    costUsd: row?.cost ?? 0,
  };
}

function formatBody(s: YesterdaySummary): string {
  const parts: string[] = [];
  parts.push(`${s.sessions} session${s.sessions === 1 ? '' : 's'}`);
  parts.push(`${s.messages} message${s.messages === 1 ? '' : 's'}`);
  if (s.costUsd > 0) {
    // Two decimals once we're in the dollars range, four otherwise so a
    // sub-penny day doesn't read as $0.00.
    const fmt = s.costUsd >= 1
      ? s.costUsd.toFixed(2)
      : s.costUsd.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    parts.push(`$${fmt}`);
  }
  return parts.join(' · ');
}

// Idempotent — safe to call from boot, every ingest tick, or both. Returns
// true if a notification was shown, false otherwise (already shown today, no
// activity yesterday, etc.).
export function maybeShowDailySummary(): boolean {
  const today = localDateString();
  if (readMeta(META_KEY) === today) return false;

  const summary = summarizeYesterday();
  // Skip empty days entirely — nothing useful to recap, and the user hasn't
  // missed anything by not seeing a "0 messages yesterday" notification. Mark
  // the meta key anyway so we don't re-evaluate every ingest tick today.
  if (summary.messages === 0 && summary.sessions === 0) {
    writeMeta(META_KEY, today);
    return false;
  }

  if (Notification.isSupported()) {
    new Notification({
      title: 'Yesterday in Codeling',
      body: formatBody(summary),
      silent: true, // less obtrusive than the achievement chime
    }).show();
  }
  console.log(`[daily-summary] ${formatBody(summary)}`);
  writeMeta(META_KEY, today);
  return true;
}
