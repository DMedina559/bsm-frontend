import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_PALETTE,
  PALETTE_KEY,
  paletteCss,
  validatePalette,
  readPaletteState,
  contrast,
} from "./palettes";
describe("personal palettes", () => {
  beforeEach(() => localStorage.clear());
  it("validates imported palette colors and names", () => {
    expect(
      validatePalette({ ...DEFAULT_PALETTE, name: "  Ocean  " }).name,
    ).toBe("Ocean");
    expect(() =>
      validatePalette({ ...DEFAULT_PALETTE, accent: "red; background:url(x)" }),
    ).toThrow();
    expect(() => validatePalette({ ...DEFAULT_PALETTE, name: " " })).toThrow();
  });
  it("exports semantic CSS and chooses readable button text", () => {
    expect(paletteCss({ ...DEFAULT_PALETTE, accent: "#ffffff" })).toContain(
      "--bsm-on-accent: #000000",
    );
    expect(paletteCss({ ...DEFAULT_PALETTE, accent: "#000000" })).toContain(
      "--bsm-on-accent: #ffffff",
    );
    expect(contrast("#ffffff", "#000000")).toBe(21);
  });
  it("restores saved palettes and drops unknown selections", () => {
    localStorage.setItem(
      PALETTE_KEY,
      JSON.stringify({
        palettes: [DEFAULT_PALETTE],
        active: DEFAULT_PALETTE.name,
      }),
    );
    expect(readPaletteState().active).toBe(DEFAULT_PALETTE.name);
    localStorage.setItem(
      PALETTE_KEY,
      JSON.stringify({ palettes: [DEFAULT_PALETTE], active: "missing" }),
    );
    expect(readPaletteState().active).toBeNull();
  });
  it("recovers from corrupt saved data", () => {
    localStorage.setItem(PALETTE_KEY, "bad json");
    expect(readPaletteState()).toEqual({ palettes: [], active: null });
  });
});

it("gives personal colors priority over built-in mode-specific surface rules", () => {
  const personalSelector = paletteCss(DEFAULT_PALETTE).split("{")[0].trim();
  const defaultCss = readFileSync(
    "public/assets/css/themes/default.css",
    "utf8",
  );
  const surfaceSelector = defaultCss.split("}")[1].split("{")[0].trim();
  const root = document.documentElement;
  root.dataset.theme = "default";
  root.dataset.mode = "dark";
  root.dataset.density = "compact";
  expect(root.matches(personalSelector)).toBe(true);
  expect(root.matches(surfaceSelector)).toBe(true);
  const specificity = (selector) => (selector.match(/\[/g) || []).length;
  expect(specificity(personalSelector)).toBeGreaterThan(
    specificity(surfaceSelector),
  );
});
