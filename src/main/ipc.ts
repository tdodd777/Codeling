import { app, ipcMain } from 'electron';
import {
  SPECIES_CATALOG,
  SPIN_THRESHOLD_MAX,
  SPIN_THRESHOLD_MIN,
  type EconomyRuleKey,
  type EconomyRuleResponse,
  type PurchaseResponse,
  type ReceiverInfo,
  type RenameResponse,
  type SetActiveSpeciesResponse,
  type ShopItemView,
  type Species,
  type SpinResponse,
  type SpinThresholdResponse,
} from '@shared/types';
import {
  getAchievementsView,
  getLifetimeStats,
  getPet,
  getSpinState,
  getUnlocks,
  renamePet,
  resetSave,
  setActiveSpecies,
  setSpinThreshold,
} from './db/repos';
import { getDb } from './db/client';
import {
  ECONOMY_RULE_BOUNDS,
  getEconomyRules,
  resetEconomyRules,
  setEconomyRule,
} from './economy';
import { events } from './events';
import { notifyUpdate } from './notify';
import { exportSaveDialog, importSaveDialog } from './save';
import { getCurrentStreak } from './streaks';
import { getAnimationsCatalog, getOwnedAnimationNames } from './shop/animations';
import { SHOP_ITEMS } from './shop/catalog';
import { performPurchase } from './shop';
import { performSpin } from './spin';
import { buildSpriteManifest } from './sprites';

export function registerIpcHandlers(): void {
  ipcMain.handle('codeling:getPet', () => getPet());
  ipcMain.handle('codeling:getSpinState', () => getSpinState());
  ipcMain.handle('codeling:getStats', () => getLifetimeStats());
  ipcMain.handle('codeling:getSprites', (_, species: Species) => {
    // Manifest gets pruned to the player's owned animations for this species.
    // Idle + static always pass through (free baseline). Renderer stays dumb —
    // it just plays whatever the manifest hands back.
    const unlocked = getOwnedAnimationNames(species);
    return buildSpriteManifest(species, unlocked);
  });
  ipcMain.handle('codeling:getAnimationsCatalog', () => getAnimationsCatalog());
  ipcMain.handle('codeling:getUnlocks', () => getUnlocks());
  ipcMain.handle('codeling:getShopItems', (): ShopItemView[] => {
    // Owned species drop out of the buyable list — they'll appear in the
    // species tab via the unlocks query side, marked Active/Set-Active.
    const ownedIds = new Set(
      getDb()
        .prepare<[], { item_id: string }>(`SELECT item_id FROM unlocks`)
        .all()
        .map((r) => r.item_id),
    );
    // SHOP_ITEMS carries an `effect` / `species` field; strip them before
    // crossing IPC to keep the shared view type narrow.
    return SHOP_ITEMS.filter((s) => !ownedIds.has(s.id)).map((s) => ({
      id: s.id,
      kind: s.kind,
      priceBits: s.priceBits,
      label: s.label,
      description: s.description,
      tier: s.tier,
    }));
  });
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
  ipcMain.handle('codeling:getEconomyRules', () => ({
    rules: getEconomyRules(),
    bounds: ECONOMY_RULE_BOUNDS,
  }));
  ipcMain.handle('codeling:setEconomyRule', (_, key: EconomyRuleKey, raw: unknown): EconomyRuleResponse => {
    const value = typeof raw === 'number' ? raw : Number(raw);
    try {
      const rules = setEconomyRule(key, value);
      notifyUpdate();
      return { ok: true, rules };
    } catch (err) {
      const reason = (err as Error).message;
      if (reason === 'unknown-key' || reason === 'not-integer' || reason === 'out-of-range') {
        return { error: reason, bounds: ECONOMY_RULE_BOUNDS[key] };
      }
      throw err;
    }
  });
  ipcMain.handle('codeling:resetEconomyRules', () => {
    const rules = resetEconomyRules();
    notifyUpdate();
    return { rules };
  });
  ipcMain.handle('codeling:setActiveSpecies', (_, raw: unknown): SetActiveSpeciesResponse => {
    const species = String(raw) as Species;
    if (!(species in SPECIES_CATALOG)) return { error: 'not-owned' };
    const result = setActiveSpecies(species);
    if ('ok' in result) {
      events.emit('pet:species-changed', { species });
      notifyUpdate();
    }
    return result;
  });
  ipcMain.handle('codeling:resetSave', (): { ok: true } => {
    resetSave();
    events.emit('pet:reset');
    try {
      events.emit('pet:renamed', { name: getPet().name });
    } catch {
      /* pet read can fail in rare edge cases — ignore */
    }
    notifyUpdate();
    return { ok: true };
  });
  ipcMain.handle('codeling:getReceiverInfo', (): ReceiverInfo => ({
    http: 'http://127.0.0.1:4318',
    grpc: 'http://127.0.0.1:4317',
  }));
  ipcMain.handle('codeling:getAchievements', () => getAchievementsView());
  ipcMain.handle('codeling:getStreak', () => getCurrentStreak());
  ipcMain.handle('codeling:getAutoLaunch', (): boolean => {
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle('codeling:setAutoLaunch', (_, enabled: boolean): boolean => {
    // setLoginItemSettings is a no-op in unpackaged dev on some platforms; the
    // returned getLoginItemSettings reflects the actual stored state, so the
    // renderer sees the truth.
    app.setLoginItemSettings({ openAtLogin: !!enabled });
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle('codeling:exportSave', () => exportSaveDialog());
  ipcMain.handle('codeling:importSave', async () => {
    const res = await importSaveDialog();
    if ('ok' in res) {
      // Tray needs to refresh for the imported pet's species; emit the
      // same events resetSave does so all the same listeners fire.
      events.emit('pet:reset');
      try {
        events.emit('pet:renamed', { name: getPet().name });
      } catch {
        /* pet read can fail in malformed-import edge cases — ignore */
      }
      notifyUpdate();
    }
    return res;
  });
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
