import { validMetricUnits } from "../utils/metricUnits";
import { normalizeAppearance } from "../utils/theme";
import { validatePalette } from "../utils/palettes";

export const preferenceDefinitions = {
  selectedServer: {
    version: 1,
    validate: (value) => typeof value === "string" && value.length > 0,
  },
  sidebarCollapsed: {
    version: 1,
    validate: (value) => typeof value === "boolean",
  },
  metricUnits: { version: 1, validate: validMetricUnits },
  appearance: {
    version: 1,
    validate: (value) =>
      value &&
      JSON.stringify(normalizeAppearance(value)) === JSON.stringify(value),
  },
  palettes: {
    version: 1,
    validate: (value) => {
      try {
        return (
          Array.isArray(value?.palettes) &&
          value.palettes.length <= 30 &&
          value.palettes.every((palette) => Boolean(validatePalette(palette)))
        );
      } catch {
        return false;
      }
    },
  },
  overviewLayout: {
    version: 1,
    validate: (value) => ["grid", "compact", "list"].includes(value),
  },
  serverSort: {
    version: 1,
    validate: (value) =>
      ["name", "status", "version", "players"].includes(value?.key) &&
      ["asc", "desc"].includes(value?.direction),
  },
};
export const legacyPreferenceKeys = {
  sidebarCollapsed: "sidebarCollapsed",
  appearance: "bsm.appearance.v4",
  palettes: "bsm.palettes.v4",
  overviewLayout: "bsm.overview-layout.v1",
  serverSort: "bsm.fleet-sort.v4",
};
