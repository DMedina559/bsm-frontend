import { normalizeAppearance } from "../utils/theme";
import { validatePalette } from "../utils/palettes";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../AuthContext";
import { createPreferenceStore } from "./preferenceStore";
const definitions = {
  appearance: {
    validate: (value) =>
      value &&
      JSON.stringify(normalizeAppearance(value)) === JSON.stringify(value),
  },
  palettes: {
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
    validate: (value) => ["grid", "compact", "list"].includes(value),
  },
  serverSort: {
    validate: (value) =>
      ["name", "status", "version", "players"].includes(value?.key) &&
      ["asc", "desc"].includes(value?.direction),
  },
};
export const preferenceStore = createPreferenceStore(undefined, definitions);
const legacy = {
  appearance: "bsm.appearance.v4",
  palettes: "bsm.palettes.v4",
  overviewLayout: "bsm.overview-layout.v1",
  serverSort: "bsm.fleet-sort.v4",
};
export function usePreference(name, fallback) {
  const { user } = useAuth();
  const identity = user?.id ?? user?.username ?? null;
  const [snapshot, setSnapshot] = useState(() => ({
    identity,
    value: preferenceStore.read(identity, name, fallback),
  }));
  useEffect(() => {
    const read = () =>
      setSnapshot({
        identity,
        value: preferenceStore.read(identity, name, fallback),
      });
    if (identity !== null && legacy[name]) {
      try {
        const old = localStorage.getItem(legacy[name]);
        const missing = Symbol("missing");
        if (
          old !== null &&
          preferenceStore.read(identity, name, missing) === missing
        ) {
          const value =
            name === "overviewLayout"
              ? old
              : name === "appearance"
                ? normalizeAppearance(JSON.parse(old))
                : JSON.parse(old);
          if (preferenceStore.write(identity, name, value))
            localStorage.removeItem(legacy[name]);
        }
      } catch {
        /* Leave the legacy key intact if migration fails. */
      }
    }
    read();
    return preferenceStore.subscribe(identity, name, read);
    // The default is a definition, not a reactive preference value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, name]);
  const write = useCallback(
    (value) => {
      setSnapshot({ identity, value });
      return preferenceStore.write(identity, name, value);
    },
    [identity, name],
  );
  return [
    snapshot.identity === identity
      ? snapshot.value
      : preferenceStore.read(identity, name, fallback),
    write,
  ];
}
