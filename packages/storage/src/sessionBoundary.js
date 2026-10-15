export function getSessionStorageKey(identity, preference) {
  if (identity === null || identity === undefined || identity === "")
    return null;
  return `bsm:${encodeURIComponent(String(identity))}:${preference}`;
}
