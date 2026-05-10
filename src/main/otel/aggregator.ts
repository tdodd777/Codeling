import { attrValue, dataPointValue, getAttr, nanosToMs, pick } from './attrs';

export type SessionField =
  | 'message_count'
  | 'input_tokens'
  | 'output_tokens'
  | 'cache_read_tokens'
  | 'cache_creation_tokens'
  | 'cost_usd';

export interface SessionOp {
  sessionId: string;
  timestampMs: number;
  field?: SessionField; // undefined = ping (only bumps last_seen_at)
  delta?: number;
}

const TOKEN_TYPE_TO_FIELD: Record<string, SessionField> = {
  input: 'input_tokens',
  output: 'output_tokens',
  cacheRead: 'cache_read_tokens',
  cacheCreation: 'cache_creation_tokens',
};

export function aggregateMetrics(payload: unknown): SessionOp[] {
  const ops: SessionOp[] = [];
  const resourceMetrics = pick<unknown[]>(payload, 'resource_metrics', 'resourceMetrics') ?? [];

  for (const rm of resourceMetrics) {
    const scopes = pick<unknown[]>(rm, 'scope_metrics', 'scopeMetrics') ?? [];
    for (const sm of scopes) {
      const metrics = pick<unknown[]>(sm, 'metrics') ?? [];
      for (const m of metrics) {
        const name = pick<string>(m, 'name');
        if (name !== 'claude_code.token.usage' && name !== 'claude_code.cost.usage') continue;

        const sum = pick<Record<string, unknown>>(m, 'sum');
        if (!sum) continue;

        // Aggregator math assumes DELTA temporality — additive upserts. If
        // Claude Code ever switches a metric to CUMULATIVE (each data point is
        // the absolute total since metric start), naïve addition would balloon.
        // Skip with a warning rather than silently corrupt totals; proper
        // CUMULATIVE handling would need per-(session, field) state.
        const temporality = Number(
          pick<number | string>(sum, 'aggregation_temporality', 'aggregationTemporality') ?? 0,
        );
        if (temporality === 2 /* CUMULATIVE */) {
          console.warn(`[otel] skipping ${name}: CUMULATIVE temporality not supported (DELTA expected)`);
          continue;
        }

        const dataPoints = pick<unknown[]>(sum, 'data_points', 'dataPoints') ?? [];
        for (const dp of dataPoints) {
          const dpObj = dp as Record<string, unknown>;
          const attrs = pick<unknown[]>(dpObj, 'attributes');
          const sid = String(getAttr(attrs, 'session.id') ?? '');
          if (!sid) continue;

          // Token usage carries a `type` attribute that selects a column;
          // cost usage is a single scalar per data point with no `type`.
          let field: SessionField | undefined;
          if (name === 'claude_code.token.usage') {
            const type = String(getAttr(attrs, 'type') ?? '');
            field = TOKEN_TYPE_TO_FIELD[type];
          } else {
            field = 'cost_usd';
          }
          if (!field) continue;

          const value = dataPointValue(dpObj);
          if (value <= 0) continue;

          const ts = nanosToMs(pick(dpObj, 'time_unix_nano', 'timeUnixNano'));
          ops.push({ sessionId: sid, timestampMs: ts, field, delta: value });
        }
      }
    }
  }
  return ops;
}

export function aggregateLogs(payload: unknown): SessionOp[] {
  const ops: SessionOp[] = [];
  const resourceLogs = pick<unknown[]>(payload, 'resource_logs', 'resourceLogs') ?? [];

  for (const rl of resourceLogs) {
    const scopes = pick<unknown[]>(rl, 'scope_logs', 'scopeLogs') ?? [];
    for (const sl of scopes) {
      const records = pick<unknown[]>(sl, 'log_records', 'logRecords') ?? [];
      for (const lr of records) {
        const lrObj = lr as Record<string, unknown>;
        const attrs = pick<unknown[]>(lrObj, 'attributes');
        const sid = String(getAttr(attrs, 'session.id') ?? '');
        if (!sid) continue;

        const ts = nanosToMs(pick(lrObj, 'time_unix_nano', 'timeUnixNano'));
        const eventName = String(getAttr(attrs, 'event.name') ?? '');

        // user_prompt is the canonical "user sent a message" event from claude-code.
        if (eventName === 'user_prompt') {
          ops.push({ sessionId: sid, timestampMs: ts, field: 'message_count', delta: 1 });
        } else {
          // Bump last_seen_at via a ping op so idle sessions don't look stale.
          ops.push({ sessionId: sid, timestampMs: ts });
        }
      }
    }
  }
  return ops;
}

export function aggregateTraces(payload: unknown): SessionOp[] {
  // Traces aren't load-bearing for the game loop yet — emit pings only.
  const ops: SessionOp[] = [];
  const resourceSpans = pick<unknown[]>(payload, 'resource_spans', 'resourceSpans') ?? [];
  for (const rs of resourceSpans) {
    const scopes = pick<unknown[]>(rs, 'scope_spans', 'scopeSpans') ?? [];
    for (const ss of scopes) {
      const spans = pick<unknown[]>(ss, 'spans') ?? [];
      for (const sp of spans) {
        const spObj = sp as Record<string, unknown>;
        const attrs = pick<unknown[]>(spObj, 'attributes');
        const sid = String(getAttr(attrs, 'session.id') ?? '');
        if (!sid) continue;
        const ts = nanosToMs(pick(spObj, 'end_time_unix_nano', 'endTimeUnixNano'));
        ops.push({ sessionId: sid, timestampMs: ts });
      }
    }
  }
  return ops;
}

// Re-export so callers don't need to know the shape detail.
export { attrValue };
