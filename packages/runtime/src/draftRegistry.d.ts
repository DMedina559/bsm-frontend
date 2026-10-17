import type { Cleanup } from "./contracts.js";
export interface DraftModule {
  draftRegistry: {
    dirty(): boolean;
    clear(): void;
    subscribe(listener: () => void): Cleanup;
    register(): Cleanup;
  };
}
export function createDraftRegistryModule(): DraftModule;
