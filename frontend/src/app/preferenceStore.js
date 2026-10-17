import { preferenceDefinitions } from "./preferenceDefinitions";
import { createPreferenceStore as createStore } from "@bedrock-server-manager/storage/preferenceStore";
export function createPreferenceStore(storage, definitions) {
  let target = storage;
  if (!target) {
    try {
      target = localStorage;
    } catch {
      /* Use memory when storage is unavailable. */
    }
  }
  return createStore(target, definitions, globalThis);
}

/** One notification and memory-fallback owner for application preferences. */
export const preferenceStore = createPreferenceStore(
  undefined,
  preferenceDefinitions,
);
