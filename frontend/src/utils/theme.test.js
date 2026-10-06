import { describe, it, expect } from "vitest";
import {
  normalizeAppearance,
  resolveMode,
  themeStylesheetUrl,
  readAppearance,
  APPEARANCE_KEY,
} from "./theme";
describe("theme preferences", () => {
  it("falls back safely on malformed storage", () => {
    localStorage.setItem(APPEARANCE_KEY, "{");
    expect(readAppearance()).toEqual({
      mode: "theme",
      density: "comfortable",
      panorama: false,
      panoramaVisibility: 18,
      sidebarTransparency: 0,
    });
  });
  it("rejects unknown preferences", () => {
    expect(normalizeAppearance({ mode: "broken", density: "tiny" })).toEqual({
      mode: "theme",
      density: "comfortable",
      panorama: false,
      panoramaVisibility: 18,
      sidebarTransparency: 0,
    });
  });
  it("supports theme defaults, explicit modes, and OS changes", () => {
    expect(resolveMode("light", "theme", true)).toBe("light");
    expect(resolveMode("default", "light", true)).toBe("light");
    expect(resolveMode("default", "system", false)).toBe("light");
    expect(resolveMode("default", "system", true)).toBe("dark");
  });
  it("preserves asset and ingress prefixes", () => {
    expect(themeStylesheetUrl("blue", "/ingress/app/", "/ingress")).toBe(
      "/ingress/app/assets/css/themes/blue.css",
    );
    expect(themeStylesheetUrl("custom name", "/app", "/ingress")).toBe(
      "/ingress/themes/custom%20name.css",
    );
  });
});

it("bounds panorama visibility and preserves zero", () => {
  expect(
    normalizeAppearance({ panoramaVisibility: 0 }).panoramaVisibility,
  ).toBe(0);
  expect(
    normalizeAppearance({ panoramaVisibility: 120 }).panoramaVisibility,
  ).toBe(100);
  expect(
    normalizeAppearance({ panoramaVisibility: -20 }).panoramaVisibility,
  ).toBe(0);
  expect(
    normalizeAppearance({ panoramaVisibility: "invalid" }).panoramaVisibility,
  ).toBe(18);
});

it("bounds sidebar transparency and defaults to opaque", () => {
  expect(normalizeAppearance({}).sidebarTransparency).toBe(0);
  expect(
    normalizeAppearance({ sidebarTransparency: 50 }).sidebarTransparency,
  ).toBe(50);
  expect(
    normalizeAppearance({ sidebarTransparency: 120 }).sidebarTransparency,
  ).toBe(100);
  expect(
    normalizeAppearance({ sidebarTransparency: -5 }).sidebarTransparency,
  ).toBe(0);
});

it("versions built-in theme CSS independently from the frontend release label", () => {
  expect(themeStylesheetUrl("default", "/app/", "", "abc123")).toBe(
    "/app/assets/css/themes/default.css?v=abc123",
  );
  expect(themeStylesheetUrl("custom", "/app/", "/ingress", "abc123")).toBe(
    "/ingress/themes/custom.css",
  );
});
