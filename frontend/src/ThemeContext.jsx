import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { request, getApiBaseUrl } from "./api";
import { getApiProxyBasePath } from "./utils/basePath";
import {
  APPEARANCE_KEY,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  readAppearance,
  resolveMode,
  themeStylesheetUrl,
} from "./utils/theme";

import {
  PALETTE_KEY,
  readPaletteState,
  validatePalette,
  paletteCss,
} from "./utils/palettes";

const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const { user, checkUser } = useAuth();
  const [savedTheme, setSavedTheme] = useState(null);
  const theme =
    savedTheme && savedTheme.username === user?.username
      ? savedTheme.theme
      : user?.theme || "default";
  const [paletteState, setPaletteState] = useState(readPaletteState);
  const [appearance, setAppearance] = useState(readAppearance);
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
    const sync = (event) => {
      if (event.key === PALETTE_KEY) setPaletteState(readPaletteState());
      if (event.key === APPEARANCE_KEY) setAppearance(readAppearance());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.mode = mode;
    document.documentElement.dataset.density = appearance.density;
    document.documentElement.style.colorScheme = mode;
  }, [theme, mode, appearance.density]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.panorama = String(appearance.panorama);
    root.style.setProperty(
      "--bsm-panorama-overlay",
      `${100 - appearance.panoramaVisibility}%`,
    );
    if (appearance.panorama) {
      const base = getApiBaseUrl() || getApiProxyBasePath();
      root.style.setProperty(
        "--bsm-panorama-image",
        `url(${JSON.stringify(`${base}/api/panorama`)})`,
      );
    } else root.style.removeProperty("--bsm-panorama-image");
    return () => {
      delete root.dataset.panorama;
      root.style.removeProperty("--bsm-panorama-overlay");
      root.style.removeProperty("--bsm-panorama-image");
    };
  }, [appearance.panorama, appearance.panoramaVisibility]);

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
    try {
      localStorage.setItem(PALETTE_KEY, JSON.stringify(next));
    } catch {
      throw new Error("This browser could not save your palette.");
    }
    setPaletteState(next);
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
    setAppearance(next);
    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
    } catch {
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
      await request("/api/account/theme", {
        method: "POST",
        body: { theme: newTheme },
      });
      selectPalette(null);
      setSavedTheme({ username: user?.username, theme: newTheme });
      await checkUser();
      return true;
    } catch (error) {
      setThemeError(error.message || "Theme preference could not be saved.");
      throw error;
    } finally {
      savingRef.current = false;
      setThemeSaving(false);
    }
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
        mode,
        updateAppearance,
        resetAppearance: () => updateAppearance(DEFAULT_APPEARANCE),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
