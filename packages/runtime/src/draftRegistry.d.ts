import type { Cleanup } from "./contracts.js";
export interface DraftModule {
  draftRegistry: {
    dirty(): boolean;
    subscribe(listener: () => void): Cleanup;
    register(): Cleanup;
  };
}
export function createDraftRegistryModule(): DraftModule;
