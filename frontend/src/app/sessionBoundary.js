import { queryClient } from "./queryClient";

/**
 * Invalidates the previous authenticated session before another user can read
 * its cached resources. Caller must close authenticated runtime transports.
 */
export async function resetApplicationSession() {
  await queryClient.cancelQueries();
  queryClient.clear();
}

export function getSessionStorageKey(identity, preference) {
  if (identity === null || identity === undefined || identity === "") return null;
  return `bsm:${encodeURIComponent(String(identity))}:${preference}`;
}
