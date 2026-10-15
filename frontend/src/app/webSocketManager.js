import { stateReconciler } from "./stateReconciler";
import { resolveWebSocketUrl } from "../api/transport";
import { logger } from "../utils/logger";
import { sessionRuntime } from "./sessionRuntime";
import { browserPlatform as platform } from "./browserPlatform";
import { createWebSocketManagerModule } from "@bedrock-server-manager/runtime/webSocketManager";
export const { createWebSocketManager } = createWebSocketManagerModule({
  stateReconciler,
  resolveWebSocketUrl,
  logger,
  sessionRuntime,
  platform,
});
