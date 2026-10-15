import { QueryClient } from "@tanstack/react-query";
import {
  createApplicationRuntime,
  type RuntimePlatform,
} from "@bedrock-server-manager/runtime";

// The neutral package contract must accept the frontend's actual cache and a
// standard browser WebSocket without importing either implementation itself.
const platform: RuntimePlatform = {
  isOnline: () => navigator.onLine,
  isVisible: () => document.visibilityState === "visible",
  getToken: () => null,
  createWebSocket: (url) => new WebSocket(url),
  connected() {},
  addEventListener() {},
  removeEventListener() {},
};
createApplicationRuntime({
  queryClient: new QueryClient(),
  platform,
  getBackendIdentity: () => "http://localhost:11325",
  resolveWebSocketUrl: () => "ws://localhost:11325/ws",
  callOperation: async () => [],
});
