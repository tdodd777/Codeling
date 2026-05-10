export type Species = 'wizard' | 'slime' | 'robot';

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
  background?: string; // url to a stage scenery PNG, if the species has one
  // Per-cosmetic-id, per-direction overlay URLs. Empty record when no
  // cosmetics/ subdir exists. Renderer composites these atop the base sprite
  // when the matching item is equipped.
  cosmeticOverlays: Record<string, Partial<Record<Direction, string>>>;
}

export interface PetState {
  species: Species;
  name: string;
  evolutionStage: number;
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
  reward: { id: string; kind: 'bits' | 'xp' | 'cosmetic'; tier: SpinTier; label: string };
  applied:
    | { kind: 'bits'; amount: number; consolationFor?: string }
    | { kind: 'xp'; amount: number; levelsGained: number }
    | { kind: 'cosmetic'; cosmeticId: string };
  spinsRemaining: number;
}

export type SpinResponse = SpinResult | { error: 'no-spins' };

export interface UnlockedItem {
  itemId: string;
  category: string;
  acquiredVia: string;
  acquiredAt: number;
  equipped: boolean;
  label: string;
  tier: SpinTier;
}

export type ShopItemKind = 'cosmetic' | 'upgrade';

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
      category: ShopItemKind;
      bitsRemaining: number;
      pricePaid: number;
    }
  | { error: 'unknown-item' }
  | { error: 'insufficient'; bits: number; price: number }
  | { error: 'already-owned' };

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

export interface CodelingApi {
  getPet(): Promise<PetState>;
  getSpinState(): Promise<SpinState>;
  getStats(): Promise<LifetimeStats>;
  getSprites(species: Species, stage?: number): Promise<SpriteManifest>;
  getUnlocks(): Promise<UnlockedItem[]>;
  getShopItems(): Promise<ShopItemView[]>;
  spin(): Promise<SpinResponse>;
  purchase(itemId: string): Promise<PurchaseResponse>;
  renamePet(name: string): Promise<RenameResponse>;
  setSpinThreshold(n: number): Promise<SpinThresholdResponse>;
  getEconomyRules(): Promise<{ rules: EconomyRules; bounds: EconomyRuleBounds }>;
  setEconomyRule(key: EconomyRuleKey, value: number): Promise<EconomyRuleResponse>;
  resetEconomyRules(): Promise<{ rules: EconomyRules }>;
  setEquipped(itemId: string, equipped: boolean): Promise<{ ok: true } | { error: 'not-owned' }>;
  resetSave(): Promise<{ ok: true }>;
  getReceiverInfo(): Promise<ReceiverInfo>;
  getAchievements(): Promise<AchievementView[]>;
  getStreak(): Promise<number>;
  getAutoLaunch(): Promise<boolean>;
  setAutoLaunch(enabled: boolean): Promise<boolean>;
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
