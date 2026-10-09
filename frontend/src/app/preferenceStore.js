import { getSessionStorageKey } from "./sessionBoundary";

const CURRENT_VERSION = 1;

/**
 * Versioned per-account preference storage. Invalid/old payloads fall back
 * safely instead of breaking application bootstrap.
 */
export function createPreferenceStore(storage) {
  const getStorage = () => {
    if (storage) return storage;
    try { return globalThis.localStorage; } catch { return null; }
  };
  const keyFor = (identity, name) => getSessionStorageKey(identity, `preference:${name}`);
  return {
    read(identity, name, fallback, validate = () => true) {
      const key = keyFor(identity, name);
      if (!key) return fallback;
      try {
        const raw = getStorage()?.getItem(key);
        if (raw == null) return fallback;
        const parsed = JSON.parse(raw);
        if (parsed?.version !== CURRENT_VERSION || !validate(parsed.value)) return fallback;
        return parsed.value;
      } catch {
        return fallback;
      }
    },
    write(identity, name, value) {
      const key = keyFor(identity, name);
      if (!key) return false;
      try {
        const target = getStorage();
        if (!target) return false;
        target.setItem(key, JSON.stringify({ version: CURRENT_VERSION, value }));
        return true;
      } catch {
        return false;
      }
    },
    remove(identity, name) {
      const key = keyFor(identity, name);
      if (!key) return;
      try { getStorage()?.removeItem(key); } catch { /* storage may be unavailable */ }
    },
  };
}
