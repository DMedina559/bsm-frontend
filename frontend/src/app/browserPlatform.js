import { getToken } from "./connection";
export const browserPlatform = {
  isOnline: () => navigator.onLine !== false,
  isVisible: () => document.visibilityState === "visible",
  getToken,
  createWebSocket: (url) => new WebSocket(url),
  connected: () => window.dispatchEvent(new Event("bsm:socket-connected")),
  addEventListener: (type, listener) =>
    (type === "visibilitychange" ? document : window).addEventListener(
      type,
      listener,
    ),
  removeEventListener: (type, listener) =>
    (type === "visibilitychange" ? document : window).removeEventListener(
      type,
      listener,
    ),
};
