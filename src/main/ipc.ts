import { ipcMain } from 'electron';
import {
  SPIN_THRESHOLD_MAX,
  SPIN_THRESHOLD_MIN,
  type PurchaseResponse,
  type ReceiverInfo,
  type RenameResponse,
  type ShopItemView,
  type Species,
  type SpinResponse,
  type SpinThresholdResponse,
} from '@shared/types';
import { getAchievementsView, getLifetimeStats, getPet, getSpinState, getUnlocks, renamePet, resetSave, setSpinThreshold } from './db/repos';
import { events } from './events';
import { notifyUpdate } from './notify';
import { getCurrentStreak } from './streaks';
import { SHOP_ITEMS } from './shop/catalog';
import { performPurchase } from './shop';
import { performSpin } from './spin';
import { buildSpriteManifest } from './sprites';

export function registerIpcHandlers(): void {
  ipcMain.handle('codeling:getPet', () => getPet());
  ipcMain.handle('codeling:getSpinState', () => getSpinState());
  ipcMain.handle('codeling:getStats', () => getLifetimeStats());
  ipcMain.handle('codeling:getSprites', (_, species: Species, stage?: number) =>
    buildSpriteManifest(species, stage ?? 0),
  );
  ipcMain.handle('codeling:getUnlocks', () => getUnlocks());
  ipcMain.handle('codeling:getShopItems', (): ShopItemView[] =>
    // SHOP_ITEMS carries an `effect` field for upgrades; strip it before
    // crossing IPC to keep the shared view type narrow.
    SHOP_ITEMS.map((s) => ({
      id: s.id,
      kind: s.kind,
      priceBits: s.priceBits,
      label: s.label,
      description: s.description,
      tier: s.tier,
    })),
  );
  ipcMain.handle('codeling:spin', (): SpinResponse => {
    const result = performSpin();
    // Spin always touches state if it succeeded (pet bits/xp or unlocks list,
    // plus spin counter). Broadcast so panel re-renders.
    if (!('error' in result)) notifyUpdate();
    return result;
  });
  ipcMain.handle('codeling:purchase', (_, itemId: string): PurchaseResponse => {
    const result = performPurchase(itemId);
    if ('ok' in result) notifyUpdate();
    return result;
  });
  ipcMain.handle('codeling:setSpinThreshold', (_, raw: unknown): SpinThresholdResponse => {
    const n = typeof raw === 'number' ? raw : Number(raw);
    try {
      const written = setSpinThreshold(n);
      notifyUpdate();
      return { ok: true, value: written };
    } catch (err) {
      const reason = (err as Error).message;
      if (reason === 'not-integer' || reason === 'out-of-range') {
        return { error: reason, min: SPIN_THRESHOLD_MIN, max: SPIN_THRESHOLD_MAX };
      }
      throw err;
    }
  });
  ipcMain.handle('codeling:resetSave', (): { ok: true } => {
    resetSave();
    events.emit('pet:reset');
    events.emit('pet:renamed', { name: 'Wizard' });
    notifyUpdate();
    return { ok: true };
  });
  ipcMain.handle('codeling:getReceiverInfo', (): ReceiverInfo => ({
    http: 'http://127.0.0.1:4318',
    grpc: 'http://127.0.0.1:4317',
  }));
  ipcMain.handle('codeling:getAchievements', () => getAchievementsView());
  ipcMain.handle('codeling:getStreak', () => getCurrentStreak());
  ipcMain.handle('codeling:renamePet', (_, name: string): RenameResponse => {
    if (typeof name !== 'string') return { error: 'empty-name' };
    try {
      const written = renamePet(name);
      events.emit('pet:renamed', { name: written });
      notifyUpdate();
      return { ok: true, name: written };
    } catch (err) {
      const reason = (err as Error).message;
      if (reason === 'empty-name' || reason === 'name-too-long') {
        return { error: reason };
      }
      throw err;
    }
  });
}
