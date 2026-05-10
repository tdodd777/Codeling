import { getDb } from '../db/client';
import { findShopItem } from './catalog';

// Purchase outcome. Distinct error codes so the renderer can show the right
// message — the UI also gates the button proactively (disabled when broke or
// owned), so most of these are belt-and-suspenders for race conditions.
export interface PurchaseSuccess {
  ok: true;
  itemId: string;
  category: 'cosmetic' | 'upgrade';
  bitsRemaining: number;
  pricePaid: number;
}

export type PurchaseError =
  | { error: 'unknown-item' }
  | { error: 'insufficient'; bits: number; price: number }
  | { error: 'already-owned' };

export type PurchaseResponse = PurchaseSuccess | PurchaseError;

export function performPurchase(itemId: string): PurchaseResponse {
  const item = findShopItem(itemId);
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

    const pet = db.prepare<[], { bits: number }>(`SELECT bits FROM pet WHERE id = 1`).get();
    if (!pet) throw new Error('pet row missing');
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
