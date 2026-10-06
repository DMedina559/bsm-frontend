export const HISTORY_LIMIT = 100;
export function readHistory(key) {
  if (!key) return [];
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value)
      ? value
          .filter(
            (x) =>
              typeof x.id === "string" &&
              typeof x.message === "string" &&
              ["info", "success", "warning", "error"].includes(x.type) &&
              Number.isFinite(x.timestamp) &&
              Date.now() - x.timestamp < 7 * 86400000,
          )
          .slice(0, HISTORY_LIMIT)
          .map((x) => ({ ...x, read: x.read === true }))
      : [];
  } catch {
    return [];
  }
}
