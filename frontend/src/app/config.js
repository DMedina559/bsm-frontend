/** Public deployment settings loaded before the application module. */
export function getAppConfig() {
  const value = globalThis.BSM_CONFIG ?? {};
  const embedded = value.mode !== "standalone";
  const path = value.appBase ?? (embedded ? "/app" : "/");
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[?#\\\\]/.test(path)
  )
    throw new Error("appBase must be an absolute application path.");
  return {
    mode: embedded ? "embedded" : "standalone",
    appBase: path.replace(/\/+$/, "") || "/",
    backendUrl: value.backendUrl ?? "",
  };
}
