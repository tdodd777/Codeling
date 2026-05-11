import { useEffect, useMemo, useState } from 'react';
import {
  SPECIES_CATALOG,
  type AnimationView,
  type PetState,
  type PurchaseResponse,
  type ShopItemView,
  type Species,
  type SpeciesAnimationsCatalog,
  type UnlockedItem,
} from '@shared/types';

type ShopTab = 'species' | 'animations' | 'upgrades';

interface PurchaseFeedback {
  itemId: string;
  kind: 'success' | 'error';
  message: string;
}

const FEEDBACK_DISMISS_MS = 2400;

export function Shop() {
  const [tab, setTab] = useState<ShopTab>('species');
  const [unlocks, setUnlocks] = useState<UnlockedItem[]>([]);
  const [items, setItems] = useState<ShopItemView[]>([]);
  const [animationCatalog, setAnimationCatalog] = useState<SpeciesAnimationsCatalog>({});
  const [pet, setPet] = useState<PetState | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PurchaseFeedback | null>(null);

  useEffect(() => {
    const refetch = () => {
      window.codeling.getUnlocks().then(setUnlocks).catch(console.error);
      window.codeling.getPet().then(setPet).catch(console.error);
      window.codeling.getShopItems().then(setItems).catch(console.error);
      window.codeling.getAnimationsCatalog().then(setAnimationCatalog).catch(console.error);
    };
    refetch();
    return window.codeling.onUpdate(refetch);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), FEEDBACK_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const bits = pet?.bits ?? 0;
  const playerLevel = pet?.level ?? 1;
  const activeSpecies = pet?.species;

  const speciesIdToKey = useMemo(() => {
    const map = new Map<string, Species>();
    for (const u of unlocks) {
      if (u.category === 'species' && u.itemId.startsWith('species:')) {
        map.set(u.itemId, u.itemId.slice('species:'.length) as Species);
      }
    }
    return map;
  }, [unlocks]);

  async function handleSetActive(species: Species, itemId: string) {
    if (pending) return;
    setPending(itemId);
    try {
      const res = await window.codeling.setActiveSpecies(species);
      if ('ok' in res) {
        setFeedback({ itemId, kind: 'success', message: 'Active' });
      } else {
        setFeedback({ itemId, kind: 'error', message: 'Not owned' });
      }
    } finally {
      setPending(null);
    }
  }

  async function handleBuy(itemId: string, label: string, priceBits: number) {
    if (pending) return;
    setPending(itemId);
    try {
      const res: PurchaseResponse = await window.codeling.purchase(itemId);
      if ('ok' in res) {
        setFeedback({ itemId, kind: 'success', message: `${label} purchased` });
      } else if (res.error === 'insufficient') {
        setFeedback({
          itemId,
          kind: 'error',
          message: `Need ${res.price - res.bits} more bits`,
        });
      } else if (res.error === 'already-owned') {
        setFeedback({ itemId, kind: 'error', message: 'Already owned' });
      } else if (res.error === 'level-locked') {
        setFeedback({
          itemId,
          kind: 'error',
          message: `Lv ${res.required} required (you're Lv ${res.current})`,
        });
      } else {
        setFeedback({ itemId, kind: 'error', message: 'Purchase failed' });
      }
      // touch priceBits so unused-param lint stays happy on legit early-returns
      void priceBits;
    } catch (err) {
      console.error('[shop] purchase failed', err);
      setFeedback({ itemId, kind: 'error', message: 'Purchase failed' });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="shop">
      <div className="shop-header">
        <div className="subtabs">
          <button
            className={`subtab ${tab === 'species' ? 'subtab--active' : ''}`}
            onClick={() => setTab('species')}
          >
            Species
          </button>
          <button
            className={`subtab ${tab === 'animations' ? 'subtab--active' : ''}`}
            onClick={() => setTab('animations')}
          >
            Animations
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
        {tab === 'animations' ? (
          <AnimationsList
            catalog={animationCatalog}
            playerLevel={playerLevel}
            bits={bits}
            pending={pending}
            feedback={feedback}
            onBuy={(it) => handleBuy(it.id, `${SPECIES_CATALOG[it.species].label} — ${it.name}`, it.priceBits)}
          />
        ) : (
          <SpeciesOrUpgradesList
            kind={tab === 'species' ? 'species' : 'upgrade'}
            unlocks={unlocks}
            items={items}
            bits={bits}
            pending={pending}
            feedback={feedback}
            activeSpecies={activeSpecies}
            speciesIdToKey={speciesIdToKey}
            onBuy={(it) => handleBuy(it.id, it.label, it.priceBits)}
            onSetActive={handleSetActive}
          />
        )}
      </div>
    </div>
  );
}

interface ListProps {
  unlocks: UnlockedItem[];
  items: ShopItemView[];
  bits: number;
  pending: string | null;
  feedback: PurchaseFeedback | null;
  activeSpecies: Species | undefined;
  speciesIdToKey: Map<string, Species>;
  kind: 'species' | 'upgrade';
  onBuy: (it: ShopItemView) => void;
  onSetActive: (species: Species, itemId: string) => void;
}

function SpeciesOrUpgradesList({
  kind,
  unlocks,
  items,
  bits,
  pending,
  feedback,
  activeSpecies,
  speciesIdToKey,
  onBuy,
  onSetActive,
}: ListProps) {
  const ownedItems = unlocks.filter((u) => u.category === kind);
  const buyable = items.filter((it) => it.kind === kind);
  if (ownedItems.length === 0 && buyable.length === 0) {
    return <div className="placeholder">Nothing here yet.</div>;
  }
  return (
    <ul className="shop-list">
      {ownedItems.map((u) => {
        const fb = feedback?.itemId === u.itemId ? feedback : null;
        return (
          <li key={u.itemId} className={`shop-item shop-item--${u.tier}`}>
            <div className="shop-item__main">
              <div className="shop-item__title">
                <span className="shop-item__label">{u.label}</span>
                <span className="shop-item__tier">{u.tier}</span>
              </div>
            </div>
            <div className="shop-item__action">
              {renderOwnedAction(u, activeSpecies, speciesIdToKey, pending, onSetActive)}
              {fb && (
                <span className={`shop-item__feedback shop-item__feedback--${fb.kind}`}>
                  {fb.message}
                </span>
              )}
            </div>
          </li>
        );
      })}
      {buyable.map((it) => {
        const broke = bits < it.priceBits;
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
              <button
                className="shop-item__buy"
                onClick={() => onBuy(it)}
                disabled={broke || isPending}
              >
                {isPending ? '…' : `${it.priceBits} bits`}
              </button>
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
  );
}

function renderOwnedAction(
  item: UnlockedItem,
  activeSpecies: Species | undefined,
  speciesIdToKey: Map<string, Species>,
  pending: string | null,
  onSetActive: (species: Species, itemId: string) => void,
) {
  if (item.category !== 'species') {
    return <span className="shop-item__owned">Owned</span>;
  }
  const species = speciesIdToKey.get(item.itemId);
  if (!species) return <span className="shop-item__owned">Owned</span>;
  const isActive = activeSpecies === species;
  const isPending = pending === item.itemId;
  if (isActive) {
    return <span className="shop-item__owned shop-item__owned--active">Active</span>;
  }
  return (
    <button
      className="shop-item__equip"
      onClick={() => onSetActive(species, item.itemId)}
      disabled={isPending}
    >
      {isPending ? '…' : 'Set Active'}
    </button>
  );
}

interface AnimationsProps {
  catalog: SpeciesAnimationsCatalog;
  playerLevel: number;
  bits: number;
  pending: string | null;
  feedback: PurchaseFeedback | null;
  onBuy: (it: AnimationView) => void;
}

function AnimationsList({ catalog, playerLevel, bits, pending, feedback, onBuy }: AnimationsProps) {
  const entries = Object.entries(catalog) as Array<[Species, AnimationView[]]>;
  if (entries.length === 0) {
    return <div className="placeholder">Own a species to unlock its animations.</div>;
  }
  return (
    <div className="anim-groups">
      {entries.map(([species, anims]) => (
        <section key={species} className="anim-group">
          <div className="anim-group__header">{SPECIES_CATALOG[species].label}</div>
          <ul className="shop-list">
            {anims.map((a) => {
              const isPending = pending === a.id;
              const fb = feedback?.itemId === a.id ? feedback : null;
              const levelLocked = !a.owned && playerLevel < a.levelRequired;
              const broke = !a.owned && !levelLocked && bits < a.priceBits;
              const tier = animationTierForPrice(a.priceBits);
              return (
                <li key={a.id} className={`shop-item shop-item--${tier}`}>
                  <div className="shop-item__main">
                    <div className="shop-item__title">
                      <span className="shop-item__label">
                        {a.name.charAt(0).toUpperCase() + a.name.slice(1)}
                      </span>
                      <span className="shop-item__tier">{tier}</span>
                    </div>
                    <div className="shop-item__desc">
                      {a.owned
                        ? a.name === 'idle'
                          ? 'Included free with this species'
                          : 'Unlocked'
                        : `${a.priceBits} bits · Lv ${a.levelRequired}+`}
                    </div>
                  </div>
                  <div className="shop-item__action">
                    {a.owned ? (
                      <span className="shop-item__owned">Owned</span>
                    ) : levelLocked ? (
                      <button className="shop-item__buy" disabled title={`Reach Lv ${a.levelRequired} first`}>
                        Lv {a.levelRequired}
                      </button>
                    ) : (
                      <button
                        className="shop-item__buy"
                        onClick={() => onBuy(a)}
                        disabled={broke || isPending}
                      >
                        {isPending ? '…' : `${a.priceBits} bits`}
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
        </section>
      ))}
    </div>
  );
}

function animationTierForPrice(priceBits: number): 'common' | 'uncommon' | 'rare' {
  if (priceBits >= 300) return 'rare';
  if (priceBits >= 150) return 'uncommon';
  return 'common';
}
