import { getAppBasePath } from "../utils/basePath";
import { localSettings, sessionSettings } from "./browserStorage";
import { validateBackendUrl } from "./backendUrl";

export const INSTANCE_PROFILES_KEY = "bsm.instance-profiles.v1";
export const INSTANCE_RECORD_PREFIX = "bsm.instance-record.v1:";
export const isInstanceProfileKey = (key) =>
  key === INSTANCE_PROFILES_KEY || key?.startsWith(INSTANCE_RECORD_PREFIX);
export const ACTIVE_INSTANCE_URL_KEY = "bsm.active-instance-url";
export const ACTIVE_INSTANCE_KEY = "bsm.active-instance";
export const instancesEnabled = () =>
  sessionSettings.getItem("show_hidden_flag") === "true";
const rememberSelectedUrl = () => {
  const profile = getActiveInstance();
  if (profile) sessionSettings.setItem(ACTIVE_INSTANCE_URL_KEY, profile.url);
};
const notify = () => {
  rememberSelectedUrl();
  window.dispatchEvent(new Event("bsm:instances-changed"));
};
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
        return [
          {
            id: value.id,
            name: value.name.slice(0, 80),
            url,
            ...profileOptions(value),
          },
        ];
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
export function saveInstance({ name, url, ...options }) {
  name = name.trim();
  if (!name || name.length > 80)
    throw new Error("Enter a name of 1–80 characters.");
  url = validateBackendUrl(url.trim());
  const profiles = readInstances();
  if (profiles.some((profile) => profile.url === url))
    throw new Error("This backend is already saved.");
  const profile = {
    id: crypto.randomUUID(),
    name,
    url,
    ...profileOptions(options),
  };
  localSettings.setItem(
    INSTANCE_RECORD_PREFIX + profile.id,
    JSON.stringify(profile),
  );
  notify();
  return profile;
}
function profileOptions(value) {
  const options = {};
  if (typeof value.group === "string" && value.group.trim())
    options.group = value.group.trim().slice(0, 60);
  if (typeof value.color === "string" && /^#[0-9a-f]{6}$/i.test(value.color))
    options.color = value.color;
  if (value.paused === true) options.paused = true;
  if (value.titleInTab === true) options.titleInTab = true;
  return options;
}
export function updateInstance(id, patch) {
  const current = readInstances().find((profile) => profile.id === id);
  if (!current) throw new Error("Instance no longer exists.");
  const value = { ...current, ...patch };
  const name = value.name.trim();
  if (!name || name.length > 80)
    throw new Error("Enter a name of 1–80 characters.");
  const url = validateBackendUrl(value.url.trim(), {
    allowMixedContent: value.url === current.url,
  });
  if (
    readInstances().some((profile) => profile.id !== id && profile.url === url)
  )
    throw new Error("This backend is already saved.");
  const profile = { id, name, url, ...profileOptions(value) };
  localSettings.setItem(INSTANCE_RECORD_PREFIX + id, JSON.stringify(profile));
  if (url !== current.url) {
    writeInstanceToken(current.url, null);
    writeInstanceToken(url, null);
  }
  notify();
  return profile;
}
export function renameInstance(id, name) {
  return updateInstance(id, { name });
}
export function getInstanceIssue() {
  if (
    !instancesEnabled() &&
    new URLSearchParams(window.location.search).get("hidden") !== "true"
  )
    return null;
  const id =
    new URLSearchParams(window.location.search).get("instance") ??
    sessionSettings.getItem(ACTIVE_INSTANCE_KEY);
  if (!id) return null;
  const profile = readInstances().find((value) => value.id === id);
  return !profile
    ? "This instance was removed. Choose another connection to continue."
    : profile.paused
      ? `${profile.name} is paused. Resume it in Instances or choose another connection.`
      : null;
}
export function getSelectedInstanceUrl() {
  return (
    sessionSettings.getItem(ACTIVE_INSTANCE_URL_KEY) ||
    "https://removed-instance.invalid"
  );
}
export function exportInstanceProfiles() {
  return JSON.stringify(
    {
      version: 1,
      instances: readInstances().map(({ name, url, ...profile }) => ({
        name,
        url,
        ...profileOptions(profile),
      })),
    },
    null,
    2,
  );
}
export function importInstanceProfiles(text) {
  if (text.length > 256000)
    throw new Error("Profile imports must be smaller than 256 KB.");
  const data = JSON.parse(text);
  if (
    data?.version !== 1 ||
    !Array.isArray(data.instances) ||
    data.instances.length > 100
  )
    throw new Error(
      "Use a version 1 instance export containing at most 100 profiles.",
    );
  const prepared = data.instances.map((value) => {
    if (
      typeof value?.name !== "string" ||
      !value.name.trim() ||
      value.name.trim().length > 80 ||
      typeof value.url !== "string"
    )
      throw new Error("Invalid instance profile.");
    return {
      name: value.name.trim(),
      url: validateBackendUrl(value.url, { allowMixedContent: true }),
      ...profileOptions(value),
    };
  });
  const urls = new Set(readInstances().map((value) => value.url));
  let added = 0;
  for (const value of prepared) {
    if (urls.has(value.url)) continue;
    const profile = { id: crypto.randomUUID(), ...value };
    localSettings.setItem(
      INSTANCE_RECORD_PREFIX + profile.id,
      JSON.stringify(profile),
    );
    urls.add(profile.url);
    added++;
  }
  notify();
  return { added, skipped: prepared.length - added };
}
export function selectInstance(id) {
  if (!instancesEnabled())
    throw new Error("Enable hidden features before selecting an instance.");
  if (id !== null && !readInstances().some((profile) => profile.id === id))
    throw new Error("Instance no longer exists.");
  if (id === null) {
    sessionSettings.removeItem(ACTIVE_INSTANCE_KEY);
    sessionSettings.removeItem(ACTIVE_INSTANCE_URL_KEY);
  } else {
    sessionSettings.setItem(ACTIVE_INSTANCE_KEY, id);
    sessionSettings.setItem(
      ACTIVE_INSTANCE_URL_KEY,
      readInstances().find((profile) => profile.id === id).url,
    );
  }
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
  writeInstanceToken(profile.url, null);
  localSettings.setItem(INSTANCE_RECORD_PREFIX + id, "null");
  notify();
}
export function subscribeInstances(listener) {
  const storage = (event) => {
    if (isInstanceProfileKey(event.key)) rememberSelectedUrl();
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
    tab.sessionStorage.setItem(ACTIVE_INSTANCE_URL_KEY, profile.url);
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
