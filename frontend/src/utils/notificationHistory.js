export const HISTORY_LIMIT = 100;
const valid = (entry) =>
  entry &&
  typeof entry.id === "string" &&
  typeof entry.message === "string" &&
  ["info", "success", "warning", "error"].includes(entry.type) &&
  Number.isFinite(entry.timestamp) &&
  Date.now() - entry.timestamp < 7 * 86400000;
export function readHistory(key) {
  if (!key) return [];
  try {
    let legacy;
    try {
      legacy = JSON.parse(localStorage.getItem(key));
    } catch {
      legacy = [];
    }
    const entries = new Map(
      (Array.isArray(legacy) ? legacy : [])
        .filter(valid)
        .map((entry) => [entry.id, entry]),
    );
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (name?.startsWith(`${key}:entry:`)) {
        try {
          const entry = JSON.parse(localStorage.getItem(name));
          if (valid(entry)) entries.set(entry.id, entry);
        } catch {
          /* Ignore corrupt entries. */
        }
      }
    }
    return [...entries.values()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, HISTORY_LIMIT)
      .map((entry) => ({ ...entry, read: entry.read === true }));
  } catch {
    return [];
  }
}
/** Each message has its own key so simultaneous tab writes cannot replace history. */
export function writeHistoryEntry(key, entry) {
  if (!key || !valid(entry)) return false;
  try {
    // Migrate the old array before deleting it.
    let legacy;
    try {
      legacy = JSON.parse(localStorage.getItem(key));
    } catch {
      legacy = [];
    }
    if (Array.isArray(legacy)) {
      for (const item of legacy.filter(valid))
        localStorage.setItem(`${key}:entry:${item.id}`, JSON.stringify(item));
      localStorage.removeItem(key);
    }
    localStorage.setItem(`${key}:entry:${entry.id}`, JSON.stringify(entry));
    const keep = new Set(
      readHistory(key).map((item) => `${key}:entry:${item.id}`),
    );
    const remove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (name?.startsWith(`${key}:entry:`) && !keep.has(name))
        remove.push(name);
    }
    remove.forEach((name) => localStorage.removeItem(name));
    return true;
  } catch {
    return false;
  }
}
export function clearStoredHistory(key) {
  if (!key) return;
  try {
    const remove = [key];
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (name?.startsWith(`${key}:entry:`)) remove.push(name);
    }
    remove.forEach((name) => localStorage.removeItem(name));
  } catch {
    /* In-memory history can still be cleared. */
  }
}
