import type {
  QueryClient,
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
export type ApplicationRuntime = SessionModule &
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
