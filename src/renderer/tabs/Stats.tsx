import { useEffect, useState } from 'react';
import type { AchievementView, LifetimeStats } from '@shared/types';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  // Show fractional cents (up to 4 decimals) when the total is sub-penny — early
  // sessions are tiny enough that $0.00 would look like nothing's tracked.
  maximumFractionDigits: 4,
});

const SHORT_DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export function Stats() {
  const [stats, setStats] = useState<LifetimeStats | null>(null);
  const [achievements, setAchievements] = useState<AchievementView[]>([]);

  useEffect(() => {
    const refetch = () => {
      window.codeling.getStats().then(setStats).catch(console.error);
      window.codeling.getAchievements().then(setAchievements).catch(console.error);
    };
    refetch();
    return window.codeling.onUpdate(refetch);
  }, []);

  if (!stats) return <div className="loading">Loading…</div>;

  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return (
    <div className="stats">
      <Row label="Sessions" value={stats.sessionCount} />
      <Row label="Messages" value={stats.totalMessages} />
      <Row label="Input tokens" value={stats.totalInputTokens} />
      <Row label="Output tokens" value={stats.totalOutputTokens} />
      <Row label="Cache read" value={stats.totalCacheReadTokens} />
      <Row label="Cache create" value={stats.totalCacheCreationTokens} />
      <Row label="Cost" value={USD.format(stats.totalCostUsd)} />

      {achievements.length > 0 && (
        <div className="achievements">
          <div className="achievements__header">
            Achievements <span className="achievements__count">{earned.length} / {achievements.length}</span>
          </div>
          {earned.length > 0 && (
            <ul className="achievement-list">
              {earned.map((a) => (
                <AchievementRow key={a.id} a={a} />
              ))}
            </ul>
          )}
          {locked.length > 0 && (
            <>
              <div className="achievements__sub">Locked</div>
              <ul className="achievement-list achievement-list--locked">
                {locked.map((a) => (
                  <AchievementRow key={a.id} a={a} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AchievementRow({ a }: { a: AchievementView }) {
  return (
    <li className={`achievement achievement--${a.tier} ${a.earned ? '' : 'achievement--locked'}`}>
      <div className="achievement__main">
        <div className="achievement__label">{a.label}</div>
        <div className="achievement__desc">{a.description}</div>
      </div>
      <div className="achievement__meta">
        {a.earned && a.earnedAt ? SHORT_DATE.format(a.earnedAt) : a.tier}
      </div>
    </li>
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
