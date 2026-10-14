import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import previews from "./themePreviews.json";
it("theme swatches match shipped page, panel and accent colors", () => {
  for (const [theme, preview] of Object.entries(previews)) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.mode = theme === "light" ? "light" : "dark";
    const css = readFileSync(`public/assets/css/themes/${theme}.css`, "utf8");
    const tokens = {};
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!rule[1].trim().startsWith(":root") || !root.matches(rule[1].trim()))
        continue;
      for (const token of rule[2].matchAll(/(--[\w-]+):\s*([^;]+);/g))
        tokens[token[1]] = token[2].trim();
    }
    expect(preview.colors).toEqual([
      tokens["--bsm-page"],
      tokens["--bsm-surface"],
      tokens["--bsm-accent"],
    ]);
  }
  expect(new Set(Object.values(previews).map((p) => p.colors[0])).size).toBe(9);
});
