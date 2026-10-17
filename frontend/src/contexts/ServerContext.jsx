import { cacheFleet, readOfflineFleet } from "../app/offlineFleet";
import { stateReconciler } from "../app/stateReconciler";
import { callOperation } from "../api/operations";
import {
  getPreferenceIdentity,
  migrateAccountPreference,
} from "../app/backendIdentity";
import {
  captureStateRequest,
  reconcileServerSnapshot,
} from "../app/applicationState";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "./AuthContext";
import { queryKeys } from "../app/queryKeys";
import { preferenceStore as preferences } from "../app/preferenceStore";
import { logger } from "../utils/logger";
import { draftRegistry } from "../app/draftRegistry";
import { useDialog } from "./DialogContext";

const ServerContext = createContext(null);
export const useServer = () => useContext(ServerContext);

async function loadServers({ signal }) {
  const data = await callOperation("list_servers", {
    signal,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
  if (data?.status !== "success" || !Array.isArray(data.servers)) {
    throw new Error("Invalid server data received.");
  }
  return data;
}

/**
 * Query cache owns fleet data; this provider exposes server selection and
 * the shared fleet snapshot through useServer().
 */
export const ServerProvider = ({ children }) => {
  const { user, sessionGeneration } = useAuth();
  const identity = getPreferenceIdentity(user);
  const { confirmAction } = useDialog() ?? {};

  const [selectedServer, setSelectedServerState] = useState(null);
  const selectedServerRef = useRef(selectedServer);
  const [selectionIdentity, setSelectionIdentity] = useState(null);
  const selectionRequest = useRef(0);
  const activeIdentity = useRef(identity);
  useLayoutEffect(() => {
    activeIdentity.current = identity;
    return () => {
      activeIdentity.current = null;
    };
  }, [identity]);
  const setSelectedServer = useCallback(
    async (name, { persist = true } = {}) => {
      const request = ++selectionRequest.current;
      if (selectedServerRef.current === name) return true;
      if (
        draftRegistry.dirty() &&
        (!confirmAction ||
          !(await confirmAction("Discard unsaved changes and switch servers?")))
      )
        return false;
      if (
        request !== selectionRequest.current ||
        activeIdentity.current !== identity
      )
        return false;
      selectedServerRef.current = name;
      setSelectedServerState(name);
      if (persist) {
        if (name) preferences.write(identity, "selectedServer", name);
        else preferences.remove(identity, "selectedServer");
      }
      return true;
    },
    [identity, confirmAction],
  );

  useEffect(() => {
    const restore = (initial = false) => {
      migrateAccountPreference(preferences, user, "selectedServer");
      const saved = preferences.read(
        identity,
        "selectedServer",
        null,
        (value) => typeof value === "string" && value.length > 0,
      );
      if (initial) {
        selectionRequest.current++;
        selectedServerRef.current = saved;
        setSelectedServerState(saved);
        setSelectionIdentity(identity);
      } else void setSelectedServer(saved, { persist: false });
    };
    restore(true);
    return preferences.subscribe(identity, "selectedServer", () => restore());
    // Identity captures the account and backend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);
  const serverQuery = useQuery({
    queryKey: [
      ...queryKeys.servers(),
      { identity, generation: sessionGeneration ?? 0 },
    ],
    networkMode: "always",
    queryFn: async ({ signal }) => {
      const ticket = captureStateRequest(signal);
      try {
        if (navigator.onLine === false) throw new TypeError("Browser offline");
        const data = await loadServers({ signal });
        const accepted = reconcileServerSnapshot(data, ticket);
        void cacheFleet(identity, accepted);
        return accepted;
      } catch (error) {
        if (!stateReconciler.current(ticket))
          throw new DOMException("Session changed", "AbortError");
        if (error instanceof TypeError || error?.category === "network") {
          const cached = await readOfflineFleet(identity);
          if (stateReconciler.current(ticket) && cached) return cached;
        }
        throw error;
      }
    },
    enabled: identity !== null,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const servers = useMemo(
    () => serverQuery.data?.servers ?? [],
    [serverQuery.data],
  );
  useEffect(() => {
    if (identity === null) {
      setSelectedServer(null);
      return;
    }
    if (selectionIdentity !== identity || !serverQuery.isSuccess) return;
    if (!servers.some((server) => server.name === selectedServerRef.current)) {
      setSelectedServer(servers[0]?.name ?? null);
    }
  }, [
    identity,
    selectionIdentity,
    serverQuery.isSuccess,
    servers,
    setSelectedServer,
  ]);

  const { refetch } = serverQuery;
  const refreshServers = useCallback(async () => {
    logger.debug("[ServerContext] Refreshing servers");
    const result = await refetch();
    return result.isSuccess && !result.data?.offline;
  }, [refetch]);

  const currentSelection =
    selectionIdentity === identity ? selectedServer : null;
  const value = useMemo(
    () => ({
      servers,
      offlineSnapshot: serverQuery.data?.offline ?? null,
      selectedServer: currentSelection,
      setSelectedServer,
      loading: identity !== null && serverQuery.isPending,
      error: serverQuery.error?.message ?? null,
      refreshServers,
    }),
    [
      servers,
      currentSelection,
      setSelectedServer,
      identity,
      serverQuery.isPending,
      serverQuery.error,
      serverQuery.data?.offline,
      refreshServers,
    ],
  );

  return (
    <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
  );
};
