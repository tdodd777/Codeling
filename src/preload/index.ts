import { contextBridge, ipcRenderer } from 'electron';
import type { CodelingApi } from '@shared/types';

const UPDATE_CHANNEL = 'codeling:update';

const api: CodelingApi = {
  getPet: () => ipcRenderer.invoke('codeling:getPet'),
  getSpinState: () => ipcRenderer.invoke('codeling:getSpinState'),
  getStats: () => ipcRenderer.invoke('codeling:getStats'),
  getSprites: (species, stage) => ipcRenderer.invoke('codeling:getSprites', species, stage ?? 0),
  getUnlocks: () => ipcRenderer.invoke('codeling:getUnlocks'),
  spin: () => ipcRenderer.invoke('codeling:spin'),
  onUpdate: (cb) => {
    const handler = () => cb();
    ipcRenderer.on(UPDATE_CHANNEL, handler);
    return () => ipcRenderer.removeListener(UPDATE_CHANNEL, handler);
  },
};

contextBridge.exposeInMainWorld('codeling', api);
