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
      density: "compact",
      panorama: false,
    });
  });
  it("rejects unknown preferences", () => {
    expect(normalizeAppearance({ mode: "broken", density: "tiny" })).toEqual({
      mode: "theme",
      density: "compact",
      panorama: false,
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
