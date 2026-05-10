import { useEffect, useState } from 'react';
import type { UnlockedItem } from '@shared/types';

type ShopTab = 'cosmetics' | 'upgrades';

export function Shop() {
  const [tab, setTab] = useState<ShopTab>('cosmetics');
  const [unlocks, setUnlocks] = useState<UnlockedItem[]>([]);

  useEffect(() => {
    const refetch = () => {
      window.codeling.getUnlocks().then(setUnlocks).catch(console.error);
    };
    refetch();
    return window.codeling.onUpdate(refetch);
  }, []);

  const cosmetics = unlocks.filter((u) => u.category === 'cosmetic');

  return (
    <div className="shop">
      <div className="subtabs">
        <button
          className={`subtab ${tab === 'cosmetics' ? 'subtab--active' : ''}`}
          onClick={() => setTab('cosmetics')}
        >
          Cosmetics
        </button>
        <button
          className={`subtab ${tab === 'upgrades' ? 'subtab--active' : ''}`}
          onClick={() => setTab('upgrades')}
        >
          Upgrades
        </button>
      </div>

      <div className="shop-body">
        {tab === 'cosmetics' && (
          cosmetics.length === 0 ? (
            <div className="placeholder">No cosmetics yet — try a spin.</div>
          ) : (
            <>
              <div className="shop-section-header">Owned</div>
              <ul className="owned-list">
                {cosmetics.map((c) => (
                  <li key={c.itemId} className={`owned-item owned-item--${c.tier}`}>
                    <span className="owned-item__label">{c.label}</span>
                    <span className="owned-item__tier">{c.tier}</span>
                  </li>
                ))}
              </ul>
            </>
          )
        )}
        {tab === 'upgrades' && <div className="placeholder">No upgrades yet.</div>}
      </div>
    </div>
  );
}
