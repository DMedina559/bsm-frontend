import { getApiBaseUrl } from "../api";
import { getApiProxyBasePath } from "../utils/basePath";
import { logger } from "../utils/logger";
import { sessionRuntime } from "./sessionRuntime";

export function createWebSocketManager({ onMessage, onState }) {
  let identity = null;
  const ref = (current) => ({ current });
  const socketRef = ref(null),
    authenticatedRef = ref(false),
    generation = ref(0);
  const retryTimer = ref(null),
    authTimer = ref(null),
    reconnectAttempts = ref(0);
  const subscriptions = ref(new Map());
  const connectRef = ref(null);
  let state = {
    isConnected: false,
    isFallback: false,
    connectionState: "disconnected",
  };
  const update = (patch) => {
    state = { ...state, ...patch };
    onState(state);
  };
  const setIsConnected = (isConnected) =>
    update({
      isConnected,
      connectionState: isConnected ? "connected" : "disconnected",
    });
  const setIsFallback = (isFallback) => update({ isFallback });
  const disconnect = () => {
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
  };

  const connect = () => {
    if (identity === null || socketRef.current || navigator.onLine === false)
      return;
    update({
      connectionState: reconnectAttempts.current
        ? "reconnecting"
        : "connecting",
    });
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
        Math.min(
          1000 * 2 ** Math.min(reconnectAttempts.current - 1, 5),
          30000,
        ) *
          (0.8 + Math.random() * 0.4),
      );
    };
    try {
      let rejected = false;
      const socket = new WebSocket(url);
      socketRef.current = socket;
      const current = () =>
        generation.current === currentGeneration &&
        socketRef.current === socket;
      socket.onopen = () => {
        if (!current()) return;
        update({ connectionState: "authenticating" });
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
          if (!authenticatedRef.current) {
            if (message.status === "error") {
              rejected = true;
              update({ connectionState: "failed" });
              socket.close();
            }
            return;
          }
          if (message && typeof message === "object" && !Array.isArray(message))
            onMessage(message);
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
        if (rejected) {
          update({ connectionState: "failed" });
          setIsFallback(true);
        } else retry();
      };
      socket.onerror = () => {
        if (current()) logger.warn("[WebSocket] Connection error");
      };
    } catch (error) {
      socketRef.current = null;
      logger.warn("[WebSocket] Connection could not be opened", { error });
      retry();
    }
  };

  const sendMessage = (message) => {
    if (
      authenticatedRef.current &&
      socketRef.current?.readyState === WebSocket.OPEN
    )
      socketRef.current.send(JSON.stringify(message));
  };
  const subscribe = (topic) => {
    const count = subscriptions.current.get(topic) || 0;
    subscriptions.current.set(topic, count + 1);
    if (count === 0) sendMessage({ action: "subscribe", topic });
  };
  const unsubscribe = (topic) => {
    const count = subscriptions.current.get(topic) || 0;
    if (count <= 1) {
      subscriptions.current.delete(topic);
      if (count) sendMessage({ action: "unsubscribe", topic });
    } else subscriptions.current.set(topic, count - 1);
  };

  connectRef.current = connect;
  const reconnect = () => {
    disconnect();
    reconnectAttempts.current = 0;
    connect();
  };
  const online = () => reconnect();
  const offline = () => {
    disconnect();
    setIsFallback(true);
  };
  const visibility = () => {
    if (document.visibilityState === "visible" && !socketRef.current)
      reconnect();
  };
  return {
    subscribe,
    unsubscribe,
    sendMessage,
    reconnect,
    start(nextIdentity) {
      identity = nextIdentity;
      reconnectAttempts.current = 0;
      const stopReset = sessionRuntime.onReset(() => {
        identity = null;
        disconnect();
      });
      window.addEventListener("online", online);
      window.addEventListener("offline", offline);
      document.addEventListener("visibilitychange", visibility);
      connect();
      return () => {
        identity = null;
        disconnect();
        stopReset();
        window.removeEventListener("online", online);
        window.removeEventListener("offline", offline);
        document.removeEventListener("visibilitychange", visibility);
      };
    },
  };
}
