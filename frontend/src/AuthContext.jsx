import { sessionRuntime } from "./app/sessionRuntime";
import { queryClient } from "./app/queryClient";
import { operationCoordinator } from "./app/operationCoordinator";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { request, get } from "./api";
import { logger } from "./utils/logger";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const identityRef = useRef(null);
  const checkGeneration = useRef(0);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const resetSession = () => {
    setSessionGeneration(sessionRuntime.reset());
    queryClient.clear();
    operationCoordinator.clear();
  };

  const checkUser = async () => {
    const check = ++checkGeneration.current;
    const current = () => check === checkGeneration.current;
    // Always check setup status first if not logged in or to ensure correctness
    try {
      logger.debug("[Auth] Checking setup status");
      const setupData = await get("/api/setup/status");
      if (!current()) return;
      setNeedsSetup(setupData.needs_setup);
      if (setupData.needs_setup) {
        logger.info("[Auth] System needs setup", { setupData });
        resetSession();
        identityRef.current = null;
        setUser(null);
        setLoading(false);
        return; // Stop if setup is needed
      }
    } catch (e) {
      if (!current()) return;
      logger.warn("[Auth] Failed to check setup status", { error: e });
    }

    try {
      logger.debug("[Auth] Checking user status");
      // Check if we have a token in either storage (api.js handles retrieval)
      const userData = await request("/api/account", { method: "GET" });
      if (!current()) return;
      if (userData?.id == null && !userData?.username)
        throw new Error("Invalid account response");
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
          if (!current()) return;
          if (reauthData.access_token) {
            sessionStorage.setItem("access_token", reauthData.access_token);
            resetSession();
          }
        } catch (reauthError) {
          logger.warn("[Auth] Failed to reauth token", { error: reauthError });
        }
      }

      if (!current()) return;
      // Clear session-owned state before publishing the authenticated identity.
      // Do not perform cache mutations inside a React state updater.
      const nextIdentity = userData?.id ?? userData?.username ?? null;
      if (identityRef.current !== nextIdentity) {
        resetSession();
      }
      identityRef.current = nextIdentity;
      setUser(userData);
    } catch (error) {
      if (!current()) return;
      if (
        identityRef.current !== null &&
        error.status !== 401 &&
        error.status !== 403
      )
        return;
      logger.error("[Auth] Failed to check user status", { error });
      if (error.status === 401) {
        logger.info("[Auth] Unauthorized", { error });
      }
      resetSession();
      identityRef.current = null;
      setUser(null);
    } finally {
      if (current()) setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
    return () => {
      checkGeneration.current += 1;
    };
    // The initial check runs once; subsequent checks are explicitly requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const changed = (event) => {
      if (event.key !== "access_token" && event.key !== "api_base_url") return;
      checkGeneration.current += 1;
      resetSession();
      identityRef.current = null;
      setUser(null);
      void checkUser();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
    // Resource callbacks use refs and the latest generation rather than user state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username, password, rememberMe = false) => {
    checkGeneration.current += 1;
    resetSession();
    identityRef.current = null;
    setUser(null);
    logger.debug(`[Auth] Attempting login`, { username, rememberMe });
    const formData = new URLSearchParams();
    formData.append("grant_type", "password");
    formData.append("username", username);
    formData.append("password", password);
    formData.append("remember_me", rememberMe);

    const attempt = checkGeneration.current;
    const data = await request("/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (attempt !== checkGeneration.current) return data;
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
    checkGeneration.current += 1;
    resetSession();
    identityRef.current = null;
    setUser(null);
    const attempt = checkGeneration.current;
    try {
      logger.info("[Auth] Logging out user", { username: user?.username });
      await request("/auth/logout");
    } catch (e) {
      logger.warn("[Auth] Logout failed on server", { error: e });
    }
    if (attempt !== checkGeneration.current) return;
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
    queryClient.clear();
    operationCoordinator.clear();
    identityRef.current = null;
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        checkUser,
        needsSetup,
        sessionGeneration,
        status: loading
          ? "loading"
          : user
            ? "authenticated"
            : "unauthenticated",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
