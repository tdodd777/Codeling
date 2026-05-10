import { ipcMain } from 'electron';
import type { PurchaseResponse, ShopItemView, Species, SpinResponse } from '@shared/types';
import { getLifetimeStats, getPet, getSpinState, getUnlocks } from './db/repos';
import { notifyUpdate } from './notify';
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
}
