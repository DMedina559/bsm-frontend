export const browserPlatform = {
  isOnline: () => navigator.onLine !== false,
  isVisible: () => document.visibilityState === "visible",
  getToken: () =>
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("access_token"),
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
