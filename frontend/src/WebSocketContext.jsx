import { startOperationRecovery } from "./app/operationRecovery";
import { synchronizeServerEvent } from "./app/synchronizeServerEvent";
import { operationCoordinator } from "./app/operationCoordinator";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { createWebSocketManager } from "./app/webSocketManager";
import { logger } from "./utils/logger";

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
  const [lastMessage, setLastMessage] = useState(null);
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
      onMessage: (message) => {
        synchronizeServerEvent(message);
        operationCoordinator.reconcileTask(message);
        listeners.forEach((listener) => {
          try {
            listener(message);
          } catch (error) {
            logger.error("[WebSocket] Message listener failed", { error });
          }
        });
        setLastMessage(message);
      },
    }),
  );
  useEffect(() => {
    setLastMessage(null);
    setIsFallback(false);
    return manager.start(identity);
  }, [identity, sessionGeneration, manager]);
  const { subscribe, unsubscribe, sendMessage, reconnect } = manager;
  useEffect(() => {
    if (identity === null) return;
    return startOperationRecovery(identity, sessionGeneration ?? 0);
  }, [identity, sessionGeneration]);
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
  return (
    <WebSocketContext.Provider
      value={{
        connectionState,
        isConnected,
        isFallback,
        lastMessage,
        sendMessage,
        subscribe,
        unsubscribe,
        reconnect,
        addMessageListener,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
