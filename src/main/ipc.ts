import { ipcMain } from 'electron';
import type { Species } from '@shared/types';
import { getLifetimeStats, getPet, getSpinState } from './db/repos';
import { buildSpriteManifest } from './sprites';

export function registerIpcHandlers(): void {
  ipcMain.handle('codeling:getPet', () => getPet());
  ipcMain.handle('codeling:getSpinState', () => getSpinState());
  ipcMain.handle('codeling:getStats', () => getLifetimeStats());
  ipcMain.handle('codeling:getSprites', (_, species: Species) => buildSpriteManifest(species));
}
