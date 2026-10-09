import { synchronizeServerEvent } from "./app/synchronizeServerEvent";
import { operationCoordinator } from "./app/operationCoordinator";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { getApiBaseUrl } from "./api";
import { getApiProxyBasePath } from "./utils/basePath";
import { logger } from "./utils/logger";

const WebSocketContext = createContext(null);
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context)
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  return context;
};
export const WebSocketProvider = ({ children }) => {
  const { user } = useAuth();
  const identity = user?.id ?? user?.username ?? null;
  const [lastMessage, setLastMessage] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const socketRef = useRef(null);
  const authenticatedRef = useRef(false);
  const generation = useRef(0);
  const retryTimer = useRef(null);
  const authTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const subscriptions = useRef(new Map());
  const listeners = useRef(new Set());
  const connectRef = useRef(null);
  const reconnectNowRef = useRef(null);

  const disconnect = useCallback(() => {
    generation.current += 1;
    clearTimeout(retryTimer.current);
    clearTimeout(authTimer.current);
    authenticatedRef.current = false;
    setIsConnected(false);
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
    }
  }, []);

  const connect = useCallback(() => {
    if (identity === null || socketRef.current) return;
    const currentGeneration = generation.current;
    const base = getApiBaseUrl();
    const url = base
      ? base.replace(/^http(s?):/, "ws$1:") + "/ws"
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${getApiProxyBasePath()}/ws`;
    const retry = () => {
      if (generation.current !== currentGeneration) return;
      reconnectAttempts.current += 1;
      // Keep retrying while polling provides status after three failed connections.
      if (reconnectAttempts.current >= 3) setIsFallback(true);
      clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(
        () => connectRef.current?.(),
        Math.min(1000 * 2 ** Math.min(reconnectAttempts.current - 1, 5), 30000),
      );
    };
    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;
      const current = () =>
        generation.current === currentGeneration &&
        socketRef.current === socket;
      socket.onopen = () => {
        if (!current()) return;
        const token =
          sessionStorage.getItem("access_token") ||
          localStorage.getItem("access_token");
        socket.send(
          JSON.stringify({ action: "authenticate", token: token || "" }),
        );
        authTimer.current = setTimeout(() => {
          if (current() && !authenticatedRef.current) socket.close();
        }, 10000);
      };
      socket.onmessage = (event) => {
        if (!current()) return;
        try {
          const message = JSON.parse(event.data);
          if (
            message.status === "success" &&
            message.message === "Authenticated successfully"
          ) {
            clearTimeout(authTimer.current);
            authenticatedRef.current = true;
            reconnectAttempts.current = 0;
            setIsConnected(true);
            setIsFallback(false);
            subscriptions.current.forEach((count, topic) => {
              if (count > 0)
                socket.send(JSON.stringify({ action: "subscribe", topic }));
            });
            return;
          }
          if (!authenticatedRef.current) return;
          synchronizeServerEvent(message);
          operationCoordinator.reconcileTask(message);
          listeners.current.forEach((listener) => {
            try {
              listener(message);
            } catch (error) {
              logger.error("[WebSocket] Message listener failed", { error });
            }
          });
          setLastMessage(message);
        } catch (error) {
          logger.warn("[WebSocket] Invalid message", { error });
        }
      };
      socket.onclose = () => {
        if (!current()) return;
        clearTimeout(authTimer.current);
        socketRef.current = null;
        authenticatedRef.current = false;
        setIsConnected(false);
        retry();
      };
      socket.onerror = () => {
        if (current()) logger.warn("[WebSocket] Connection error");
      };
    } catch (error) {
      socketRef.current = null;
      logger.warn("[WebSocket] Connection could not be opened", { error });
      retry();
    }
  }, [identity]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);
  useEffect(() => {
    setIsConnected(false);
    setIsFallback(false);
    setLastMessage(null);
    reconnectAttempts.current = 0;
    connect();
    return () => {
      disconnect();
      // Keep desired subscriptions: mounted consumers own their lifetimes.
    };
  }, [connect, disconnect]);
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttempts.current = 0;
    setIsConnected(false);
    // Keep the polling fallback until an authenticated connection is established.
    connectRef.current?.();
  }, [disconnect]);
  reconnectNowRef.current = reconnect;
  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState === "visible" && !socketRef.current)
        reconnectNowRef.current?.();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [reconnect]);
  const sendMessage = useCallback((message) => {
    if (
      authenticatedRef.current &&
      socketRef.current?.readyState === WebSocket.OPEN
    )
      socketRef.current.send(JSON.stringify(message));
  }, []);
  const subscribe = useCallback(
    (topic) => {
      const count = subscriptions.current.get(topic) || 0;
      subscriptions.current.set(topic, count + 1);
      if (count === 0) sendMessage({ action: "subscribe", topic });
    },
    [sendMessage],
  );
  const unsubscribe = useCallback(
    (topic) => {
      const count = subscriptions.current.get(topic) || 0;
      if (count <= 1) {
        subscriptions.current.delete(topic);
        if (count) sendMessage({ action: "unsubscribe", topic });
      } else subscriptions.current.set(topic, count - 1);
    },
    [sendMessage],
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

  const addMessageListener = useCallback((listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);
  return (
    <WebSocketContext.Provider
      value={{
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
