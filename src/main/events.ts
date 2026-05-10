import { EventEmitter } from 'node:events';
import type { Species } from '@shared/types';

// Singleton main-process event bus — used for in-process cross-module signaling
// where coupling modules directly would create a tangle (economy → tray, etc.).
// Distinct from the renderer-broadcast `codeling:update` IPC channel.

export interface PetEvolvedEvent {
  species: Species;
  fromStage: number;
  toStage: number;
}

export interface PetRenamedEvent {
  name: string;
}

interface EventMap {
  'pet:evolved': [PetEvolvedEvent];
  'pet:renamed': [PetRenamedEvent];
}

class TypedEmitter extends EventEmitter {
  override emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]): boolean {
    return super.emit(event, ...args);
  }
  override on<K extends keyof EventMap>(event: K, listener: (...args: EventMap[K]) => void): this {
    return super.on(event, listener);
  }
  override off<K extends keyof EventMap>(event: K, listener: (...args: EventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

export const events = new TypedEmitter();
