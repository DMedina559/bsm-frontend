import { localSettings } from "./browserStorage";
import { getAuthenticationMode, getConnectionIdentity } from "./connection";

const validToken = (token) =>
  typeof token === "string" &&
  /^bsm_td_[a-f0-9]{32}\.[A-Za-z0-9_-]{40,100}$/.test(token);
const backendKey = (backend) => {
  const url = new URL(backend, window.location.origin);
  return url.origin + url.pathname.replace(/\/+$/, "");
};
const key = (username, backend) =>
  `bsm.trusted-device-token:${encodeURIComponent(backendKey(backend))}:${encodeURIComponent(username)}`;

/** Only explicitly remembered bearer-mode proofs enter browser storage. Cookie mode is HttpOnly. */
export function readTrustedDevice(username, backend = getConnectionIdentity()) {
  if (!username) return undefined;
  const storageKey = key(username, backend);
  try {
    const record = JSON.parse(localSettings.getItem(storageKey) ?? "null");
    if (
      validToken(record?.token) &&
      Number.isFinite(record.expiresAt) &&
      record.expiresAt * 1000 > Date.now()
    )
      return record.token;
  } catch {
    /* Malformed storage cannot establish trust. */
  }
  localSettings.removeItem(storageKey);
  return undefined;
}
export function rememberTrustedDevice(
  username,
  result,
  backend = getConnectionIdentity(),
) {
  if (
    !username ||
    !validToken(result?.trusted_device_token) ||
    !Number.isFinite(result.trusted_device_expires_at)
  )
    return;
  localSettings.setItem(
    key(username, backend),
    JSON.stringify({
      token: result.trusted_device_token,
      expiresAt: result.trusted_device_expires_at,
    }),
  );
}
export function forgetTrustedDevice(
  username,
  backend = getConnectionIdentity(),
  deviceId,
) {
  const token = readTrustedDevice(username, backend);
  if (!deviceId || token?.split(".")[0] === `bsm_td_${deviceId}`)
    localSettings.removeItem(key(username, backend));
}
export function trustedDeviceOptions(username) {
  const token =
    getAuthenticationMode() === "bearer"
      ? readTrustedDevice(username)
      : undefined;
  return token ? { headers: { "X-BSM-Trusted-Device-Token": token } } : {};
}
