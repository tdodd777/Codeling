CREATE TABLE IF NOT EXISTS pet (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  species TEXT NOT NULL,
  name TEXT NOT NULL,
  evolution_stage INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  bits INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS unlocks (
  item_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  acquired_via TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  equipped INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  stop_event_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS otel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_type TEXT NOT NULL,
  transport TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otel_events_received_at ON otel_events(received_at);

CREATE TABLE IF NOT EXISTS spin_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  spins_available INTEGER NOT NULL DEFAULT 0,
  messages_since_last_spin INTEGER NOT NULL DEFAULT 0,
  spin_threshold INTEGER NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  earned_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_activity (
  date TEXT PRIMARY KEY -- YYYY-MM-DD in local time
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
