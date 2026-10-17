import type {
  QueryClient,
  QueryKey,
  CallOperation,
  RuntimePlatform,
  RuntimeScheduler,
  Logger,
  ApplicationStateModule,
  MetricsModule,
  RecoveryModule,
  WebSocketModule,
} from "./contracts.js";
import type { SessionModule } from "./sessionRuntime.js";
import type { StateModule } from "./stateReconciler.js";
import type { OperationModule } from "./operationCoordinator.js";
import type { DraftModule } from "./draftRegistry.js";
import type { queryKeys } from "./queryKeys.js";
export type * from "./contracts.js";
export interface RuntimeOptions {
  queryClient: QueryClient;
  getBackendIdentity(): string;
  callOperation: CallOperation;
  resolveWebSocketUrl(): string;
  platform: RuntimePlatform;
  scheduler?: RuntimeScheduler;
  logger?: Logger;
}
export interface RuntimeDiagnosticEvent {
  at: number;
  type: string;
  reason?: string;
  family?: string;
  count?: number;
}
export interface RuntimeDiagnostics {
  getSnapshot(): {
    enabled: boolean;
    events: RuntimeDiagnosticEvent[];
    subscriptions: number;
    references: number;
  };
  subscribe(listener: () => void): () => void;
  setEnabled(enabled: boolean): void;
  record(
    type: string,
    details?: { reason?: string; family?: string; count?: number },
  ): void;
  subscriptions(count: number, references: number): void;
  clear(): void;
}
export type ApplicationRuntime = {
  diagnostics: RuntimeDiagnostics;
  refreshResources(
    keys: QueryKey[],
    afterCancel?: () => void,
  ): Promise<unknown[]>;
  reset(): number;
  dispose(): number;
  start(options: {
    identity: string | null;
    generation?: number;
    manager?: import("./contracts.js").WebSocketManager;
    onMessage?: (
      message: import("./contracts.js").SocketMessage,
      ticket: import("./contracts.js").StateTicket,
    ) => void;
    onState?: (state: import("./contracts.js").ConnectionState) => void;
  }): { manager: import("./contracts.js").WebSocketManager; stop(): void };
} & SessionModule &
  StateModule &
  OperationModule &
  ApplicationStateModule &
  MetricsModule &
  RecoveryModule &
  WebSocketModule &
  DraftModule & { queryKeys: typeof queryKeys };
/** Each call creates an isolated runtime; its cache remains owned by the host. */
export function createApplicationRuntime(
  options: RuntimeOptions,
): ApplicationRuntime;
