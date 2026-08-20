import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getApiProxyBasePath } from "./basePath";

describe("getApiProxyBasePath", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    // Delete window.location so we can mock it
    delete globalThis.window.location;
    globalThis.window.location = { pathname: "" };
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

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
