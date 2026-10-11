import { callOperation } from "../api/operations";
import { useResourceMutation } from "../app/resourceQueries";
import { queryKeys } from "../app/queryKeys";
import { resolveOperationUrl } from "../api/operations";
import { usePreference } from "../app/usePreference";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { resolveApiUrl, getApiBaseUrl } from "../api/transport";
import { getApiProxyBasePath } from "../utils/basePath";
import {
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  resolveMode,
  themeStylesheetUrl,
} from "../utils/theme";

import { validatePalette, paletteCss } from "../utils/palettes";

const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const { user, updateAccount } = useAuth();
  const theme = user?.theme || "default";
  const themeWrite = useResourceMutation(
    async (newTheme, { session, assertCurrent }) => {
      await callOperation("update_account_theme", {
        body: { theme: newTheme },
        session,
      });
      assertCurrent();
      await updateAccount({ theme: newTheme });
    },
    [queryKeys.account()],
  );
  const [paletteState, setPaletteState] = usePreference("palettes", {
    palettes: [],
    active: null,
  });
  const [storedAppearance, setAppearance] = usePreference(
    "appearance",
    DEFAULT_APPEARANCE,
  );
  const appearance = useMemo(
    () => normalizeAppearance(storedAppearance),
    [storedAppearance],
  );
  const [systemReducedMotion, setSystemReducedMotion] = useState(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const reducedMotion =
    appearance.reducedMotion === "reduce" || systemReducedMotion;
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true,
  );
  const [themeError, setThemeError] = useState(null);
  const [themeSaving, setThemeSaving] = useState(false);
  const savingRef = useRef(false);
  const mode = resolveMode(theme, appearance.mode, systemDark);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const change = (event) => setSystemDark(event.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const change = (event) => setSystemReducedMotion(event.matches);
    media?.addEventListener("change", change);
    return () => media?.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.reducedMotion = String(reducedMotion);
    return () => {
      delete root.dataset.reducedMotion;
    };
  }, [reducedMotion]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.mode = mode;
    document.documentElement.dataset.density = appearance.density;
    document.documentElement.style.colorScheme = mode;
  }, [theme, mode, appearance.density]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.panorama = String(appearance.panorama);
    root.dataset.panoramaMotion =
      appearance.panoramaAttachment === "parallax"
        ? "none"
        : appearance.panoramaMotion;
    root.style.setProperty(
      "--bsm-panorama-size",
      appearance.panoramaSize === "custom"
        ? `${appearance.panoramaScale}% auto`
        : appearance.panoramaSize,
    );
    root.style.setProperty(
      "--bsm-panorama-position",
      appearance.panoramaPosition,
    );
    root.style.setProperty("--bsm-panorama-repeat", appearance.panoramaRepeat);
    root.style.setProperty(
      "--bsm-panorama-attachment",
      reducedMotion
        ? "scroll"
        : appearance.panoramaAttachment === "parallax"
          ? "fixed"
          : appearance.panoramaAttachment,
    );
    root.style.setProperty(
      "--bsm-panorama-duration",
      `${appearance.panoramaDuration}s`,
    );
    root.style.setProperty(
      "--bsm-panorama-overlay",
      `${100 - appearance.panoramaVisibility}%`,
    );
    if (appearance.panorama) {
      root.style.setProperty(
        "--bsm-panorama-image",
        `url(${JSON.stringify(resolveApiUrl(resolveOperationUrl("get_panorama")))})`,
      );
    } else root.style.removeProperty("--bsm-panorama-image");
    return () => {
      delete root.dataset.panorama;
      delete root.dataset.panoramaMotion;
      for (const name of [
        "size",
        "position",
        "repeat",
        "attachment",
        "duration",
      ])
        root.style.removeProperty(`--bsm-panorama-${name}`);
      root.style.removeProperty("--bsm-panorama-overlay");
      root.style.removeProperty("--bsm-panorama-image");
    };
  }, [appearance, reducedMotion]);

  useEffect(() => {
    if (
      !appearance.panorama ||
      reducedMotion ||
      appearance.panoramaAttachment !== "parallax"
    )
      return;
    const root = document.documentElement;
    let frame = null;
    let scrollTop = window.scrollY;
    const paint = () => {
      frame = null;
      const positions = {
        center: ["50%", "50%"],
        top: ["50%", "0%"],
        bottom: ["50%", "100%"],
        left: ["0%", "50%"],
        right: ["100%", "50%"],
      };
      const [x, y] = positions[appearance.panoramaPosition];
      const offset = Math.min(
        120,
        (Math.max(0, scrollTop) * appearance.panoramaScrollStrength) / 100,
      );
      root.style.setProperty(
        "--bsm-panorama-position",
        `${x} calc(${y} + ${offset}px)`,
      );
    };
    const scroll = (event) => {
      if (event.target === document || event.target === window)
        scrollTop = window.scrollY;
      else if (
        event.target instanceof Element &&
        event.target.closest(".main-content")
      )
        scrollTop = event.target.scrollTop;
      else return;
      if (frame === null) frame = window.requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", scroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", scroll, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
      root.style.setProperty(
        "--bsm-panorama-position",
        appearance.panoramaPosition,
      );
    };
  }, [appearance, reducedMotion]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--bsm-sidebar-opacity",
      `${100 - appearance.sidebarTransparency}%`,
    );
    return () => root.style.removeProperty("--bsm-sidebar-opacity");
  }, [appearance.sidebarTransparency]);

  useEffect(() => {
    let link = document.getElementById("theme-stylesheet");
    if (!link) {
      link = document.createElement("link");
      link.id = "theme-stylesheet";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    setThemeError(null);
    link.onload = () => setThemeError(null);
    link.onerror = () =>
      setThemeError(
        `The ${theme} stylesheet could not be loaded. Base styling is in use.`,
      );
    link.href = themeStylesheetUrl(
      theme,
      import.meta.env.BASE_URL,
      getApiBaseUrl() || getApiProxyBasePath(),
      __THEME_REVISION__,
    );
    return () => {
      link.onload = null;
      link.onerror = null;
    };
  }, [theme]);

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "personal-palette";
    const active = paletteState.palettes.find(
      (p) => p.name === paletteState.active,
    );
    style.textContent = active ? paletteCss(active) : "";
    document.head.appendChild(style);
    return () => style.remove();
  }, [paletteState, theme]);
  const storePalettes = (next) => {
    if (!setPaletteState(next))
      throw new Error("This browser could not save your palette.");
  };
  const savePalette = (value) => {
    const palette = validatePalette(value);
    const others = paletteState.palettes.filter((p) => p.name !== palette.name);
    if (others.length >= 30)
      throw new Error("Remove a palette before adding another (maximum 30).");
    storePalettes({ palettes: [...others, palette], active: palette.name });
  };
  const selectPalette = (name) =>
    storePalettes({ ...paletteState, active: name });
  const removePalette = (name) =>
    storePalettes({
      palettes: paletteState.palettes.filter((p) => p.name !== name),
      active: paletteState.active === name ? null : paletteState.active,
    });

  const updateAppearance = (patch) => {
    const next = normalizeAppearance({ ...appearance, ...patch });
    if (!setAppearance(next)) {
      setThemeError(
        "Appearance was applied, but this browser could not save it for your next visit.",
      );
    }
  };

  const changeTheme = async (newTheme) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setThemeSaving(true);
    setThemeError(null);
    try {
      await themeWrite.mutateAsync(newTheme);
      selectPalette(null);

      return true;
    } catch (error) {
      setThemeError(error.message || "Theme preference could not be saved.");
      throw error;
    } finally {
      savingRef.current = false;
      setThemeSaving(false);
    }
  };

  const resetAppearance = async () => {
    if (!(await changeTheme("default"))) return false;
    updateAppearance(DEFAULT_APPEARANCE);
    return true;
  };

  return (
    <ThemeContext.Provider
      value={{
        palettes: paletteState.palettes,
        activePalette: paletteState.active,
        savePalette,
        selectPalette,
        removePalette,
        theme,
        changeTheme,
        themeSaving,
        themeError,
        appearance,
        reducedMotion,
        mode,
        updateAppearance,
        resetAppearance,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
