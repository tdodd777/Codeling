import type { Tier } from '../spin/rewards';

// Shop catalog. Cosmetic items in the shop share the `unlocks.item_id` key with
// wheel-rolled cosmetics so the dedupe in `INSERT OR IGNORE` works regardless
// of how the player got it. Upgrades use a separate `category` row in unlocks
// and drive economy/game-loop modifiers.
//
// Prices are bits-only for now; gem-style premium currency is deferred.

export type ShopItemKind = 'cosmetic' | 'upgrade';

interface BaseItem {
  id: string;
  kind: ShopItemKind;
  priceBits: number;
  label: string;
  description?: string;
  tier: Tier;
}

export interface CosmeticShopItem extends BaseItem {
  kind: 'cosmetic';
}

export interface UpgradeShopItem extends BaseItem {
  kind: 'upgrade';
  // Stable string the economy/game loop checks for. Same as `id` today; kept
  // separate so a UI rename doesn't break behavior.
  effect: 'bit_multiplier_2x';
}

export type ShopItem = CosmeticShopItem | UpgradeShopItem;

// Two starter cosmetics to keep the shop non-empty even before art lands. Both
// reuse the COSMETICS registry — extend `src/main/spin/rewards.ts` when adding
// new ones so labels render in both shop and "owned" sections.
export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'glasses',           kind: 'cosmetic', tier: 'common',   priceBits: 100, label: 'Glasses',
    description: 'Smart-looking spectacles.' },
  { id: 'witch_hat',         kind: 'cosmetic', tier: 'uncommon', priceBits: 250, label: 'Witch Hat',
    description: 'Pointed and wide-brimmed.' },
  { id: 'bit_multiplier_2x', kind: 'upgrade',  tier: 'rare',     priceBits: 500, label: '2× Bits',
    description: 'Doubles bits earned from messages and tokens. Permanent.',
    effect: 'bit_multiplier_2x' },
];

export function findShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((s) => s.id === id);
}
