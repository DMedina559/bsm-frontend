import { coreEventTopics } from "../app/coreEvents";
import { queryClient } from "../app/queryClient";
import { getPreferenceIdentity } from "../app/backendIdentity";
import { startOperationRecovery } from "../app/operationRecovery";
import { reconcileSocketMessage } from "../app/applicationState";
import { operationCoordinator } from "../app/operationCoordinator";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "./AuthContext";
import { createWebSocketManager } from "../app/webSocketManager";
import { logger } from "../utils/logger";

const WebSocketContext = createContext(null);
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context)
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  return context;
};
export const WebSocketProvider = ({ children }) => {
  const { user, sessionGeneration } = useAuth();
  const identity = user?.id ?? user?.username ?? null;
  const resourceIdentity = getPreferenceIdentity(user);
  const [isConnected, setIsConnected] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [listeners] = useState(() => new Set());
  const [connectionState, setConnectionState] = useState("disconnected");
  const [manager] = useState(() =>
    createWebSocketManager({
      onState: (state) => {
        setIsConnected(state.isConnected);
        setIsFallback(state.isFallback);
        setConnectionState(state.connectionState);
      },
      onMessage: (message, ticket) => {
        if (!reconcileSocketMessage(message, ticket)) return;
        listeners.forEach((listener) => {
          try {
            listener(message);
          } catch (error) {
            logger.error("[WebSocket] Message listener failed", { error });
          }
        });
      },
    }),
  );
  useEffect(() => {
    setIsFallback(false);
    return manager.start(identity);
  }, [identity, sessionGeneration, manager]);
  const { subscribe, unsubscribe, sendMessage, reconnect } = manager;
  useEffect(() => {
    if (resourceIdentity === null) return;
    return startOperationRecovery(resourceIdentity, sessionGeneration ?? 0);
  }, [resourceIdentity, sessionGeneration]);
  useEffect(() => {
    if (identity === null) return;
    coreEventTopics.forEach(subscribe);
    return () => coreEventTopics.forEach(unsubscribe);
  }, [identity, subscribe, unsubscribe]);
  useEffect(() => {
    if (identity !== null && isConnected) void queryClient.invalidateQueries();
  }, [identity, isConnected]);
  useEffect(() => {
    if (identity === null || !isFallback) return;
    const timer = setInterval(() => {
      void queryClient.invalidateQueries({ refetchType: "active" });
    }, 60_000);
    return () => clearInterval(timer);
  }, [identity, isFallback]);
  // Backend task topics replay the latest task snapshot upon subscription.
  // Keep subscriptions tied to registered operations, including after reconnect.
  useEffect(() => {
    if (identity === null) return;
    const subscribed = new Set();
    const syncTasks = (operations) => {
      const desired = new Set(
        operations
          .filter((operation) => operation.kind && !operation.terminal)
          .map((operation) => `task:${operation.id}`),
      );
      desired.forEach((topic) => {
        if (!subscribed.has(topic)) {
          subscribed.add(topic);
          subscribe(topic);
        }
      });
      [...subscribed].forEach((topic) => {
        if (!desired.has(topic)) {
          subscribed.delete(topic);
          unsubscribe(topic);
        }
      });
    };
    const stop = operationCoordinator.subscribe(syncTasks);
    return () => {
      stop();
      subscribed.forEach((topic) => unsubscribe(topic));
    };
  }, [identity, subscribe, unsubscribe]);

  const addMessageListener = useCallback(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    [listeners],
  );
  const value = useMemo(
    () => ({
      connectionState,
      isConnected,
      isFallback,
      sendMessage,
      subscribe,
      unsubscribe,
      reconnect,
      addMessageListener,
    }),
    [
      connectionState,
      isConnected,
      isFallback,
      sendMessage,
      subscribe,
      unsubscribe,
      reconnect,
      addMessageListener,
    ],
  );
  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
