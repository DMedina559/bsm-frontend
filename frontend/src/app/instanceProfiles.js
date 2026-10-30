import { getAppBasePath } from "../utils/basePath";
import { localSettings, sessionSettings } from "./browserStorage";
import { validateBackendUrl } from "./backendUrl";

export const INSTANCE_PROFILES_KEY = "bsm.instance-profiles.v1";
export const INSTANCE_RECORD_PREFIX = "bsm.instance-record.v1:";
export const isInstanceProfileKey = (key) =>
  key === INSTANCE_PROFILES_KEY || key?.startsWith(INSTANCE_RECORD_PREFIX);
export const ACTIVE_INSTANCE_KEY = "bsm.active-instance";
export const instancesEnabled = () =>
  sessionSettings.getItem("show_hidden_flag") === "true";
const notify = () => window.dispatchEvent(new Event("bsm:instances-changed"));
export function readInstances() {
  try {
    let values = JSON.parse(
      localSettings.getItem(INSTANCE_PROFILES_KEY) ?? "[]",
    );
    if (!Array.isArray(values)) values = [];
    // Independent records prevent edits to different profiles overwriting each other.
    const merged = new Map(values.map((value) => [value?.id, value]));
    for (const key of localSettings.keys()) {
      if (!key.startsWith(INSTANCE_RECORD_PREFIX)) continue;
      try {
        const id = key.slice(INSTANCE_RECORD_PREFIX.length);
        const value = JSON.parse(localSettings.getItem(key));
        if (value === null) merged.delete(id);
        else merged.set(id, value);
      } catch {
        /* Preserve other valid profiles. */
      }
    }
    values = [...merged.values()];
    const seen = new Set();
    return values.flatMap((value) => {
      try {
        if (
          typeof value.id !== "string" ||
          !value.id ||
          typeof value.name !== "string" ||
          !value.name.trim()
        )
          return [];
        const url = validateBackendUrl(value.url, { allowMixedContent: true });
        if (seen.has(url) || seen.has(value.id)) return [];
        seen.add(url);
        seen.add(value.id);
        return [{ id: value.id, name: value.name.slice(0, 80), url }];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
export function getActiveInstance() {
  const params = new URLSearchParams(window.location.search);
  if (!instancesEnabled() && params.get("hidden") !== "true") return null;
  const id =
    params.get("instance") ?? sessionSettings.getItem(ACTIVE_INSTANCE_KEY);
  return readInstances().find((profile) => profile.id === id) ?? null;
}
export function saveInstance({ name, url }) {
  name = name.trim();
  if (!name || name.length > 80)
    throw new Error("Enter a name of 1–80 characters.");
  url = validateBackendUrl(url.trim());
  const profiles = readInstances();
  if (profiles.some((profile) => profile.url === url))
    throw new Error("This backend is already saved.");
  const profile = { id: crypto.randomUUID(), name, url };
  localSettings.setItem(
    INSTANCE_RECORD_PREFIX + profile.id,
    JSON.stringify(profile),
  );
  notify();
  return profile;
}
export function renameInstance(id, name) {
  name = name.trim();
  if (!name || name.length > 80)
    throw new Error("Enter a name of 1–80 characters.");
  const profile = readInstances().find((value) => value.id === id);
  if (!profile) throw new Error("Instance no longer exists.");
  localSettings.setItem(
    INSTANCE_RECORD_PREFIX + id,
    JSON.stringify({ ...profile, name }),
  );
  notify();
}
export function selectInstance(id) {
  if (!instancesEnabled())
    throw new Error("Enable hidden features before selecting an instance.");
  if (id !== null && !readInstances().some((profile) => profile.id === id))
    throw new Error("Instance no longer exists.");
  if (id === null) sessionSettings.removeItem(ACTIVE_INSTANCE_KEY);
  else sessionSettings.setItem(ACTIVE_INSTANCE_KEY, id);
  window.dispatchEvent(new Event("bsm:connection-changed"));
  notify();
}
export const instanceCredentialKey = (url) =>
  `bsm.credentials:${encodeURIComponent(validateBackendUrl(url, { allowMixedContent: true }))}`;
export function readInstanceToken(url) {
  const key = instanceCredentialKey(url);
  return sessionSettings.getItem(key) || localSettings.getItem(key) || null;
}
export function writeInstanceToken(
  url,
  token,
  remember = false,
  source = "instances",
) {
  const key = instanceCredentialKey(url);
  sessionSettings.removeItem(key);
  localSettings.removeItem(key);
  if (token) (remember ? localSettings : sessionSettings).setItem(key, token);
  window.dispatchEvent(
    new CustomEvent("bsm:instance-credentials", { detail: { url, source } }),
  );
}
export function removeInstance(id) {
  const profile = readInstances().find((item) => item.id === id);
  if (!profile) return;
  if (getActiveInstance()?.id === id) selectInstance(null);
  writeInstanceToken(profile.url, null);
  localSettings.setItem(INSTANCE_RECORD_PREFIX + id, "null");
  notify();
}
export function subscribeInstances(listener) {
  const storage = (event) => {
    if (
      event.key === null ||
      isInstanceProfileKey(event.key) ||
      event.key?.startsWith("bsm.credentials:")
    )
      listener();
  };
  window.addEventListener("bsm:instances-changed", listener);
  window.addEventListener("bsm:instance-credentials", listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("bsm:instances-changed", listener);
    window.removeEventListener("bsm:instance-credentials", listener);
    window.removeEventListener("storage", storage);
  };
}

export function openInstanceTab(id) {
  const profile = readInstances().find((item) => item.id === id);
  if (!profile || !instancesEnabled())
    throw new Error("Select a saved instance with hidden features enabled.");
  const tab = window.open("about:blank", "_blank");
  if (!tab)
    throw new Error(
      "The browser blocked the new tab. Allow popups or use Open workspace.",
    );
  try {
    tab.opener = null;
    tab.sessionStorage.clear();
    tab.sessionStorage.setItem("show_hidden_flag", "true");
    tab.sessionStorage.setItem(ACTIVE_INSTANCE_KEY, id);
    const token = readInstanceToken(profile.url);
    if (token && !localSettings.getItem(instanceCredentialKey(profile.url)))
      tab.sessionStorage.setItem(instanceCredentialKey(profile.url), token);
    tab.location.replace(
      `${window.location.origin}${getAppBasePath().replace(/\/+$/, "")}/?hidden=true&instance=${encodeURIComponent(id)}`,
    );
  } catch (error) {
    tab.close();
    throw error;
  }
}
