import { evaluateAchievements } from './achievements';
import { getDb } from './db/client';
import { applyEconomy } from './economy';
import { notifyUpdate } from './notify';
import { recordActivityToday } from './streaks';

// Stop-hook supplementary tally. Claude Code's `Stop` hook fires once per turn
// end — we use it to catch turns the OTEL exporter dropped.
//
// Algorithm: each Stop event bumps `stop_event_count` for the session. If
// stop_event_count then exceeds message_count, message_count gets backfilled
// up to match. When OTEL is healthy, both counts grow in lockstep and the
// backfill is a no-op. When OTEL drops a `user_prompt` log, the Stop event
// fills the gap on this turn's end.

export interface StopHookEvent {
  // Required for tally accuracy. Other fields (transcript_path, hook_event_name,
  // stop_hook_active, etc.) are accepted but ignored.
  session_id?: unknown;
}

interface SessionCountRow {
  message_count: number;
  stop_event_count: number;
}

export function handleStopHook(
  event: StopHookEvent,
): { ok: true; messagesAdded: number } | { error: 'no-session-id' } {
  const sid = typeof event.session_id === 'string' ? event.session_id : '';
  if (!sid) return { error: 'no-session-id' };

  const db = getDb();
  const now = Date.now();
  let messagesAdded = 0;

  const tx = db.transaction(() => {
    db.prepare<[string, number, number]>(
      `INSERT OR IGNORE INTO sessions (session_id, started_at, last_seen_at) VALUES (?, ?, ?)`,
    ).run(sid, now, now);

    db.prepare<[number, string]>(
      `UPDATE sessions
          SET stop_event_count = stop_event_count + 1,
              last_seen_at = MAX(last_seen_at, ?)
        WHERE session_id = ?`,
    ).run(now, sid);

    const counts = db
      .prepare<[string], SessionCountRow>(
        `SELECT message_count, stop_event_count FROM sessions WHERE session_id = ?`,
      )
      .get(sid);
    if (counts && counts.stop_event_count > counts.message_count) {
      messagesAdded = counts.stop_event_count - counts.message_count;
      db.prepare<[number, string]>(
        `UPDATE sessions SET message_count = ? WHERE session_id = ?`,
      ).run(counts.stop_event_count, sid);
    }
  });
  tx();

  if (messagesAdded > 0) {
    // Drive the same downstream pipeline OTEL would have driven for these
    // messages: economy (XP/bits/spins), streak today, achievements, panel push.
    recordActivityToday();
    applyEconomy({ messages: messagesAdded, outputTokens: 0 });
    evaluateAchievements();
    notifyUpdate();
  }

  return { ok: true, messagesAdded };
}
