const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
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
