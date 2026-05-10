import { ipcMain } from 'electron';
import type { Species, SpinResponse } from '@shared/types';
import { getLifetimeStats, getPet, getSpinState, getUnlocks } from './db/repos';
import { notifyUpdate } from './notify';
import { performSpin } from './spin';
import { buildSpriteManifest } from './sprites';

export function registerIpcHandlers(): void {
  ipcMain.handle('codeling:getPet', () => getPet());
  ipcMain.handle('codeling:getSpinState', () => getSpinState());
  ipcMain.handle('codeling:getStats', () => getLifetimeStats());
  ipcMain.handle('codeling:getSprites', (_, species: Species) => buildSpriteManifest(species));
  ipcMain.handle('codeling:getUnlocks', () => getUnlocks());
  ipcMain.handle('codeling:spin', (): SpinResponse => {
    const result = performSpin();
    // Spin always touches state if it succeeded (pet bits/xp or unlocks list,
    // plus spin counter). Broadcast so panel re-renders.
    if (!('error' in result)) notifyUpdate();
    return result;
  });
}
