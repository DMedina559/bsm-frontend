import { validateBackendUrl } from "./backendUrl";
export { validateBackendUrl } from "./backendUrl";
import {
  getActiveInstance,
  ACTIVE_INSTANCE_KEY,
  INSTANCE_PROFILES_KEY,
} from "./instanceProfiles";
import { createUrlResolver } from "@bedrock-server-manager/api-client/urls";
import { getApiProxyBasePath, serializeHttpUrl } from "../utils/basePath";
import { getAppConfig } from "./config";
import { localSettings, sessionSettings } from "./browserStorage";
const ports = { localStorage: localSettings, sessionStorage: sessionSettings };
const read = (area, key) => ports[area].getItem(key);
const write = (area, key, value) =>
  value === null
    ? ports[area].removeItem(key)
    : ports[area].setItem(key, value);
export function getApiBaseUrl() {
  return (
    getActiveInstance()?.url ??
    read("localStorage", "api_base_url") ??
    getAppConfig().backendUrl
  );
}
export function getConnectionIdentity() {
  const url = new URL(
    getApiBaseUrl() || getApiProxyBasePath() || "/",
    window.location.origin,
  );
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}
const credentialKey = () =>
  `bsm.credentials:${encodeURIComponent(getConnectionIdentity())}`;
export function getToken() {
  const key = credentialKey();
  const current = read("sessionStorage", key) || read("localStorage", key);
  if (current) return current;
  // Unscoped legacy tokens cannot be attributed to a backend safely. Embedded
  // deployments can recover their cookie session through reauthentication.
  return null;
}
export function clearCredentials() {
  for (const area of ["sessionStorage", "localStorage"]) {
    write(area, credentialKey(), null);
    write(area, "access_token", null);
  }
}
export function setCredentials(token, remember = false) {
  clearCredentials();
  write(remember ? "localStorage" : "sessionStorage", credentialKey(), token);
}
export function setApiBaseUrl(value) {
  const next = value ? validateBackendUrl(value) : "";
  clearCredentials();
  sessionSettings.removeItem(ACTIVE_INSTANCE_KEY);
  write("localStorage", "api_base_url", next || null);
  clearCredentials();
  window.dispatchEvent(new Event("bsm:connection-changed"));
}
export function resolveApiUrl(path) {
  const configured = getApiBaseUrl();
  const prefix = configured
    ? validateBackendUrl(configured)
    : getApiProxyBasePath();
  const base = new URL(prefix || "/", window.location.origin);
  const result = new URL(createUrlResolver(base.href)(path));
  return serializeHttpUrl(
    result,
    !configured && path.startsWith("/") && !path.startsWith("//"),
  );
}
export function resolveWebSocketUrl() {
  const url = new URL(resolveApiUrl("/ws"), window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}
export function isSessionStorageEvent(event) {
  return (
    event.key === null ||
    event.key === "api_base_url" ||
    event.key === INSTANCE_PROFILES_KEY ||
    event.key === "access_token" ||
    event.key === credentialKey()
  );
}
