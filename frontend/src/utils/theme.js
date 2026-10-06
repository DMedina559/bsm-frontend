export const BUILT_IN_THEMES = [
  "default",
  "light",
  "black",
  "gradient",
  "green",
  "blue",
  "red",
  "pink",
  "yellow",
];
export const THEME_LABELS = {
  default: "Bedrock Emerald",
  light: "Daylight",
  black: "Midnight",
  gradient: "Aurora",
  green: "Forest",
  blue: "Ocean",
  red: "Ember",
  pink: "Orchid",
  yellow: "Gold",
};
export const APPEARANCE_KEY = "bsm.appearance.v4";
export const DEFAULT_APPEARANCE = {
  mode: "theme",
  density: "compact",
  panorama: false,
  panoramaVisibility: 18,
  sidebarTransparency: 0,
};
export function normalizeAppearance(value) {
  return {
    panorama: value?.panorama === true,
    sidebarTransparency: Number.isFinite(value?.sidebarTransparency)
      ? Math.max(0, Math.min(100, Math.round(value.sidebarTransparency)))
      : 0,
    panoramaVisibility: Number.isFinite(value?.panoramaVisibility)
      ? Math.max(0, Math.min(100, Math.round(value.panoramaVisibility)))
      : 18,
    mode: ["theme", "system", "light", "dark"].includes(value?.mode)
      ? value.mode
      : "theme",
    density: ["comfortable", "compact"].includes(value?.density)
      ? value.density
      : "compact",
  };
}
export function readAppearance() {
  try {
    return normalizeAppearance(
      JSON.parse(localStorage.getItem(APPEARANCE_KEY)),
    );
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}
export function resolveMode(theme, mode, systemDark) {
  if (mode === "system") return systemDark ? "dark" : "light";
  if (mode === "light" || mode === "dark") return mode;
  return theme === "light" ? "light" : "dark";
}
export function themeStylesheetUrl(theme, assetBase, apiBase) {
  const base = assetBase.replace(/\/$/, "");
  return BUILT_IN_THEMES.includes(theme)
    ? `${base}/assets/css/themes/${theme}.css`
    : `${apiBase}/themes/${encodeURIComponent(theme)}.css`;
}
