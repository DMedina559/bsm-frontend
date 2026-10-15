import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getApiProxyBasePath,
  resolveAppAssetUrl,
  serializeHttpUrl,
} from "../../../src/utils/basePath";

const originalWindow = globalThis.window;
const originalLocation = Object.getOwnPropertyDescriptor(
  originalWindow,
  "location",
);
beforeEach(() => {
  delete globalThis.window.location;
  globalThis.window.location = {
    pathname: "",
    origin: "https://frontend.example",
  };
});
afterEach(() => {
  globalThis.window = originalWindow;
  Object.defineProperty(originalWindow, "location", originalLocation);
});

describe("getApiProxyBasePath", () => {
  it("returns empty string if /app is not in the path", () => {
    globalThis.window.location.pathname = "/something/else";
    expect(getApiProxyBasePath()).toBe("");
  });

  it("returns empty string if path starts exactly with /app", () => {
    globalThis.window.location.pathname = "/app/";
    expect(getApiProxyBasePath()).toBe("");
  });

  it("extracts proxy base path correctly", () => {
    globalThis.window.location.pathname = "/api/hassio_ingress/token/app/";
    expect(getApiProxyBasePath()).toBe("/api/hassio_ingress/token");
  });

  it("handles paths with query parameters correctly if passed in pathname", () => {
    globalThis.window.location.pathname = "/api/proxy/app/some-page";
    expect(getApiProxyBasePath()).toBe("/api/proxy");
  });
});

it("encodes DOM path text while preserving ingress escapes and slashes", () => {
  window.location.pathname =
    "/ingress/<img src=x onerror=alert(1)>/%2Ftoken/app/";
  const prefix = getApiProxyBasePath();
  expect(prefix).toBe(
    "/ingress/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E/%2Ftoken",
  );
  expect(prefix).not.toMatch(/[<>"\s]/);
  expect(resolveAppAssetUrl(`${prefix}/app/image/icon.png`)).toContain(
    "/%2Ftoken/app/image/icon.png",
  );
});
it.each(["//attacker.example/app/", "/\\attacker.example/app/"])(
  "rejects proxy paths that can change the target origin: %s",
  (path) => {
    window.location.pathname = path;
    expect(getApiProxyBasePath()).toBe("");
  },
);
it("rejects executable and foreign asset URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//attacker.example/style.css",
    "https://user:pass@frontend.example/style.css",
  ]) {
    expect(() => resolveAppAssetUrl(url)).toThrow();
  }
  expect(resolveAppAssetUrl("/app/assets/theme.css?v=revision")).toBe(
    "/app/assets/theme.css?v=revision",
  );
});

it("serializes HTTP URLs with fixed prefixes and preserves encoded paths", () => {
  const url = new URL(
    "https://backend.example:11325/%2Ftoken/icon.png?a=1&b=2#image",
  );
  expect(serializeHttpUrl(url)).toBe(
    "https://backend.example:11325/%2Ftoken/icon.png?a=1&b=2#image",
  );
  expect(serializeHttpUrl(url, true)).toBe("/%2Ftoken/icon.png?a=1&b=2#image");
  expect(serializeHttpUrl(new URL("http://backend.example/icon.png"))).toBe(
    "http://backend.example/icon.png",
  );
  expect(() => serializeHttpUrl(new URL("javascript:alert(1)"))).toThrow();
});

it("keeps double-slash paths on their validated origin", () => {
  expect(
    serializeHttpUrl(
      new URL("https://frontend.example//attacker.example/icon.png"),
      true,
    ),
  ).toBe("https://frontend.example//attacker.example/icon.png");
});

it("percent-encodes quotes without double-encoding paths or query delimiters", () => {
  expect(
    serializeHttpUrl(
      new URL("https://backend.example/player's/%2Ficon?q='value'&page=2"),
    ),
  ).toBe("https://backend.example/player%27s/%2Ficon?q=%27value%27&page=2");
});

it("resolves production theme assets beneath the app mount", () => {
  expect(resolveAppAssetUrl("./assets/css/themes/default.css?v=revision")).toBe(
    "/app/assets/css/themes/default.css?v=revision",
  );
  window.location.pathname =
    "/api/hassio_ingress/%2Ftoken/app/settings/account";
  expect(resolveAppAssetUrl("./assets/css/themes/light.css")).toBe(
    "/api/hassio_ingress/%2Ftoken/app/assets/css/themes/light.css",
  );
});
