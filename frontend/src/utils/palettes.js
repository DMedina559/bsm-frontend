export const PALETTE_KEY = "bsm.palettes.v4";
export const PALETTE_FIELDS = {
  accent: "Accent",
  page: "Page background",
  surface: "Panel background",
  text: "Text",
  muted: "Secondary text",
};
export const DEFAULT_PALETTE = {
  name: "My palette",
  accent: "#159568",
  page: "#101a16",
  surface: "#192820",
  text: "#eaf5ee",
  muted: "#a7bdae",
};
export function validatePalette(value) {
  if (
    !value ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 60
  )
    throw new Error("Enter a palette name (up to 60 characters).");
  const result = { name: value.name.trim() };
  for (const key of Object.keys(PALETTE_FIELDS)) {
    if (!/^#[0-9a-f]{6}$/i.test(value[key]))
      throw new Error("Palette colors must be six-digit hex colors.");
    result[key] = value[key];
  }
  return result;
}
function luminance(hex) {
  const c = hex
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function paletteCss(value) {
  const p = validatePalette(value);
  const onAccent =
    contrast(p.accent, "#ffffff") >= contrast(p.accent, "#000000")
      ? "#ffffff"
      : "#000000";
  const aliases = {
    "bg-color": "page",
    "text-color": "text",
    "text-color-secondary": "muted",
    "header-text-color": "text",
    "container-background-color": "surface",
    "sidebar-bg-custom": "surface",
    "server-card-background-color": "surface",
    "border-color": "border",
    "button-background-color": "surface-raised",
    "button-text-color": "text",
    "button-border-color": "border",
    "primary-color": "accent",
    "primary-button-background-color": "accent-strong",
    "primary-button-border-color": "accent-strong",
    "primary-button-text-color": "on-accent",
    "form-input-background-color": "input",
    "form-input-text-color": "text",
    "form-input-border-color": "border",
    "form-label-text-color": "text",
    "table-header-background-color": "surface-raised",
    "table-header-text-color": "muted",
  };
  const compatibility = Object.entries(aliases)
    .map(([key, value]) => `  --${key}: var(--bsm-${value});`)
    .join("\n");
  return `:root[data-mode] {\n  --bsm-accent: ${p.accent};\n  --bsm-accent-strong: ${p.accent};\n  --bsm-accent-hover: ${p.accent};\n  --bsm-on-accent: ${onAccent};\n  --bsm-focus: ${p.accent};\n  --bsm-page: ${p.page};\n  --bsm-surface: ${p.surface};\n  --bsm-surface-raised: ${p.surface};\n  --bsm-input: ${p.surface};\n  --bsm-text: ${p.text};\n  --bsm-muted: ${p.muted};\n  --bsm-border: color-mix(in srgb, ${p.muted} 35%, ${p.surface});\n${compatibility}\n}\n`;
}
export function readPaletteState() {
  try {
    const state = JSON.parse(localStorage.getItem(PALETTE_KEY));
    const palettes = Array.isArray(state?.palettes)
      ? state.palettes.slice(0, 30).map(validatePalette)
      : [];
    return {
      palettes,
      active: palettes.some((p) => p.name === state.active)
        ? state.active
        : null,
    };
  } catch {
    return { palettes: [], active: null };
  }
}
