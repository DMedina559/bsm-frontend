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
  density: "comfortable",
  panorama: false,
  panoramaVisibility: 18,
  panoramaSize: "cover",
  panoramaScale: 100,
  panoramaPosition: "center",
  panoramaRepeat: "no-repeat",
  panoramaAttachment: "fixed",
  panoramaScrollStrength: 20,
  panoramaMotion: "none",
  panoramaDuration: 60,
  reducedMotion: "system",
  sidebarTransparency: 0,
};
export function normalizeAppearance(value) {
  return {
    panorama: value?.panorama === true,
    panoramaSize: ["cover", "contain", "auto", "custom"].includes(
      value?.panoramaSize,
    )
      ? value.panoramaSize
      : "cover",
    panoramaScale: Number.isFinite(value?.panoramaScale)
      ? Math.max(25, Math.min(300, Math.round(value.panoramaScale)))
      : 100,
    panoramaPosition: ["center", "top", "bottom", "left", "right"].includes(
      value?.panoramaPosition,
    )
      ? value.panoramaPosition
      : "center",
    panoramaRepeat: ["no-repeat", "repeat", "repeat-x", "repeat-y"].includes(
      value?.panoramaRepeat,
    )
      ? value.panoramaRepeat
      : "no-repeat",
    panoramaAttachment: ["fixed", "scroll", "parallax"].includes(
      value?.panoramaAttachment,
    )
      ? value.panoramaAttachment
      : "fixed",
    panoramaScrollStrength: Number.isFinite(value?.panoramaScrollStrength)
      ? Math.max(0, Math.min(100, Math.round(value.panoramaScrollStrength)))
      : 20,
    panoramaMotion: ["none", "horizontal", "diagonal"].includes(
      value?.panoramaMotion,
    )
      ? value.panoramaMotion
      : "none",
    panoramaDuration: Number.isFinite(value?.panoramaDuration)
      ? Math.max(20, Math.min(180, Math.round(value.panoramaDuration)))
      : 60,
    reducedMotion: ["system", "reduce", "allow"].includes(value?.reducedMotion)
      ? value.reducedMotion
      : "system",
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
      : "comfortable",
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
export function themeStylesheetUrl(theme, assetBase, revision = "") {
  const base = assetBase.replace(/\/$/, "");
  return BUILT_IN_THEMES.includes(theme)
    ? `${base}/assets/css/themes/${theme}.css${revision ? `?v=${encodeURIComponent(revision)}` : ""}`
    : `/themes/${encodeURIComponent(theme)}.css`;
}
