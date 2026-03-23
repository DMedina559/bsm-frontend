import React, { createContext, useContext, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { request, getApiBaseUrl } from "./api";
import { logger } from "./utils/logger";

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const { user, checkUser } = useAuth();

  // Use user's theme or default. Do not use local storage.
  const theme = user?.theme || "default";

  useEffect(() => {
    let link = document.getElementById("theme-stylesheet");

    if (!link) {
      link = document.createElement("link");
      link.id = "theme-stylesheet";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    const standardThemes = [
      "default",
      "light",
      "gradient",
      "black",
      "red",
      "green",
      "blue",
      "yellow",
      "pink",
    ];

    let href;
    if (standardThemes.includes(theme)) {
      // Use Vite's base URL (import.meta.env.BASE_URL) to handle deployment paths
      const baseUrl = import.meta.env.BASE_URL;
      // Ensure no double slash if baseUrl ends with /
      const safeBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
      href = `${safeBase}/assets/css/themes/${theme}.css`;
    } else {
      // Custom themes mounted at /themes
      href = `${getApiBaseUrl()}/themes/${theme}.css`;
    }

    link.href = href;
  }, [theme]);

  const changeTheme = async (newTheme) => {
    try {
      await request("/api/account/theme", {
        method: "POST",
        body: { theme: newTheme },
      });
      // Refresh user data to get the new theme applied
      await checkUser();
    } catch (error) {
      logger.error("Failed to update theme:", error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
