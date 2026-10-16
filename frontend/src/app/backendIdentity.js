/** Canonical backend identity includes its ingress path, not just its host. */
export { getConnectionIdentity as getBackendIdentity } from "./connection";
import { getConnectionIdentity as getBackendIdentity } from "./connection";
export function getPreferenceIdentity(user) {
  const account = user?.id ?? user?.username ?? null;
  return account === null
    ? null
    : JSON.stringify([getBackendIdentity(), String(account)]);
}

/** Old account-only keys can only be attributed safely to the default backend. */
export function migrateAccountPreference(store, user, name) {
  const account = user?.id ?? user?.username ?? null;
  if (account === null) return;
  try {
    if (localStorage.getItem("api_base_url")) return;
    const identity = getPreferenceIdentity(user);
    const missing = Symbol("missing");
    if (store.read(identity, name, missing) !== missing) return;
    const value = store.read(account, name, missing);
    if (value !== missing && store.write(identity, name, value))
      store.remove(account, name);
  } catch {
    /* Migration can be retried if storage becomes available. */
  }
}
