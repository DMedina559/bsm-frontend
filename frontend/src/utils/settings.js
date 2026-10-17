import { settingField } from "./settingsFields";
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
/** Only user changes belong in writes; reported state is never submitted. */
export function changedSettings(settings, savedSnapshot) {
  const baseline = flattenSettings(JSON.parse(savedSnapshot ?? "{}"));
  return Object.entries(flattenSettings(settings)).filter(
    ([path, value]) =>
      path !== "config_schema_version" &&
      !path.startsWith("plugin_settings.") &&
      !path.startsWith("server_info.") &&
      !settingField(path).readOnly &&
      JSON.stringify(value) !== JSON.stringify(baseline[path]),
  );
}
export function isSafeSettingPath(path) {
  return (
    typeof path === "string" &&
    path.split(".").every((key) => key.trim() && !UNSAFE_KEYS.has(key))
  );
}
export function updateSetting(object, path, value) {
  if (!isSafeSettingPath(path)) return object;
  const assign = (current, [first, ...remaining]) => ({
    ...current,
    [first]: remaining.length
      ? assign(current?.[first] || {}, remaining)
      : value,
  });
  return assign(object, path.split("."));
}
export function flattenSettings(object, prefix = "") {
  return Object.entries(object).reduce((result, [key, value]) => {
    if (UNSAFE_KEYS.has(key)) return result;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value))
      Object.assign(result, flattenSettings(value, path));
    else result[path] = value;
    return result;
  }, {});
}
