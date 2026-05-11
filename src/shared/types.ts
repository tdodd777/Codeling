export type Species =
  | 'wizard'
  | 'slime'
  | 'flying_eye'
  | 'bat'
  | 'mimic'
  | 'evil_wizard'
  | 'fire_worm'
  | 'martial_hero'
  | 'martial_hero_2'
  | 'apprentice_wizard'
  | 'goblin'
  | 'skeleton'
  | 'mushroom'
  | 'rat';

export type Direction =
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest';

export interface SpriteManifest {
  static: string; // url to single-frame fallback (always populated)
  animations: Record<string, Partial<Record<Direction, string[]>>>;
  background?: string; // url to per-species scenery PNG, if any
}

export interface PetState {
  species: Species;
  name: string;
  level: number;
  xp: number;
  bits: number;
  createdAt: number;
}

export interface SpinState {
  spinsAvailable: number;
  messagesSinceLastSpin: number;
  spinThreshold: number;
}

export interface SessionRow {
  sessionId: string;
  startedAt: number;
  lastSeenAt: number;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface LifetimeStats {
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalCostUsd: number;
  sessionCount: number;
}

export type SignalType = 'trace' | 'metric' | 'log';
export type Transport = 'http' | 'grpc';

export type SpinTier = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface SpinResult {
  reward: { id: string; kind: 'bits' | 'xp' | 'species_token'; tier: SpinTier; label: string };
  applied:
    | { kind: 'bits'; amount: number; consolationFor?: 'species_token' }
    | { kind: 'xp'; amount: number; levelsGained: number }
    | { kind: 'species'; species: Species };
  spinsRemaining: number;
}

export type SpinResponse = SpinResult | { error: 'no-spins' };

export interface UnlockedItem {
  itemId: string;
  category: string;
  acquiredVia: string;
  acquiredAt: number;
  label: string;
  tier: SpinTier;
}

export type ShopItemKind = 'species' | 'upgrade';

export interface ShopItemView {
  id: string;
  kind: ShopItemKind;
  priceBits: number;
  label: string;
  description?: string;
  tier: SpinTier;
}

export type PurchaseResponse =
  | {
      ok: true;
      itemId: string;
      category: ShopItemKind | 'animation';
      bitsRemaining: number;
      pricePaid: number;
    }
  | { error: 'unknown-item' }
  | { error: 'insufficient'; bits: number; price: number }
  | { error: 'already-owned' }
  | { error: 'level-locked'; required: number; current: number };

export type RenameResponse =
  | { ok: true; name: string }
  | { error: 'empty-name' | 'name-too-long' };

export const PET_NAME_MAX_LENGTH = 32;

export type SpinThresholdResponse =
  | { ok: true; value: number }
  | { error: 'not-integer' | 'out-of-range'; min: number; max: number };

export const SPIN_THRESHOLD_MIN = 5;
export const SPIN_THRESHOLD_MAX = 1000;

export interface ReceiverInfo {
  http: string;
  grpc: string;
}

export const ECONOMY_RULE_KEYS = [
  'xpPerMessage',
  'xpPerOutputTokens',
  'bitsPerMessage',
  'bitsPerOutputTokens',
] as const;
export type EconomyRuleKey = (typeof ECONOMY_RULE_KEYS)[number];
export type EconomyRules = Record<EconomyRuleKey, number>;

export interface EconomyRuleBound {
  min: number;
  max: number;
}
export type EconomyRuleBounds = Record<EconomyRuleKey, EconomyRuleBound>;

export type EconomyRuleResponse =
  | { ok: true; rules: EconomyRules }
  | { error: 'unknown-key' | 'not-integer' | 'out-of-range'; bounds?: EconomyRuleBound };

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface AchievementView {
  id: string;
  label: string;
  description: string;
  tier: AchievementTier;
  earned: boolean;
  earnedAt?: number;
}

export type SetActiveSpeciesResponse =
  | { ok: true; species: Species; name: string }
  | { error: 'not-owned' };

export interface AnimationView {
  id: string;          // `anim:<species>:<name>`
  species: Species;
  name: string;        // canonical animation key (e.g., 'run', 'attack', 'death')
  priceBits: number;
  levelRequired: number;
  owned: boolean;
}

export type SpeciesAnimationsCatalog = Partial<Record<Species, AnimationView[]>>;

// Display + economy metadata for every species. Drives the shop catalog,
// achievement totals, and any rendered species label. Pricing is bits-based
// and tier-stratified — common ~200, legendary ~1500. Tune after playtest.
export interface SpeciesInfo {
  label: string;
  tier: SpinTier;
  priceBits: number;
}

export const SPECIES_CATALOG: Record<Species, SpeciesInfo> = {
  wizard:            { label: 'Wizard',            tier: 'common',    priceBits: 200 },
  slime:             { label: 'Slime',             tier: 'common',    priceBits: 200 },
  bat:               { label: 'Bat',               tier: 'common',    priceBits: 200 },
  rat:               { label: 'Rat',               tier: 'common',    priceBits: 200 },
  mushroom:          { label: 'Mushroom',          tier: 'common',    priceBits: 200 },
  skeleton:          { label: 'Skeleton',          tier: 'common',    priceBits: 200 },
  goblin:            { label: 'Goblin',            tier: 'common',    priceBits: 200 },
  flying_eye:        { label: 'Flying Eye',        tier: 'uncommon',  priceBits: 400 },
  fire_worm:         { label: 'Fire Worm',         tier: 'uncommon',  priceBits: 400 },
  mimic:             { label: 'Mimic',             tier: 'rare',      priceBits: 800 },
  evil_wizard:       { label: 'Evil Wizard',       tier: 'rare',      priceBits: 800 },
  apprentice_wizard: { label: 'Apprentice Wizard', tier: 'rare',      priceBits: 800 },
  martial_hero:      { label: 'Martial Hero',      tier: 'legendary', priceBits: 1500 },
  martial_hero_2:    { label: 'Martial Hero II',   tier: 'legendary', priceBits: 1500 },
};

export interface CodelingApi {
  getPet(): Promise<PetState>;
  getSpinState(): Promise<SpinState>;
  getStats(): Promise<LifetimeStats>;
  getSprites(species: Species): Promise<SpriteManifest>;
  getUnlocks(): Promise<UnlockedItem[]>;
  getShopItems(): Promise<ShopItemView[]>;
  spin(): Promise<SpinResponse>;
  purchase(itemId: string): Promise<PurchaseResponse>;
  renamePet(name: string): Promise<RenameResponse>;
  setSpinThreshold(n: number): Promise<SpinThresholdResponse>;
  getEconomyRules(): Promise<{ rules: EconomyRules; bounds: EconomyRuleBounds }>;
  setEconomyRule(key: EconomyRuleKey, value: number): Promise<EconomyRuleResponse>;
  resetEconomyRules(): Promise<{ rules: EconomyRules }>;
  setActiveSpecies(species: Species): Promise<SetActiveSpeciesResponse>;
  getAnimationsCatalog(): Promise<SpeciesAnimationsCatalog>;
  getHomeAnimation(species: Species): Promise<string>;
  setHomeAnimation(species: Species, name: string): Promise<{ ok: true; name: string } | { error: 'not-owned' }>;
  resetSave(): Promise<{ ok: true }>;
  getReceiverInfo(): Promise<ReceiverInfo>;
  getTelemetryEnabled(): Promise<{ enabled: boolean; running: boolean }>;
  setTelemetryEnabled(enabled: boolean): Promise<{ enabled: boolean; running: boolean }>;
  getAchievements(): Promise<AchievementView[]>;
  getStreak(): Promise<number>;
  getAutoLaunch(): Promise<boolean>;
  setAutoLaunch(enabled: boolean): Promise<boolean>;
  openPopout(): Promise<{ ok: true } | { error: 'not-initialized' }>;
  closePopout(): Promise<{ ok: true }>;
  isPopoutOpen(): Promise<boolean>;
  exportSave(): Promise<{ ok: true; path: string } | { error: 'cancelled' | 'write-failed'; detail?: string }>;
  importSave(): Promise<
    | { ok: true; path: string }
    | { error: 'cancelled' | 'read-failed' | 'invalid-format' | 'unsupported-version'; detail?: string }
  >;
  onUpdate(cb: () => void): () => void;
}

declare global {
  interface Window {
    codeling: CodelingApi;
  }
}
