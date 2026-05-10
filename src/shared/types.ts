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

export interface CodelingApi {
  getPet(): Promise<PetState>;
  getSpinState(): Promise<SpinState>;
  getStats(): Promise<LifetimeStats>;
  getSprites(species: Species, stage?: number): Promise<SpriteManifest>;
  getUnlocks(): Promise<UnlockedItem[]>;
  spin(): Promise<SpinResponse>;
  onUpdate(cb: () => void): () => void;
}

declare global {
  interface Window {
    codeling: CodelingApi;
  }
}
