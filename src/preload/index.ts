import { contextBridge, ipcRenderer } from 'electron';
import type { CodelingApi } from '@shared/types';

const UPDATE_CHANNEL = 'codeling:update';

const api: CodelingApi = {
  getPet: () => ipcRenderer.invoke('codeling:getPet'),
  getSpinState: () => ipcRenderer.invoke('codeling:getSpinState'),
  getStats: () => ipcRenderer.invoke('codeling:getStats'),
  getSprites: (species, stage) => ipcRenderer.invoke('codeling:getSprites', species, stage ?? 0),
  getUnlocks: () => ipcRenderer.invoke('codeling:getUnlocks'),
  getShopItems: () => ipcRenderer.invoke('codeling:getShopItems'),
  spin: () => ipcRenderer.invoke('codeling:spin'),
  purchase: (itemId) => ipcRenderer.invoke('codeling:purchase', itemId),
  renamePet: (name) => ipcRenderer.invoke('codeling:renamePet', name),
  setSpinThreshold: (n) => ipcRenderer.invoke('codeling:setSpinThreshold', n),
  setEquipped: (itemId, equipped) => ipcRenderer.invoke('codeling:setEquipped', itemId, equipped),
  resetSave: () => ipcRenderer.invoke('codeling:resetSave'),
  getReceiverInfo: () => ipcRenderer.invoke('codeling:getReceiverInfo'),
  getAchievements: () => ipcRenderer.invoke('codeling:getAchievements'),
  getStreak: () => ipcRenderer.invoke('codeling:getStreak'),
  getAutoLaunch: () => ipcRenderer.invoke('codeling:getAutoLaunch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('codeling:setAutoLaunch', enabled),
  exportSave: () => ipcRenderer.invoke('codeling:exportSave'),
  importSave: () => ipcRenderer.invoke('codeling:importSave'),
  onUpdate: (cb) => {
    const handler = () => cb();
    ipcRenderer.on(UPDATE_CHANNEL, handler);
    return () => ipcRenderer.removeListener(UPDATE_CHANNEL, handler);
  },
};

contextBridge.exposeInMainWorld('codeling', api);
