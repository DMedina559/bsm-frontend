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
        logger.info("[Auth] System needs setup");
        setLoading(false);
        return; // Stop if setup is needed
      }
    } catch (e) {
      logger.warn("[Auth] Failed to check setup status", e);
    }

    try {
      logger.debug("[Auth] Checking user status");
      // Check if we have a token in either storage (api.js handles retrieval)
      const userData = await request("/api/account", { method: "GET" });
      logger.debug(`[Auth] User authenticated: ${userData?.username}`);
      setUser(userData);
    } catch (error) {
      logger.error("[Auth] Failed to check user status", error);
      if (error.status === 401) {
        logger.info("[Auth] Unauthorized, clearing tokens");
        // Clear both storages on auth failure to be safe
        localStorage.removeItem("jwt_token");
        sessionStorage.removeItem("jwt_token");
        setUser(null);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();

    // Listen for storage events (logout in another tab/legacy frontend)
    const handleStorageChange = (e) => {
      if (e.key === "jwt_token" && e.newValue === null) {
        setUser(null); // Logout detected
      } else if (e.key === "jwt_token" && e.newValue) {
        checkUser(); // Login detected
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const login = async (username, password, rememberMe = false) => {
    logger.debug(`[Auth] Attempting login for user: ${username}`);
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const data = await request("/auth/token", {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (data.access_token) {
      logger.info(`[Auth] Login successful for user: ${username}`);
      if (rememberMe) {
        localStorage.setItem("jwt_token", data.access_token);
        sessionStorage.removeItem("jwt_token"); // Clean up other storage
      } else {
        sessionStorage.setItem("jwt_token", data.access_token);
        localStorage.removeItem("jwt_token"); // Clean up other storage
      }
    } else {
      logger.warn(`[Auth] Login failed or token missing for user: ${username}`);
    }

    await checkUser();
    return data;
  };

  const logout = async () => {
    try {
      logger.info("[Auth] Logging out user");
      await request("/auth/logout");
    } catch (e) {
      logger.warn("[Auth] Logout failed on server", e);
    }
    localStorage.removeItem("jwt_token");
    sessionStorage.removeItem("jwt_token");
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
