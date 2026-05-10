import { useEffect, useState } from 'react';
import type { LifetimeStats } from '@shared/types';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  // Show fractional cents (up to 4 decimals) when the total is sub-penny — early
  // sessions are tiny enough that $0.00 would look like nothing's tracked.
  maximumFractionDigits: 4,
});

export function Stats() {
  const [stats, setStats] = useState<LifetimeStats | null>(null);

  useEffect(() => {
    const refetch = () => {
      window.codeling.getStats().then(setStats).catch(console.error);
    };
    refetch();
    return window.codeling.onUpdate(refetch);
  }, []);

  if (!stats) return <div className="loading">Loading…</div>;

  return (
    <div className="stats">
      <Row label="Sessions" value={stats.sessionCount} />
      <Row label="Messages" value={stats.totalMessages} />
      <Row label="Input tokens" value={stats.totalInputTokens} />
      <Row label="Output tokens" value={stats.totalOutputTokens} />
      <Row label="Cache read" value={stats.totalCacheReadTokens} />
      <Row label="Cache create" value={stats.totalCacheCreationTokens} />
      <Row label="Cost" value={USD.format(stats.totalCostUsd)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stats-row">
      <span className="stats-label">{label}</span>
      <span className="stats-value">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}
