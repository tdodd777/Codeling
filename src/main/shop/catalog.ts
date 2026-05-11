import { SPECIES_CATALOG, type Species } from '@shared/types';
import type { Tier } from '../spin/rewards';

// Shop catalog. Two kinds today:
//   - `species` — collect new pets; bits buy a species, then setActiveSpecies
//                 swaps which one renders on Home + tray.
//   - `upgrade` — permanent economy modifiers (2× bits, etc.).
//
// Item ids carry their kind as a prefix (`species:<name>`) so the unlocks table
// stays a single keyspace with category as a coarse facet.

export type ShopItemKind = 'species' | 'upgrade';

interface BaseItem {
  id: string;
  kind: ShopItemKind;
  priceBits: number;
  label: string;
  description?: string;
  tier: Tier;
}

export interface SpeciesShopItem extends BaseItem {
  kind: 'species';
  species: Species;
}

export interface UpgradeShopItem extends BaseItem {
  kind: 'upgrade';
  // Stable string the economy/game loop checks for. Same as `id` today; kept
  // separate so a UI rename doesn't break behavior.
  effect: 'bit_multiplier_2x';
}

export type ShopItem = SpeciesShopItem | UpgradeShopItem;

const SPECIES_ITEMS: readonly SpeciesShopItem[] = (
  Object.entries(SPECIES_CATALOG) as Array<[Species, (typeof SPECIES_CATALOG)[Species]]>
).map(([species, info]) => ({
  id: `species:${species}`,
  kind: 'species' as const,
  tier: info.tier,
  priceBits: info.priceBits,
  label: info.label,
  species,
}));

const UPGRADE_ITEMS: readonly UpgradeShopItem[] = [
  {
    id: 'bit_multiplier_2x',
    kind: 'upgrade',
    tier: 'rare',
    priceBits: 500,
    label: '2× Bits',
    description: 'Doubles bits earned from messages and tokens. Permanent.',
    effect: 'bit_multiplier_2x',
  },
];

export const SHOP_ITEMS: readonly ShopItem[] = [...SPECIES_ITEMS, ...UPGRADE_ITEMS];

export function findShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((s) => s.id === id);
}
