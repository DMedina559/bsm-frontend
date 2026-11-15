import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { extractCustomThemePreview } from "../../../src/utils/customThemePreview";
import builtIns from "../../../src/utils/themePreviews.json";

describe("custom CSS theme previews", () => {
  it("extracts the same palette tokens as every built-in preview", () => {
    for (const [theme, preview] of Object.entries(builtIns)) {
      const css = readFileSync(`public/assets/css/themes/${theme}.css`, "utf8");
      expect(
        extractCustomThemePreview(
          css,
          theme,
          theme === "light" ? "light" : "dark",
        ),
      ).toEqual({ colors: preview.colors });
    }
  });
  it("matches the requested theme and mode without altering the live document", () => {
    const before = document.documentElement.outerHTML;
    const css = `:root { --bsm-page: #111111; --bsm-surface:#222222; --bsm-accent: #333333; }
    :root[data-theme="test"][data-mode="light"] { --bsm-page:#eeeeee; }
    :root[data-theme="other"] { --bsm-page: #ff0000; }
    .card { --bsm-accent: #ff0000; }`;
    expect(extractCustomThemePreview(css, "test", "light").colors).toEqual([
      "#eeeeee",
      "#222222",
      "#333333",
    ]);
    expect(extractCustomThemePreview(css, "test", "dark").colors[0]).toBe(
      "#111111",
    );
    expect(document.documentElement.outerHTML).toBe(before);
  });
  it("resolves legacy aliases and nested variable fallbacks", () => {
    const css = `:root { --ink: #123456; --bg-color: var(--ink); --container-background-color: var(--missing, rgb(20, 30, 40)); --primary-color:var(--other, var(--ink)); }`;
    expect(extractCustomThemePreview(css, "test").colors).toEqual([
      "#123456",
      "rgb(20, 30, 40)",
      "#123456",
    ]);
  });
  it("honors specificity, important declarations, source order, and body inheritance", () => {
    const css = `:root[data-theme="test"] { --bsm-page: #123456; --bsm-accent: #333333 !important; }
      :root { --bsm-page:#eeeeee; --bsm-surface:#111111; --bsm-accent:#eeeeee; }
      body { --bsm-surface:#222222; } body { --bsm-surface:#444444; }`;
    expect(extractCustomThemePreview(css, "test").colors).toEqual([
      "#123456",
      "#444444",
      "#333333",
    ]);
  });
  it("filters inactive media rules and reads matching nested rules", () => {
    const css = `:root {--bsm-accent:#123456;} @media (min-width:9999px) {:root {--bsm-accent:#ff0000;}}
      @media (prefers-color-scheme:light) {:root {--bsm-page:#eeeeee;}}`;
    const matches = (query) => query === "(min-width:0px)";
    expect(
      extractCustomThemePreview(css, "test", "light", matches).colors,
    ).toEqual(["#eeeeee", "#ffffff", "#123456"]);
    expect(
      extractCustomThemePreview(css, "test", "dark", matches).colors,
    ).toEqual(["#030b0d", "#082223", "#123456"]);
  });
  it("never installs imported rules or resource URLs as preview colors", () => {
    const before = document.head.innerHTML;
    expect(
      extractCustomThemePreview(
        '@import url("https://other.test/theme.css"); :root {--bsm-page:url(https://other.test/image);--bsm-accent:expression(alert(1));}',
        "test",
      ),
    ).toBeNull();
    expect(document.head.innerHTML).toBe(before);
  });
  it("handles cycles, missing colors, malformed input, and oversized files", () => {
    for (const css of [
      null,
      "",
      ":root {--bsm-page:var(--bsm-page);}",
      ":root {",
      "x".repeat(1024 * 1024 + 1),
    ])
      expect(extractCustomThemePreview(css, "test")).toBeNull();
    expect(
      extractCustomThemePreview(":root {--bsm-accent:#123456;}", "test").colors,
    ).toEqual(["#030b0d", "#082223", "#123456"]);
  });
});
