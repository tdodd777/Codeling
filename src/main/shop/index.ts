import { evaluateAchievements } from '../achievements';
import { getDb } from '../db/client';
import { buildAnimationShopItem, ANIMATION_ID_PREFIX, type AnimationShopItem } from './animations';
import { findShopItem, type ShopItemKind, type ShopItem } from './catalog';

// Purchase outcome. Distinct error codes so the renderer can show the right
// message — the UI also gates the button proactively (disabled when broke or
// owned), so most of these are belt-and-suspenders for race conditions.
export interface PurchaseSuccess {
  ok: true;
  itemId: string;
  category: ShopItemKind | 'animation';
  bitsRemaining: number;
  pricePaid: number;
}

export type PurchaseError =
  | { error: 'unknown-item' }
  | { error: 'insufficient'; bits: number; price: number }
  | { error: 'already-owned' }
  | { error: 'level-locked'; required: number; current: number };

export type PurchaseResponse = PurchaseSuccess | PurchaseError;

// Locate the shop item by id, treating `anim:*` as a synthetic dynamic catalog
// (computed from sprite-manifest scan + owned species). Returns null if
// nothing resolves — caller maps to `unknown-item`.
function resolveShopItem(itemId: string): ShopItem | AnimationShopItem | null {
  if (itemId.startsWith(ANIMATION_ID_PREFIX)) {
    return buildAnimationShopItem(itemId);
  }
  return findShopItem(itemId) ?? null;
}

export function performPurchase(itemId: string): PurchaseResponse {
  const item = resolveShopItem(itemId);
  if (!item) return { error: 'unknown-item' };

  const db = getDb();
  let outcome: PurchaseResponse = { error: 'unknown-item' };

  const tx = db.transaction(() => {
    const owned = db
      .prepare<[string], { item_id: string }>(`SELECT item_id FROM unlocks WHERE item_id = ?`)
      .get(item.id);
    if (owned) {
      outcome = { error: 'already-owned' };
      return;
    }

    const pet = db.prepare<[], { level: number; bits: number }>(
      `SELECT level, bits FROM pet WHERE id = 1`,
    ).get();
    if (!pet) throw new Error('pet row missing');

    // Level gate for animations — bits-cheap but XP-deep. Other item kinds
    // have no level requirement today (priceBits acts as the throttle).
    if (item.kind === 'animation' && pet.level < item.levelRequired) {
      outcome = { error: 'level-locked', required: item.levelRequired, current: pet.level };
      return;
    }

    if (pet.bits < item.priceBits) {
      outcome = { error: 'insufficient', bits: pet.bits, price: item.priceBits };
      return;
    }

    db.prepare<[number]>(`UPDATE pet SET bits = bits - ? WHERE id = 1`).run(item.priceBits);
    db.prepare<[string, string, number]>(
      `INSERT INTO unlocks (item_id, category, acquired_via, acquired_at) VALUES (?, ?, 'shop', ?)`,
    ).run(item.id, item.kind, Date.now());

    outcome = {
      ok: true,
      itemId: item.id,
      category: item.kind,
      bitsRemaining: pet.bits - item.priceBits,
      pricePaid: item.priceBits,
    };
  });
  tx();

  // first-species / first-upgrade / first-animation flip on purchase. Eval
  // outside the txn.
  if ('ok' in outcome) evaluateAchievements();

  return outcome;
}

// Returns the set of currently-owned upgrade IDs. Cheap query — caller should
// invoke per economy tick; keeping the lookup here so future upgrade-aware code
// (achievements, extra multipliers) shares one source.
export function getOwnedUpgradeIds(): Set<string> {
  const rows = getDb()
    .prepare<[], { item_id: string }>(`SELECT item_id FROM unlocks WHERE category = 'upgrade'`)
    .all();
  return new Set(rows.map((r) => r.item_id));
}
