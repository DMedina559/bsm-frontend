import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  clearCredentials,
  getToken,
  setCredentials,
  setApiBaseUrl,
  getConnectionIdentity,
} from "../../../src/app/connection";
import { getAppConfig } from "../../../src/app/config";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  delete globalThis.BSM_CONFIG;
  clearCredentials();
  vi.restoreAllMocks();
});
it("isolates credentials by backend host and ingress path", () => {
  localStorage.setItem("api_base_url", "https://one.example/ingress/one");
  setCredentials("one-token");
  localStorage.setItem("api_base_url", "https://one.example/ingress/two");
  expect(getToken()).toBeNull();
  setCredentials("two-token", true);
  localStorage.setItem("api_base_url", "https://other.example");
  expect(getToken()).toBeNull();
  localStorage.setItem("api_base_url", "https://one.example/ingress/one");
  expect(getToken()).toBe("one-token");
});
it("never sends an ambiguous legacy credential to a new backend", () => {
  sessionStorage.setItem("access_token", "old-token");
  expect(getToken()).toBeNull();
  localStorage.setItem("api_base_url", "https://new.example");
  expect(getToken()).toBeNull();
});
it("changing connections clears credentials before notifying the application", () => {
  setCredentials("old");
  const listener = vi.fn(() => expect(getToken()).toBeNull());
  window.addEventListener("bsm:connection-changed", listener);
  setApiBaseUrl("https://new.example/prefix");
  expect(listener).toHaveBeenCalledOnce();
  expect(getConnectionIdentity()).toBe("https://new.example/prefix");
  window.removeEventListener("bsm:connection-changed", listener);
});
it("uses instance-local memory when persistence reads or writes are blocked", () => {
  vi.spyOn(sessionStorage, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  vi.spyOn(sessionStorage, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  vi.spyOn(sessionStorage, "removeItem").mockImplementation(() => {
    throw Error("blocked");
  });
  setCredentials("memory-token");
  expect(getToken()).toBe("memory-token");
  clearCredentials();
  expect(getToken()).toBeNull();
});
it("validates deployment paths and preserves independent backend configuration", () => {
  globalThis.BSM_CONFIG = {
    mode: "standalone",
    appBase: "/console",
    backendUrl: "https://bsm.example",
  };
  expect(getAppConfig()).toMatchObject({
    mode: "standalone",
    appBase: "/console",
  });
  globalThis.BSM_CONFIG.appBase = "//foreign.example";
  expect(() => getAppConfig()).toThrow();
});

it("permits cookie recovery only for the embedded default connection", async () => {
  const { getAuthenticationMode } = await import("../../../src/app/connection");
  expect(getAuthenticationMode()).toBe("cookie-recovery");
  globalThis.BSM_CONFIG = { mode: "standalone" };
  expect(getAuthenticationMode()).toBe("bearer");
  delete globalThis.BSM_CONFIG;
  localStorage.setItem("api_base_url", window.location.origin);
  expect(getAuthenticationMode()).toBe("bearer");
});

it("uses bearer-only authentication for a saved workspace at the embedded host", async () => {
  const { getAuthenticationMode } = await import("../../../src/app/connection");
  const { saveInstance, selectInstance } =
    await import("../../../src/app/instanceProfiles");
  const { sessionSettings } = await import("../../../src/app/browserStorage");
  sessionSettings.setItem("show_hidden_flag", "true");
  const instance = saveInstance({
    name: "Same host",
    url: window.location.origin,
  });
  selectInstance(instance.id);
  expect(getAuthenticationMode()).toBe("bearer");
});
