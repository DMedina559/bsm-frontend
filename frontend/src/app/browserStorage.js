/** Browser persistence with an instance-local fallback and deletion tombstones. */
export function createBrowserStorage(area) {
  const memory = new Map();
  return {
    getItem(key) {
      if (memory.has(key)) return memory.get(key);
      try {
        return globalThis[area].getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        globalThis[area].setItem(key, value);
        memory.delete(key);
      } catch {
        memory.set(key, String(value));
      }
    },
    removeItem(key) {
      try {
        globalThis[area].removeItem(key);
        memory.delete(key);
      } catch {
        memory.set(key, null);
      }
    },
  };
}
export const localSettings = createBrowserStorage("localStorage");
export const sessionSettings = createBrowserStorage("sessionStorage");
