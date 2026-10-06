import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import { BUILT_IN_THEMES } from "./theme";
const css = readFileSync("src/styles/tokens.css", "utf8");
const parse = (source) =>
  Object.fromEntries(
    [...source.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );
const lightStart = css.indexOf(':root[data-mode="light"]');
const dark = parse(css.slice(0, lightStart));
const light = parse(css.slice(lightStart, css.indexOf("}", lightStart)));
function resolve(value, tokens) {
  const variable = /^var\((--[\w-]+)\)$/.exec(value);
  return variable ? resolve(tokens[variable[1]], tokens) : value;
}
function luminance(hex) {
  let raw = hex.slice(1);
  if (raw.length === 3) raw = [...raw].map((c) => c + c).join("");
  const rgb = [0, 2, 4]
    .map((index) => parseInt(raw.slice(index, index + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function ratio(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const theme of BUILT_IN_THEMES)
  for (const mode of ["dark", "light"]) {
    it(`${theme} ${mode} text and primary-button contrast`, () => {
      const themeTokens = parse(
        readFileSync(
          new URL(
            `../../public/assets/css/themes/${theme}.css`,
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const tokens = {
        ...dark,
        ...themeTokens,
        ...(mode === "light" ? light : {}),
      };
      for (const [fg, bg] of [
        ["--text-color", "--container-background-color"],
        ["--text-color-secondary", "--bsm-surface-raised"],
        ["--form-input-text-color", "--form-input-background-color"],
        ["--primary-button-text-color", "--primary-button-background-color"],
      ])
        expect(
          ratio(resolve(tokens[fg], tokens), resolve(tokens[bg], tokens)),
        ).toBeGreaterThanOrEqual(4.5);
    });
  }
