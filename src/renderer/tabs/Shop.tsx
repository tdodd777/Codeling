import { useEffect, useState } from 'react';
import type { PetState, PurchaseResponse, ShopItemView, UnlockedItem } from '@shared/types';

type ShopTab = 'cosmetics' | 'upgrades';

interface PurchaseFeedback {
  itemId: string;
  kind: 'success' | 'error';
  message: string;
}

const FEEDBACK_DISMISS_MS = 2400;

export function Shop() {
  const [tab, setTab] = useState<ShopTab>('cosmetics');
  const [unlocks, setUnlocks] = useState<UnlockedItem[]>([]);
  const [items, setItems] = useState<ShopItemView[]>([]);
  const [pet, setPet] = useState<PetState | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PurchaseFeedback | null>(null);

  useEffect(() => {
    const refetch = () => {
      window.codeling.getUnlocks().then(setUnlocks).catch(console.error);
      window.codeling.getPet().then(setPet).catch(console.error);
    };
    window.codeling.getShopItems().then(setItems).catch(console.error);
    refetch();
    return window.codeling.onUpdate(refetch);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), FEEDBACK_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const ownedSet = new Set(unlocks.map((u) => u.itemId));
  const wantKind = tab === 'cosmetics' ? 'cosmetic' : 'upgrade';
  const catalogIds = new Set(items.map((i) => i.id));
  // Owned items the catalog doesn't list (e.g., wheel-only cosmetics) — surface
  // them so the Shop is the single place to see everything you have plus what
  // you can buy.
  const ownedExtras: ShopItemView[] = unlocks
    .filter((u) => u.category === wantKind && !catalogIds.has(u.itemId))
    .map((u) => ({
      id: u.itemId,
      kind: wantKind,
      priceBits: 0,
      label: u.label,
      tier: u.tier,
    }));
  const visible = [
    ...items.filter((it) => it.kind === wantKind),
    ...ownedExtras,
  ];
  const bits = pet?.bits ?? 0;

  async function handleBuy(it: ShopItemView) {
    if (pending) return;
    setPending(it.id);
    try {
      const res: PurchaseResponse = await window.codeling.purchase(it.id);
      if ('ok' in res) {
        setFeedback({ itemId: it.id, kind: 'success', message: `${it.label} purchased` });
      } else if (res.error === 'insufficient') {
        setFeedback({
          itemId: it.id,
          kind: 'error',
          message: `Need ${res.price - res.bits} more bits`,
        });
      } else if (res.error === 'already-owned') {
        setFeedback({ itemId: it.id, kind: 'error', message: 'Already owned' });
      } else {
        setFeedback({ itemId: it.id, kind: 'error', message: 'Purchase failed' });
      }
    } catch (err) {
      console.error('[shop] purchase failed', err);
      setFeedback({ itemId: it.id, kind: 'error', message: 'Purchase failed' });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="shop">
      <div className="shop-header">
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
        <div className="shop-bits" title="Bits available">
          {bits.toLocaleString()} bits
        </div>
      </div>

      <div className="shop-body">
        {visible.length === 0 ? (
          <div className="placeholder">Nothing here yet.</div>
        ) : (
          <ul className="shop-list">
            {visible.map((it) => {
              const owned = ownedSet.has(it.id);
              const broke = !owned && bits < it.priceBits;
              const isPending = pending === it.id;
              const fb = feedback?.itemId === it.id ? feedback : null;
              return (
                <li key={it.id} className={`shop-item shop-item--${it.tier}`}>
                  <div className="shop-item__main">
                    <div className="shop-item__title">
                      <span className="shop-item__label">{it.label}</span>
                      <span className="shop-item__tier">{it.tier}</span>
                    </div>
                    {it.description && (
                      <div className="shop-item__desc">{it.description}</div>
                    )}
                  </div>
                  <div className="shop-item__action">
                    {owned ? (
                      <span className="shop-item__owned">Owned</span>
                    ) : (
                      <button
                        className="shop-item__buy"
                        onClick={() => handleBuy(it)}
                        disabled={broke || isPending}
                      >
                        {isPending ? '…' : `${it.priceBits} bits`}
                      </button>
                    )}
                    {fb && (
                      <span className={`shop-item__feedback shop-item__feedback--${fb.kind}`}>
                        {fb.message}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
