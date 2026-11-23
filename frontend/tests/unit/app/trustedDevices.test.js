import { beforeEach, expect, it, vi } from "vitest";
import {
  readTrustedDevice,
  rememberTrustedDevice,
  forgetTrustedDevice,
  trustedDeviceOptions,
} from "../../../src/app/trustedDevices";
const mode = vi.hoisted(() => ({ value: "bearer" }));
vi.mock("../../../src/app/connection", () => ({
  getAuthenticationMode: () => mode.value,
  getConnectionIdentity: () => "https://one.example",
}));
const token = "bsm_td_" + "a".repeat(32) + "." + "s".repeat(43);
const result = () => ({
  trusted_device_token: token,
  trusted_device_expires_at: Math.floor(Date.now() / 1000) + 86400,
});
beforeEach(() => {
  localStorage.clear();
  mode.value = "bearer";
});
it("isolates remembered factors by backend and username", () => {
  rememberTrustedDevice("owner", result());
  expect(readTrustedDevice("owner")).toBe(token);
  expect(readTrustedDevice("other")).toBeUndefined();
  expect(readTrustedDevice("owner", "https://two.example")).toBeUndefined();
  expect(
    trustedDeviceOptions("owner").headers["X-BSM-Trusted-Device-Token"],
  ).toBe(token);
  mode.value = "cookie-recovery";
  expect(trustedDeviceOptions("owner")).toEqual({});
});
it("rejects expired or malformed credentials and forgets only the matching device", () => {
  rememberTrustedDevice("owner", result());
  forgetTrustedDevice("owner", "https://one.example", "b".repeat(32));
  expect(readTrustedDevice("owner")).toBe(token);
  forgetTrustedDevice("owner", "https://one.example", "a".repeat(32));
  expect(readTrustedDevice("owner")).toBeUndefined();
  rememberTrustedDevice("owner", { ...result(), trusted_device_expires_at: 1 });
  expect(readTrustedDevice("owner")).toBeUndefined();
  rememberTrustedDevice("owner", {
    ...result(),
    trusted_device_token: "invalid",
  });
  expect(readTrustedDevice("owner")).toBeUndefined();
});
