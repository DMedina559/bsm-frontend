import React, { createContext, useContext, useEffect, useState } from "react";
import { request, get } from "./api";
import { logger } from "./utils/logger";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const checkUser = async () => {
    // Always check setup status first if not logged in or to ensure correctness
    try {
      logger.debug("[Auth] Checking setup status");
      const setupData = await get("/api/setup/status");
      setNeedsSetup(setupData.needs_setup);
      if (setupData.needs_setup) {
        logger.info("[Auth] System needs setup", { setupData });
        setLoading(false);
        return; // Stop if setup is needed
      }
    } catch (e) {
      logger.warn("[Auth] Failed to check setup status", { error: e });
    }

    try {
      logger.debug("[Auth] Checking user status");
      // Check if we have a token in either storage (api.js handles retrieval)
      const userData = await request("/api/account", { method: "GET" });
      logger.debug(`[Auth] User authenticated: ${userData?.username}`, {
        userData,
      });

      // If we authenticated successfully (likely via cookie in a new tab)
      // but have no token in storage, grab a fresh token via reauth.
      const hasToken =
        sessionStorage.getItem("access_token") ||
        localStorage.getItem("access_token");

      if (!hasToken) {
        logger.debug(
          "[Auth] Authenticated via cookie but no token in storage. Fetching new token.",
        );
        try {
          const reauthData = await request("/auth/reauth", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ remember_me: "false" }),
          });
          if (reauthData.access_token) {
            sessionStorage.setItem("access_token", reauthData.access_token);
          }
        } catch (reauthError) {
          logger.warn("[Auth] Failed to reauth token", { error: reauthError });
        }
      }

      setUser(userData);
    } catch (error) {
      logger.error("[Auth] Failed to check user status", { error });
      if (error.status === 401) {
        logger.info("[Auth] Unauthorized", { error });
        setUser(null);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  const login = async (username, password, rememberMe = false) => {
    logger.debug(`[Auth] Attempting login`, { username, rememberMe });
    const formData = new URLSearchParams();
    formData.append("grant_type", "password");
    formData.append("username", username);
    formData.append("password", password);
    formData.append("remember_me", rememberMe);

    const data = await request("/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (data.access_token) {
      logger.info(`[Auth] Login successful`, { username });
      if (rememberMe) {
        sessionStorage.removeItem("access_token");
        localStorage.setItem("access_token", data.access_token);
      } else {
        localStorage.removeItem("access_token");
        sessionStorage.setItem("access_token", data.access_token);
      }
    } else {
      logger.warn(`[Auth] Login failed or token missing`, { username, data });
    }

    await checkUser();
    return data;
  };

  const logout = async () => {
    try {
      logger.info("[Auth] Logging out user", { username: user?.username });
      await request("/auth/logout");
    } catch (e) {
      logger.warn("[Auth] Logout failed on server", { error: e });
    }
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, loading, checkUser, needsSetup }}
    >
      {children}
    </AuthContext.Provider>
  );
};
