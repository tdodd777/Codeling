import { contextBridge, ipcRenderer } from 'electron';
import type { CodelingApi } from '@shared/types';

const UPDATE_CHANNEL = 'codeling:update';

const api: CodelingApi = {
  getPet: () => ipcRenderer.invoke('codeling:getPet'),
  getSpinState: () => ipcRenderer.invoke('codeling:getSpinState'),
  getStats: () => ipcRenderer.invoke('codeling:getStats'),
  getSprites: (species) => ipcRenderer.invoke('codeling:getSprites', species),
  getUnlocks: () => ipcRenderer.invoke('codeling:getUnlocks'),
  getShopItems: () => ipcRenderer.invoke('codeling:getShopItems'),
  spin: () => ipcRenderer.invoke('codeling:spin'),
  purchase: (itemId) => ipcRenderer.invoke('codeling:purchase', itemId),
  renamePet: (name) => ipcRenderer.invoke('codeling:renamePet', name),
  setSpinThreshold: (n) => ipcRenderer.invoke('codeling:setSpinThreshold', n),
  getEconomyRules: () => ipcRenderer.invoke('codeling:getEconomyRules'),
  setEconomyRule: (key, value) => ipcRenderer.invoke('codeling:setEconomyRule', key, value),
  resetEconomyRules: () => ipcRenderer.invoke('codeling:resetEconomyRules'),
  setActiveSpecies: (species) => ipcRenderer.invoke('codeling:setActiveSpecies', species),
  getAnimationsCatalog: () => ipcRenderer.invoke('codeling:getAnimationsCatalog'),
  getHomeAnimation: (species) => ipcRenderer.invoke('codeling:getHomeAnimation', species),
  setHomeAnimation: (species, name) => ipcRenderer.invoke('codeling:setHomeAnimation', species, name),
  resetSave: () => ipcRenderer.invoke('codeling:resetSave'),
  getReceiverInfo: () => ipcRenderer.invoke('codeling:getReceiverInfo'),
  getTelemetryEnabled: () => ipcRenderer.invoke('codeling:getTelemetryEnabled'),
  setTelemetryEnabled: (enabled) => ipcRenderer.invoke('codeling:setTelemetryEnabled', enabled),
  getAchievements: () => ipcRenderer.invoke('codeling:getAchievements'),
  getStreak: () => ipcRenderer.invoke('codeling:getStreak'),
  getAutoLaunch: () => ipcRenderer.invoke('codeling:getAutoLaunch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('codeling:setAutoLaunch', enabled),
  openPopout: () => ipcRenderer.invoke('codeling:openPopout'),
  closePopout: () => ipcRenderer.invoke('codeling:closePopout'),
  isPopoutOpen: () => ipcRenderer.invoke('codeling:isPopoutOpen'),
  exportSave: () => ipcRenderer.invoke('codeling:exportSave'),
  importSave: () => ipcRenderer.invoke('codeling:importSave'),
  onUpdate: (cb) => {
    const handler = () => cb();
    ipcRenderer.on(UPDATE_CHANNEL, handler);
    return () => ipcRenderer.removeListener(UPDATE_CHANNEL, handler);
  },
};

contextBridge.exposeInMainWorld('codeling', api);
