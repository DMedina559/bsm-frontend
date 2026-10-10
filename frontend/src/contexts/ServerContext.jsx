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
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "./AuthContext";
import { queryKeys } from "../app/queryKeys";
import { createPreferenceStore } from "../app/preferenceStore";
import { logger } from "../utils/logger";

const ServerContext = createContext(null);
const preferences = createPreferenceStore();
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

  const [selectedServer, setSelectedServerState] = useState(null);
  const selectedServerRef = useRef(selectedServer);
  const [selectionIdentity, setSelectionIdentity] = useState(null);

  useEffect(() => {
    const restore = () => {
      migrateAccountPreference(preferences, user, "selectedServer");
      const saved = preferences.read(
        identity,
        "selectedServer",
        null,
        (value) => typeof value === "string" && value.length > 0,
      );
      selectedServerRef.current = saved;
      setSelectedServerState(saved);
      setSelectionIdentity(identity);
    };
    restore();
    return preferences.subscribe(identity, "selectedServer", restore);
    // Identity captures the account and backend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);
  const serverQuery = useQuery({
    queryKey: [
      ...queryKeys.servers(),
      { identity, generation: sessionGeneration ?? 0 },
    ],
    queryFn: async ({ signal }) => {
      const revisionAtStart = captureStateRequest(signal);
      const data = await loadServers({ signal });
      return reconcileServerSnapshot(data, revisionAtStart);
    },
    enabled: identity !== null,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const servers = useMemo(
    () => serverQuery.data?.servers ?? [],
    [serverQuery.data],
  );
  const setSelectedServer = useCallback(
    (name) => {
      selectedServerRef.current = name;
      setSelectedServerState(name);
      if (name) preferences.write(identity, "selectedServer", name);
      else preferences.remove(identity, "selectedServer");
    },
    [identity],
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
    return result.isSuccess;
  }, [refetch]);

  const value = useMemo(
    () => ({
      servers,
      selectedServer,
      setSelectedServer,
      loading: identity !== null && serverQuery.isPending,
      error: serverQuery.error?.message ?? null,
      refreshServers,
    }),
    [
      servers,
      selectedServer,
      setSelectedServer,
      identity,
      serverQuery.isPending,
      serverQuery.error,
      refreshServers,
    ],
  );

  return (
    <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
  );
};
