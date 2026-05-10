import type { SignalType, Transport } from '@shared/types';
import { applySessionOps, recordOtelEvent } from '../db/repos';
import { applyEconomy } from '../economy';
import { notifyUpdate } from '../notify';
import { aggregateLogs, aggregateMetrics, aggregateTraces, type SessionOp } from './aggregator';

export function ingest(signalType: SignalType, transport: Transport, payload: unknown): void {
  recordOtelEvent(signalType, transport, payload);

  let ops: SessionOp[] = [];
  switch (signalType) {
    case 'metric':
      ops = aggregateMetrics(payload);
      break;
    case 'log':
      ops = aggregateLogs(payload);
      break;
    case 'trace':
      ops = aggregateTraces(payload);
      break;
  }
  applySessionOps(ops);

  const totals = sumOps(ops);
  const econ = applyEconomy({ messages: totals.message_count, outputTokens: totals.output_tokens });

  const summary = summarize(signalType, payload);
  const opsSummary = formatTotals(totals);
  const econSummary =
    econ.changed
      ? ` | +xp=${econ.xpGained} +bits=${econ.bitsGained}` +
        (econ.levelsGained ? ` +levels=${econ.levelsGained}` : '') +
        (econ.spinsGranted ? ` +spins=${econ.spinsGranted}` : '')
      : '';
  console.log(`[otel:${transport}] ${signalType} ${summary}${opsSummary}${econSummary}`);

  if (ops.length > 0) notifyUpdate();
}

interface OpTotals {
  sessions: number;
  message_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}

function sumOps(ops: SessionOp[]): OpTotals {
  const sessions = new Set<string>();
  const t: OpTotals = {
    sessions: 0,
    message_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
  };
  for (const op of ops) {
    sessions.add(op.sessionId);
    if (op.field && op.delta) t[op.field] += op.delta;
  }
  t.sessions = sessions.size;
  return t;
}

function formatTotals(t: OpTotals): string {
  if (t.sessions === 0) return '';
  const parts: string[] = [`sessions=${t.sessions}`];
  for (const [k, v] of Object.entries(t)) {
    if (k === 'sessions' || v === 0) continue;
    parts.push(`+${k}=${v}`);
  }
  return ` → ${parts.join(' ')}`;
}

function summarize(signalType: SignalType, payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const p = payload as Record<string, unknown>;

  switch (signalType) {
    case 'trace': {
      const rs = (p.resourceSpans ?? p.resource_spans) as unknown[] | undefined;
      const spanCount = countNested(rs, 'scopeSpans', 'scope_spans', 'spans');
      return `resourceSpans=${rs?.length ?? 0} spans=${spanCount}`;
    }
    case 'metric': {
      const rm = (p.resourceMetrics ?? p.resource_metrics) as unknown[] | undefined;
      const metricCount = countNested(rm, 'scopeMetrics', 'scope_metrics', 'metrics');
      return `resourceMetrics=${rm?.length ?? 0} metrics=${metricCount}`;
    }
    case 'log': {
      const rl = (p.resourceLogs ?? p.resource_logs) as unknown[] | undefined;
      const logCount = countNested(rl, 'scopeLogs', 'scope_logs', 'logRecords', 'log_records');
      return `resourceLogs=${rl?.length ?? 0} records=${logCount}`;
    }
  }
}

function countNested(
  outer: unknown[] | undefined,
  scopeKeyA: string,
  scopeKeyB: string,
  ...leafKeys: string[]
): number {
  if (!outer) return 0;
  let total = 0;
  for (const o of outer) {
    if (!o || typeof o !== 'object') continue;
    const r = o as Record<string, unknown>;
    const scopes = (r[scopeKeyA] ?? r[scopeKeyB]) as unknown[] | undefined;
    if (!scopes) continue;
    for (const s of scopes) {
      if (!s || typeof s !== 'object') continue;
      const sr = s as Record<string, unknown>;
      for (const k of leafKeys) {
        const arr = sr[k];
        if (Array.isArray(arr)) total += arr.length;
      }
    }
  }
  return total;
}
