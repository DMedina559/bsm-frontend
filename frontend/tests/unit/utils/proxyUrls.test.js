import { beforeEach, afterEach, expect, it } from "vitest";
import {
  getApiProxyBasePath,
  resolveAppAssetUrl,
} from "../../../src/utils/basePath";
import { themeStylesheetUrl } from "../../../src/utils/theme";
import {
  resolveApiUrl,
  resolveWebSocketUrl,
  validateBackendUrl,
} from "../../../src/api/transport";
import { resolvePluginUrl } from "../../../src/utils/pluginUrl";
const original = Object.getOwnPropertyDescriptor(window, "location");
beforeEach(() => {
  delete window.location;
  window.location = {
    origin: "https://bsm.test",
    protocol: "https:",
    pathname: "/proxy/app/token/app/settings",
  };
  localStorage.clear();
  document.head.innerHTML =
    '<base id="app-asset-base" href="/proxy/app/token/app/" data-api-base="/proxy/app/token">';
});
afterEach(() => {
  Object.defineProperty(window, "location", original);
  document.head.innerHTML = "";
  localStorage.clear();
});
it("uses the runtime prefix once for API, sockets, custom themes, and plugin resources", () => {
  expect(getApiProxyBasePath()).toBe("/proxy/app/token");
  expect(resolveApiUrl("/api/servers")).toBe("/proxy/app/token/api/servers");
  expect(resolveWebSocketUrl()).toBe("wss://bsm.test/proxy/app/token/ws");
  expect(resolveApiUrl(themeStylesheetUrl("custom", "./"))).toBe(
    "/proxy/app/token/themes/custom.css",
  );
  expect(resolvePluginUrl("/plugin/example/image.png")).toBe(
    "/proxy/app/token/plugin/example/image.png",
  );
  expect(
    resolveAppAssetUrl(themeStylesheetUrl("default", "./", "revision")),
  ).toBe("/proxy/app/token/app/assets/css/themes/default.css?v=revision");
  expect(resolveAppAssetUrl("./image/icon/favicon.ico")).toBe(
    "/proxy/app/token/app/image/icon/favicon.ico",
  );
});
it("does not guess from nested app segments when runtime metadata is available", () => {
  window.location.pathname = "/proxy/app/token/app/plugin/app";
  expect(getApiProxyBasePath()).toBe("/proxy/app/token");
});
it("rejects an HTTP backend from HTTPS for HTTP and sockets, including persisted settings", () => {
  expect(() => validateBackendUrl("http://backend.test")).toThrow(
    /HTTPS backend/,
  );
  localStorage.setItem("api_base_url", "http://backend.test");
  expect(() => resolveApiUrl("/api/servers")).toThrow(/HTTPS backend/);
  expect(() => resolveWebSocketUrl()).toThrow(/HTTPS backend/);
  expect(resolvePluginUrl("http://external.test/image.png")).toBeNull();
});
it("supports HTTP on an HTTP page and HTTPS backends with their own prefix", () => {
  window.location.protocol = "http:";
  expect(validateBackendUrl("http://backend.test/prefix/")).toBe(
    "http://backend.test/prefix",
  );
  localStorage.setItem("api_base_url", "https://backend.test/other");
  expect(resolveWebSocketUrl()).toBe("wss://backend.test/other/ws");
  expect(resolvePluginUrl("/plugin/image.png")).toBe(
    "https://backend.test/other/plugin/image.png",
  );
});
it("retains explicitly external HTTPS resources", () => {
  expect(resolvePluginUrl("https://external.test/image.png")).toBe(
    "https://external.test/image.png",
  );
  expect(resolvePluginUrl("javascript:alert(1)")).toBeNull();
  expect(resolvePluginUrl("http://external.test/", { navigation: true })).toBe(
    "http://external.test/",
  );
});

it("keeps plugin app navigation on the frontend while resources use the remote backend", () => {
  localStorage.setItem("api_base_url", "https://backend.test/other");
  expect(resolvePluginUrl("/app/overview", { navigation: true })).toBe(
    "/proxy/app/token/app/overview",
  );
  expect(resolvePluginUrl("#section", { navigation: true })).toBe(
    "/proxy/app/token/app/settings#section",
  );
});
