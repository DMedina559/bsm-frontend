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
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [lastMessage, setLastMessage] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const pendingSubscriptions = useRef(new Set());
  const connectRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const isConnecting = useRef(false);
  const MAX_RECONNECT_ATTEMPTS = 50;

  // Registry for raw message callbacks to bypass React state batching
  const messageListeners = useRef(new Set());

  const addMessageListener = useCallback((callback) => {
    messageListeners.current.add(callback);
    return () => messageListeners.current.delete(callback);
  }, []);

  const connect = useCallback(async () => {
    // If not authenticated, don't attempt to connect
    if (!user) {
      return;
    }

    // If already connected, or explicitly connecting, don't reconnect
    if (
      ws.current &&
      (ws.current.readyState === WebSocket.OPEN ||
        ws.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (isConnecting.current) {
      return;
    }

    if (typeof window === "undefined") return;

    // Check if we should fallback
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn(
        "[WebSocket] Max reconnect attempts reached. Switching to polling fallback.",
        { maxAttempts: MAX_RECONNECT_ATTEMPTS },
      );
      // Yield to avoid synchronous state update in effect
      setTimeout(() => {
        setIsFallback(true);
        setIsConnected(false);
      }, 0);
      return;
    }

    isConnecting.current = true;

    // Determine WebSocket URL based on API base URL or window location
    const baseUrl = getApiBaseUrl();
    let wsUrl;
    if (baseUrl) {
      // Replace http/https with ws/wss
      wsUrl = baseUrl.replace(/^http(s?):/, "ws$1:") + "/ws";
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const appBase = getApiProxyBasePath();
      wsUrl = `${protocol}//${host}${appBase}/ws`;
    }

    // Retrieve access token if available
    const token =
      sessionStorage.getItem("access_token") ||
      localStorage.getItem("access_token");

    logger.debug(`[WebSocket] Connecting`, { url: wsUrl });

    try {
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        logger.debug("[WebSocket] Connected", { url: wsUrl });

        // Send authentication message
        socket.send(
          JSON.stringify({ action: "authenticate", token: token || "" }),
        );

        setIsConnected(true);
        setIsFallback(false);
        reconnectAttempts.current = 0; // Reset attempts on success
        isConnecting.current = false;

        if (pendingSubscriptions.current.size > 0) {
          logger.debug(`[WebSocket] Flushing pending subscriptions`, {
            count: pendingSubscriptions.current.size,
            subscriptions: Array.from(pendingSubscriptions.current),
          });
          pendingSubscriptions.current.forEach((topic) => {
            socket.send(JSON.stringify({ action: "subscribe", topic }));
          });
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.status === "success" &&
            data.message === "Authenticated successfully"
          ) {
            logger.debug("[WebSocket] Authentication successful");
            return; // Don't expose this internal message to the app
          }
          logger.debug(`[WebSocket] Message received`, {
            topic: data.topic,
            data,
          });

          messageListeners.current.forEach((listener) => {
            try {
              listener(data);
            } catch (err) {
              logger.error("[WebSocket Error] Error in message listener", err);
            }
          });

          // Still keep React state for generic UI rendering, even if it batches
          setLastMessage(data);
        } catch (e) {
          logger.error("[WebSocket] Error: Failed to parse message", {
            error: e,
            rawData: event.data,
          });
        }
      };

      socket.onclose = (event) => {
        logger.debug(`[WebSocket] Disconnected`, {
          code: event.code,
          reason: event.reason,
        });
        setIsConnected(false);
        ws.current = null;
        isConnecting.current = false;

        // If closed because of auth error (1008), we might retry with refresh
        if (event.code === 1008) {
          logger.error("[WebSocket] Authentication failed", {
            code: event.code,
          });
        }

        reconnectAttempts.current += 1;

        if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s... capped at 30s
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts.current - 1),
          30000,
        );
        logger.debug(`[WebSocket] Reconnecting`, {
          delayMs: delay,
          attempts: reconnectAttempts.current,
        });

        // Use the ref to call the function recursively
        if (connectRef.current) {
          reconnectTimeout.current = setTimeout(connectRef.current, delay);
        }
      };

      socket.onerror = (error) => {
        logger.error("[WebSocket] Error", { error });
        // onError usually followed by onClose, so we handle reconnect there
        isConnecting.current = false;
      };
    } catch (error) {
      logger.error("[WebSocket] Connection Initialization Failed", {
        error,
        url: wsUrl,
      });
      isConnecting.current = false;
      reconnectAttempts.current += 1;
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttempts.current - 1),
        30000,
      );
      if (connectRef.current) {
        reconnectTimeout.current = setTimeout(connectRef.current, delay);
      }
    }
  }, [user]);

  // Update the ref whenever connect changes
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0; // Reset attempts on manual reconnect
    setIsFallback(false);
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    if (ws.current) {
      ws.current.close(); // This will trigger onclose which triggers reconnect
    } else {
      connect();
    }
  }, [connect]);

  // Handle visibility changes (waking up from background tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        logger.debug("[WebSocket] Tab became visible. Checking connection", {
          readyState: ws.current?.readyState,
        });
        if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
          reconnect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reconnect]);

  useEffect(() => {
    if (user) {
      connect();
    } else {
      // If user logs out, close connection
      if (ws.current) {
        logger.debug("[WebSocket] User logged out, closing connection.");
        // Prevent reconnect loop
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onerror = null;
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
      isConnecting.current = false;
      // Avoid calling setState synchronously
      setTimeout(() => {
        setIsConnected(false);
        setIsFallback(false);
      }, 0);
      reconnectAttempts.current = 0;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    }

    return () => {
      if (ws.current) {
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onerror = null;
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
      isConnecting.current = false;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [connect, user]);

  const sendMessage = useCallback((msg) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      logger.debug(`[WebSocket] Sending message`, { action: msg.action, msg });
      ws.current.send(JSON.stringify(msg));
    } else {
      logger.warn("[WebSocket] Not open, message not sent", {
        msg,
        readyState: ws.current?.readyState,
      });
    }
  }, []);

  const subscribe = useCallback((topic) => {
    logger.debug(`[WebSocket] Subscribing`, { topic });
    pendingSubscriptions.current.add(topic);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: "subscribe", topic }));
    }
  }, []);

  const unsubscribe = useCallback((topic) => {
    logger.debug(`[WebSocket] Unsubscribing`, { topic });
    pendingSubscriptions.current.delete(topic);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: "unsubscribe", topic }));
    }
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
