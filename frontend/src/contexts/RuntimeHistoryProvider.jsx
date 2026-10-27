import { useEffect, useLayoutEffect } from "react";
import { useAuth } from "./AuthContext";
import { usePreference } from "../app/usePreference";
import { getPreferenceIdentity } from "../app/backendIdentity";
import { runtimeHistory } from "../app/runtimeHistoryStore";
import { application } from "../app/application";
const DEFAULT_RUNTIME_RECORDING = { recording: false, persist: false };
export default function RuntimeHistoryProvider({ children }) {
  const { user } = useAuth();
  const identity = user?.role === "admin" ? getPreferenceIdentity(user) : null;
  const [options] = usePreference(
    "runtimeDiagnostics",
    DEFAULT_RUNTIME_RECORDING,
  );
  useLayoutEffect(() => {
    runtimeHistory.open(identity, options.persist);
    return () => runtimeHistory.close();
    // Scope ownership changes only with account/backend, not recording toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);
  useEffect(() => {
    runtimeHistory.setPersistent(options.persist);
    application.diagnostics.setEnabled(identity !== null && options.recording);
  }, [identity, options.persist, options.recording]);
  useEffect(() => {
    const flush = () => runtimeHistory.flush();
    const prune = setInterval(() => runtimeHistory.prune(), 60000);
    window.addEventListener("pagehide", flush);
    const visibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(prune);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
      flush();
    };
  }, []);
  return children;
}
