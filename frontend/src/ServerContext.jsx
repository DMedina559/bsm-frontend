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
import { request } from "./api";
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
  const data = await request("/api/servers", {
    method: "GET",
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
  const { user } = useAuth();
  const identity = user?.id ?? user?.username ?? null;
  const queryClient = useQueryClient();
  const { isConnected, isFallback, subscribe, unsubscribe, addMessageListener } =
    useWebSocket();
  const [selectedServer, setSelectedServerState] = useState(null);
  const selectedServerRef = useRef(selectedServer);

  useEffect(() => {
    const saved = preferences.read(identity, "selectedServer", null,
      (value) => typeof value === "string" && value.length > 0);
    selectedServerRef.current = saved;
    setSelectedServerState(saved);
  }, [identity]);
  const playerRevision = useRef(0);
  const playerUpdates = useRef(new Map());

  useEffect(() => {
    playerUpdates.current.clear();
    playerRevision.current = 0;
  }, [identity]);

  const serverQuery = useQuery({
    queryKey: [...queryKeys.servers(), identity],
    queryFn: async ({ signal }) => {
      const revisionAtStart = playerRevision.current;
      const data = await loadServers({ signal });
      // A late HTTP response must not overwrite newer player WebSocket data.
      return {
        ...data,
        servers: data.servers.map((server) => {
          const update = playerUpdates.current.get(server.name);
          return update && update.revision > revisionAtStart
            ? { ...server, players: update.players, player_count: update.player_count }
            : server;
        }),
      };
    },
    enabled: identity !== null,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const servers = useMemo(() => serverQuery.data?.servers ?? [], [serverQuery.data]);
  const setSelectedServer = useCallback((name) => {
    selectedServerRef.current = name;
    setSelectedServerState(name);
    if (name) preferences.write(identity, "selectedServer", name);
    else preferences.remove(identity, "selectedServer");
  }, [identity]);

  useEffect(() => {
    if (identity === null) {
      playerUpdates.current.clear();
      playerRevision.current = 0;
      setSelectedServer(null);
      return;
    }
    if (!serverQuery.isSuccess) return;
    if (!servers.some((server) => server.name === selectedServerRef.current)) {
      setSelectedServer(servers[0]?.name ?? null);
    }
  }, [identity, serverQuery.isSuccess, servers, setSelectedServer]);

  // Subscriptions are ref-counted by WebSocketContext; it also resubscribes on reconnect.
  useEffect(() => {
    if (identity === null) return;
    SERVER_TOPICS.forEach(subscribe);
    return () => SERVER_TOPICS.forEach(unsubscribe);
  }, [identity, subscribe, unsubscribe]);

  useEffect(() => {
    if (identity === null) return;
    const removeListener = addMessageListener((message) => {
      if (message?.type !== "event" ||
          message.topic !== "event:after_server_players_change") return;
      const data = message.data?.result ?? message.data;
      if (
        typeof data?.server_name !== "string" ||
        !Array.isArray(data.players) ||
        !Number.isInteger(data.player_count) ||
        data.player_count !== data.players.length ||
        !data.players.every(
          (player) => typeof player?.name === "string" && typeof player?.xuid === "string",
        )
      ) return;
      const update = {
        players: data.players,
        player_count: data.player_count,
        revision: ++playerRevision.current,
      };
      playerUpdates.current.set(data.server_name, update);
      // The central WebSocket dispatcher updates the query cache once.
      // This provider only tracks revisions to protect in-flight HTTP responses.
    });
    return removeListener;
  }, [identity, addMessageListener]);

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

  const refreshServers = useCallback(
    async () => {
      logger.debug("[ServerContext] Refreshing servers");
      const result = await serverQuery.refetch();
      return result.isSuccess;
    },
    [serverQuery],
  );

  const value = useMemo(
    () => ({
      servers,
      selectedServer,
      setSelectedServer,
      loading: identity !== null && serverQuery.isPending,
      error: serverQuery.error?.message ?? null,
      refreshServers,
    }),
    [servers, selectedServer, setSelectedServer, identity, serverQuery.isPending,
      serverQuery.error, refreshServers],
  );

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
};
