import { createSharedSocketManager } from "../app/sharedSocketManager";
import { getBackendIdentity } from "../app/backendIdentity";
import { getPreferenceIdentity } from "../app/backendIdentity";
import { coreEventTopics } from "../app/coreEvents";
import { startResourceRecovery } from "../app/resourceRecovery";
import { application } from "../app/application";
import { callOperation } from "../api/operations";
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
    createSharedSocketManager({
      createManager: createWebSocketManager,
      runtime: application,
      onState: (state) => {
        setIsConnected(state.isConnected);
        setIsFallback(state.isFallback);
        setConnectionState(state.connectionState);
      },
      onMessage: (message, ticket) => {
        if (
          ["access_changed", "policy_changed", "credentials_changed"].includes(
            message.type,
          )
        ) {
          window.dispatchEvent(
            new CustomEvent(
              message.type === "credentials_changed"
                ? "bsm:credentials-changed"
                : "bsm:access-changed",
              { detail: { backend: getBackendIdentity() } },
            ),
          );
          return;
        }
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
    const owner = application.start({
      callOperation,
      identity: resourceIdentity,
      generation: sessionGeneration ?? 0,
      manager,
    });
    return owner.stop;
  }, [resourceIdentity, sessionGeneration, manager]);
  const { subscribe, unsubscribe, sendMessage, reconnect } = manager;
  useEffect(() => {
    if (identity === null) return;
    coreEventTopics.forEach(subscribe);
    return () => coreEventTopics.forEach(unsubscribe);
  }, [identity, subscribe, unsubscribe]);
  useEffect(
    () =>
      startResourceRecovery({
        identity: resourceIdentity,
        generation: sessionGeneration ?? 0,
        connected: isConnected,
        fallback: isFallback,
      }),
    [resourceIdentity, sessionGeneration, isConnected, isFallback],
  );
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
