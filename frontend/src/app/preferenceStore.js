import { getSessionStorageKey } from "./sessionBoundary";
/** Versioned, validated preferences with safe migrations and tab subscriptions. */
export function createPreferenceStore(storage, definitions = {}) {
  const listeners = new Map();
  const memory = new Map();
  const getStorage = () => {
    try {
      return storage ?? globalThis.localStorage;
    } catch {
      return null;
    }
  };
  const keyFor = (identity, name) =>
    getSessionStorageKey(identity, `preference:${name}`);
  const notify = (key) => listeners.get(key)?.forEach((listener) => listener());
  const onStorage = (event) => {
    if (event.key === null) {
      memory.clear();
      listeners.forEach((callbacks) =>
        callbacks.forEach((listener) => listener()),
      );
    } else {
      memory.delete(event.key);
      notify(event.key);
    }
  };
  const store = {
    subscribe(identity, name, listener) {
      const key = keyFor(identity, name);
      if (!key) return () => {};
      if (!listeners.size) globalThis.addEventListener?.("storage", onStorage);
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(listener);
      return () => {
        listeners.get(key)?.delete(listener);
        if (!listeners.get(key)?.size) listeners.delete(key);
        if (!listeners.size)
          globalThis.removeEventListener?.("storage", onStorage);
      };
    },
    read(identity, name, fallback, validate = () => true) {
      const key = keyFor(identity, name);
      if (!key) return fallback;
      try {
        const raw = memory.has(key)
          ? memory.get(key)
          : getStorage()?.getItem(key);
        if (raw == null) return fallback;
        let parsed = JSON.parse(raw);
        const definition = definitions[name];
        const version = definition?.version ?? 1;
        const valid = (value) =>
          validate(value) &&
          (!definition?.validate || definition.validate(value));
        if (Number.isInteger(parsed?.version) && parsed.version < version) {
          while (parsed.version < version) {
            const migrate = definition?.migrations?.[parsed.version];
            if (!migrate) return fallback;
            parsed = {
              version: parsed.version + 1,
              value: migrate(parsed.value),
            };
          }
          if (
            !valid(parsed.value) ||
            !store.write(identity, name, parsed.value)
          )
            return fallback;
        }
        return parsed?.version === version && valid(parsed.value)
          ? parsed.value
          : fallback;
      } catch {
        return fallback;
      }
    },
    validate(name, value) {
      try {
        return (
          !definitions[name]?.validate ||
          Boolean(definitions[name].validate(value))
        );
      } catch {
        return false;
      }
    },
    write(identity, name, value) {
      const key = keyFor(identity, name);
      const definition = definitions[name];
      if (!key || !store.validate(name, value)) return false;
      let raw;
      try {
        raw = JSON.stringify({ version: definition?.version ?? 1, value });
      } catch {
        return false;
      }
      try {
        const target = getStorage();
        if (!target) throw new Error("Storage unavailable");
        target.setItem(key, raw);
        memory.delete(key);
      } catch {
        memory.set(key, raw);
      }
      notify(key);
      return true;
    },
    remove(identity, name) {
      const key = keyFor(identity, name);
      if (!key) return false;
      try {
        const target = getStorage();
        if (!target) throw new Error("Storage unavailable");
        target.removeItem(key);
        memory.delete(key);
      } catch {
        memory.set(key, null);
      }
      notify(key);
      return true;
    },
  };
  return store;
}
