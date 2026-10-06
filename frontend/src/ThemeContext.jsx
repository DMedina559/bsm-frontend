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

const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const { user, checkUser } = useAuth();
  const [savedTheme, setSavedTheme] = useState(null);
  const theme =
    savedTheme && savedTheme.username === user?.username
      ? savedTheme.theme
      : user?.theme || "default";
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
