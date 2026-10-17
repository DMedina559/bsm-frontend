import { settingField } from "../utils/settingsFields";
import { flattenSettings, updateSetting } from "../utils/settings";
const propertyKeys = new Set([
  "server-name",
  "gamemode",
  "difficulty",
  "allow-cheats",
  "max-players",
  "online-mode",
  "allow-list",
  "level-name",
  "default-player-permission-level",
  "texturepack-required",
  "view-distance",
  "tick-distance",
  "server-port",
  "server-portv6",
  "enable-lan-visibility",
  "compression-threshold",
  "compression-algorithm",
  "max-threads",
  "player-idle-timeout",
  "force-gamemode",
  "chat-restriction",
  "disable-persona",
  "disable-custom-skins",
]);
export const supportsDraftRecovery = (resource) =>
  resource === "settings" || /^server-(settings|properties):.+/.test(resource);
const safePath = (resource, path) => {
  if (resource.startsWith("server-properties:")) return propertyKeys.has(path);
  const metadata = settingField(path);
  return (
    Object.keys(metadata).length > 0 &&
    !metadata.readOnly &&
    metadata.type !== "password"
  );
};
const fields = (resource, value) =>
  resource.startsWith("server-properties:")
    ? Object.fromEntries(
        (Array.isArray(value) ? value : []).map(({ key, value }) => [
          key,
          value,
        ]),
      )
    : flattenSettings(value ?? {});
const scalar = (value) =>
  typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value)) ||
  (typeof value === "string" && value.length <= 4096) ||
  (Array.isArray(value) &&
    value.length <= 50 &&
    value.every((item) => typeof item === "string" && item.length <= 256));
export function createDraftPatch(resource, baseline, value) {
  if (!supportsDraftRecovery(resource)) return [];
  const before = fields(resource, baseline);
  return Object.entries(fields(resource, value))
    .filter(
      ([path, next]) =>
        safePath(resource, path) &&
        scalar(next) &&
        scalar(before[path]) &&
        JSON.stringify(next) !== JSON.stringify(before[path]),
    )
    .map(([path, next]) => ({ path, baseline: before[path], value: next }));
}
export function validDraftPatch(resource, patch) {
  return (
    supportsDraftRecovery(resource) &&
    Array.isArray(patch) &&
    patch.length <= 100 &&
    patch.every(
      (entry) =>
        typeof entry?.path === "string" &&
        safePath(resource, entry.path) &&
        scalar(entry.baseline) &&
        scalar(entry.value),
    )
  );
}
export function restoreDraftPatch(resource, current, patch) {
  if (!validDraftPatch(resource, patch)) return null;
  const before = fields(resource, current);
  const conflicted = patch.some(
    ({ path, baseline }) =>
      JSON.stringify(before[path]) !== JSON.stringify(baseline),
  );
  let value = current;
  for (const entry of patch) {
    if (resource.startsWith("server-properties:"))
      value = value.map((item) =>
        item.key === entry.path ? { ...item, value: entry.value } : item,
      );
    else value = updateSetting(value, entry.path, entry.value);
  }
  return { value, conflicted };
}
