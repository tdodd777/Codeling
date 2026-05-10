import { useState } from 'react';

type ShopTab = 'cosmetics' | 'upgrades';

export function Shop() {
  const [tab, setTab] = useState<ShopTab>('cosmetics');

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
        {tab === 'cosmetics' && <div className="placeholder">No cosmetics yet.</div>}
        {tab === 'upgrades' && <div className="placeholder">No upgrades yet.</div>}
      </div>
    </div>
  );
}
