import { SPECIES_CATALOG, type AnimationView, type Species } from '@shared/types';
import { getDb } from '../db/client';
import { canonicalAnimationName, listSpeciesAnimations } from '../sprites';

// Dynamic animation shop. Sprite manifest is authoritative for "what art
// exists" — every animation discoverable on disk for an owned species becomes
// purchasable here. Pricing + level gates are flat by category so the tuning
// surface stays small: idle/run/walk/attack are recognized friendly categories;
// everything else falls into a misc tier.

// Item id format: `anim:<species>:<canonicalName>`. Stored in unlocks with
// category='animation'. The canonical name is the dedup key for the folder —
// see `canonicalAnimationName` in sprites.ts.
export const ANIMATION_ID_PREFIX = 'anim:';

export function animationItemId(species: Species, name: string): string {
  return `${ANIMATION_ID_PREFIX}${species}:${name}`;
}

export function parseAnimationItemId(id: string): { species: Species; name: string } | null {
  if (!id.startsWith(ANIMATION_ID_PREFIX)) return null;
  const rest = id.slice(ANIMATION_ID_PREFIX.length);
  const colon = rest.indexOf(':');
  if (colon < 0) return null;
  const species = rest.slice(0, colon) as Species;
  const name = rest.slice(colon + 1);
  if (!(species in SPECIES_CATALOG) || name.length === 0) return null;
  return { species, name };
}

// Pricing is flat by category. Tune from real data after M2 ships.
export function priceForAnimation(name: string): number {
  if (name === 'idle') return 0; // baseline — auto-granted, never billed
  if (name === 'walk' || name === 'run') return 50;
  if (name === 'attack') return 150;
  return 300; // attack2, attack3, death, hurt, takehit, jump, ...
}

// XP-gates depth. Movement is reachable early; combat needs a real player; misc
// is later-game polish.
export function levelRequiredForAnimation(name: string): number {
  if (name === 'idle') return 1;
  if (name === 'walk' || name === 'run') return 5;
  if (name === 'attack') return 15;
  return 25;
}

// All animations available on disk for a single species, with ownership state
// resolved against the `unlocks` table. Idle is always reported `owned: true`
// even when no row exists — it's the free baseline.
export function listAnimationsForSpecies(species: Species, ownedNames: ReadonlySet<string>): AnimationView[] {
  return listSpeciesAnimations(species)
    .map((name) => ({
      id: animationItemId(species, name),
      species,
      name,
      priceBits: priceForAnimation(name),
      levelRequired: levelRequiredForAnimation(name),
      owned: name === 'idle' || ownedNames.has(name),
    }))
    .sort(animationViewOrder);
}

// Stable ordering so the shop UI doesn't reshuffle: idle first, then by tier
// (cheapest → most expensive), alphabetic within a tier.
function animationViewOrder(a: AnimationView, b: AnimationView): number {
  if (a.name === 'idle' && b.name !== 'idle') return -1;
  if (b.name === 'idle' && a.name !== 'idle') return 1;
  if (a.priceBits !== b.priceBits) return a.priceBits - b.priceBits;
  return a.name.localeCompare(b.name);
}

// Builds a per-species map of AnimationView lists, restricted to species the
// player owns. Cross-references the unlocks table once per call.
export function getAnimationsCatalog(): Partial<Record<Species, AnimationView[]>> {
  const db = getDb();
  const ownedSpecies = db
    .prepare<[], { item_id: string }>(
      `SELECT item_id FROM unlocks WHERE category = 'species'`,
    )
    .all()
    .map((r) => r.item_id.slice('species:'.length) as Species)
    .filter((s) => s in SPECIES_CATALOG);

  // Owned animations bucketed by species. Single query keeps it cheap even
  // with the full roster eventually owned.
  const ownedByspecies = new Map<Species, Set<string>>();
  for (const row of db
    .prepare<[], { item_id: string }>(
      `SELECT item_id FROM unlocks WHERE category = 'animation'`,
    )
    .all()) {
    const parsed = parseAnimationItemId(row.item_id);
    if (!parsed) continue;
    let set = ownedByspecies.get(parsed.species);
    if (!set) {
      set = new Set();
      ownedByspecies.set(parsed.species, set);
    }
    set.add(parsed.name);
  }

  const catalog: Partial<Record<Species, AnimationView[]>> = {};
  for (const species of ownedSpecies) {
    catalog[species] = listAnimationsForSpecies(species, ownedByspecies.get(species) ?? new Set());
  }
  return catalog;
}

// Returns the set of canonical animation names owned for a single species.
// Used by the sprite-manifest filter on the getSprites IPC path.
export function getOwnedAnimationNames(species: Species): Set<string> {
  const rows = getDb()
    .prepare<[string], { item_id: string }>(
      `SELECT item_id FROM unlocks WHERE category = 'animation' AND item_id LIKE ?`,
    )
    .all(`${ANIMATION_ID_PREFIX}${species}:%`);
  const names = new Set<string>();
  for (const r of rows) {
    const parsed = parseAnimationItemId(r.item_id);
    if (parsed) names.add(parsed.name);
  }
  return names;
}

// Synthetic shop item for an animation id. Returns null if the id is malformed,
// the species isn't owned, or the animation isn't available on disk for that
// species. Caller can treat null as `error: 'unknown-item'`.
export interface AnimationShopItem {
  id: string;
  kind: 'animation';
  species: Species;
  name: string;
  priceBits: number;
  levelRequired: number;
  label: string;
  tier: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export function buildAnimationShopItem(id: string): AnimationShopItem | null {
  const parsed = parseAnimationItemId(id);
  if (!parsed) return null;
  // Cheap existence check — verify the species is owned and the animation
  // appears in the on-disk listing.
  const owned = getDb()
    .prepare<[string], { item_id: string }>(
      `SELECT item_id FROM unlocks WHERE category = 'species' AND item_id = ?`,
    )
    .get(`species:${parsed.species}`);
  if (!owned) return null;
  if (!listSpeciesAnimations(parsed.species).includes(parsed.name)) return null;
  const price = priceForAnimation(parsed.name);
  // Tier shadows pricing so the shop card's color accent matches the cost.
  let tier: AnimationShopItem['tier'] = 'common';
  if (price >= 300) tier = 'rare';
  else if (price >= 150) tier = 'uncommon';
  else if (price > 0) tier = 'common';
  return {
    id,
    kind: 'animation',
    species: parsed.species,
    name: parsed.name,
    priceBits: price,
    levelRequired: levelRequiredForAnimation(parsed.name),
    label: animationLabel(parsed.species, parsed.name),
    tier,
  };
}

function animationLabel(species: Species, name: string): string {
  const speciesLabel = SPECIES_CATALOG[species].label;
  const animLabel = name.charAt(0).toUpperCase() + name.slice(1);
  return `${speciesLabel} — ${animLabel}`;
}

// Pure helper exported for tests and for the unused-import linter to relax.
export { canonicalAnimationName };
