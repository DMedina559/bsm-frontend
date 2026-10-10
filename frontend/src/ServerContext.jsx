import { callOperation } from "./api/operations";
import {
  getPreferenceIdentity,
  migrateAccountPreference,
} from "./app/backendIdentity";
import {
  captureServerRevision,
  reconcileServerSnapshot,
} from "./app/synchronizeServerEvent";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "./AuthContext";
import { useWebSocket } from "./WebSocketContext";
import { queryKeys } from "./app/queryKeys";
import { createPreferenceStore } from "./app/preferenceStore";
import { logger } from "./utils/logger";

const ServerContext = createContext(null);
const preferences = createPreferenceStore();
export const useServer = () => useContext(ServerContext);

const SERVER_TOPICS = [
  "event:after_server_status_change",
  "event:after_server_start",
  "event:after_server_stop",
  "event:before_server_stop",
  "event:after_delete_server_data",
  "event:after_server_update",
  "event:after_server_install",
  "event:after_server_players_change",
];

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
 * Compatibility provider: query cache owns server data; context exposes the
 * existing useServer() interface until consumers are migrated to query hooks.
 */
export const ServerProvider = ({ children }) => {
  const { user, sessionGeneration } = useAuth();
  const identity = getPreferenceIdentity(user);
  const queryClient = useQueryClient();
  const { isConnected, isFallback, subscribe, unsubscribe } = useWebSocket();
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
      const revisionAtStart = captureServerRevision();
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

  // Subscriptions are ref-counted by WebSocketContext; it also resubscribes on reconnect.
  useEffect(() => {
    if (identity === null) return;
    SERVER_TOPICS.forEach((topic) => subscribe(topic));
    return () => SERVER_TOPICS.forEach((topic) => unsubscribe(topic));
  }, [identity, subscribe, unsubscribe]);

  useEffect(() => {
    if (identity === null || !isConnected) return;
    // Reconcile any events missed while disconnected.
    void queryClient.invalidateQueries({ queryKey: queryKeys.servers() });
  }, [identity, isConnected, queryClient]);

  useEffect(() => {
    if (identity === null || !isFallback) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.servers() });
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [identity, isFallback, queryClient]);

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
