import type {
  StateReconciler,
  SessionRuntime,
  Logger,
  RuntimePlatform,
  RuntimeScheduler,
  WebSocketModule,
} from "./contracts.js";
export type {
  RuntimeSocket,
  WebSocketManager,
  ConnectionState,
} from "./contracts.js";
export function createWebSocketManagerModule(dependencies: {
  stateReconciler: StateReconciler;
  resolveWebSocketUrl(): string;
  logger: Logger;
  diagnostics?: import("./index.js").RuntimeDiagnostics;
  sessionRuntime: SessionRuntime;
  platform: RuntimePlatform;
  scheduler?: RuntimeScheduler;
}): WebSocketModule;
