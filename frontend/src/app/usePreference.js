import { getApiBaseUrl } from "./connection";
import { preferenceStore } from "./preferenceStore";
import { legacyPreferenceKeys as legacy } from "./preferenceDefinitions";
import {
  getPreferenceIdentity,
  migrateAccountPreference,
} from "./backendIdentity";
import { normalizeAppearance } from "../utils/theme";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
export function usePreference(name, fallback) {
  const { user } = useAuth();
  const identity = getPreferenceIdentity(user);
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
    migrateAccountPreference(preferenceStore, user, name);
    if (identity !== null && legacy[name]) {
      try {
        const old = getApiBaseUrl() ? null : localStorage.getItem(legacy[name]);
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
      if (!preferenceStore.validate(name, value)) return false;
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
