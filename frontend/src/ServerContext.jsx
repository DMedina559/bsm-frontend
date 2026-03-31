import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { request } from "./api";
import { useAuth } from "./AuthContext";
import { useWebSocket } from "./WebSocketContext";
import { logger } from "./utils/logger";

const ServerContext = createContext();

export const useServer = () => useContext(ServerContext);

export const ServerProvider = ({ children }) => {
  const { user } = useAuth();
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServerState] = useState(
    localStorage.getItem("selectedServer") || null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { isConnected, isFallback, lastMessage, subscribe, unsubscribe } =
    useWebSocket();

  // Wrapper for setting selected server to also persist to localStorage
  const setSelectedServer = useCallback((serverName) => {
    logger.debug(`[ServerContext] Setting selected server: ${serverName}`);
    setSelectedServerState(serverName);
    if (serverName) {
      localStorage.setItem("selectedServer", serverName);
    } else {
      localStorage.removeItem("selectedServer");
    }
  }, []);

  const fetchServers = useCallback(
    async (isBackground = false) => {
      if (!user) {
        setLoading(false);
        return;
      }

      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      try {
        logger.debug(
          `[ServerContext] Fetching servers list (background: ${isBackground})`,
        );
        // Use the API client we just created
        const data = await request("/api/servers", { method: "GET" });

        if (data && data.status === "success" && Array.isArray(data.servers)) {
          logger.info(`[ServerContext] Loaded ${data.servers.length} servers`);
          setServers(data.servers);

          const serverList = data.servers;
          if (serverList.length > 0) {
            // Check if currently selected server still exists
            const currentSelectionExists = serverList.some(
              (s) => s.name === selectedServer,
            );

            if (!selectedServer || !currentSelectionExists) {
              logger.debug(
                `[ServerContext] Auto-selecting first server: ${serverList[0].name}`,
              );
              // Default to the first server if selection is invalid or missing
              setSelectedServer(serverList[0].name);
            }
          } else {
            logger.debug("[ServerContext] No servers available to select");
            // No servers available
            setSelectedServer(null);
          }
          return true;
        } else {
          setServers([]);
          logger.error("[ServerContext] Invalid server data received", data);
          // If data.servers is missing, something is wrong.
          setError("Invalid server data received.");
          return false;
        }
      } catch (err) {
        logger.error("[ServerContext] Error fetching servers:", err);
        setError(err.message || "Failed to fetch servers");
        return false;
      } finally {
        if (!isBackground) {
          setLoading(false);
        }
      }
    },
    [user, selectedServer, setSelectedServer],
  );

  useEffect(() => {
    if (user) {
      fetchServers();
    } else {
      // Clear sensitive state on logout
      setServers([]);
      setSelectedServer(null);
    }
  }, [user, fetchServers, setSelectedServer]);

  // Handle WebSocket subscriptions for server updates
  useEffect(() => {
    if (isConnected && user) {
      const refreshTopics = [
        "event:after_server_statuses_updated",
        "event:after_server_start",
        "event:after_server_stop",
        "event:after_delete_server_data",
        "event:after_server_updated",
        "event:server_install_complete",
      ];

      refreshTopics.forEach((topic) => subscribe(topic));

      return () => {
        refreshTopics.forEach((topic) => unsubscribe(topic));
      };
    }
  }, [isConnected, user, subscribe, unsubscribe]);

  // Handle polling when in fallback mode
  useEffect(() => {
    let intervalId = null;
    if (isFallback && user) {
      logger.info(
        "[ServerContext] WebSocket fallback active: polling servers every 60s",
      );
      // Initial poll
      fetchServers(true);
      intervalId = setInterval(() => {
        fetchServers(true);
      }, 60000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isFallback, user, fetchServers]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      const refreshTopics = [
        "event:after_server_statuses_updated",
        "event:after_server_start",
        "event:after_server_stop",
        "event:after_delete_server_data",
        "event:after_server_updated",
        "event:server_install_complete",
      ];

      if (refreshTopics.includes(lastMessage.topic)) {
        logger.info(
          `[ServerContext] Refreshing servers due to WS event: ${lastMessage.topic}`,
        );
        fetchServers(true); // Treat WS updates as background updates to avoid flicker
      }
    }
  }, [lastMessage, fetchServers]);

  const refreshServers = () => {
    logger.debug("[ServerContext] Manually refreshing servers list");
    return fetchServers();
  };

  return (
    <ServerContext.Provider
      value={{
        servers,
        selectedServer,
        setSelectedServer,
        loading,
        error,
        refreshServers,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
};
