import type {
  ApplicationStateModule,
  MetricsModule,
  StateReconciler,
  OperationCoordinator,
  QueryClient,
} from "./contracts.js";
import type { queryKeys, resourceInvalidation } from "./queryKeys.js";
import type { mutationResources, lifecycleEvents } from "./coreEvents.js";
export type { ApplicationStateModule, SocketMessage } from "./contracts.js";
export function createApplicationStateModule(
  dependencies: Pick<
    MetricsModule,
    "reconcileMetricsSnapshot" | "reconcileMetricsEvent"
  > & {
    diagnostics?: import("./index.js").RuntimeDiagnostics;
    mutationResources: typeof mutationResources;
    lifecycleEvents: typeof lifecycleEvents;
    refreshResources?: (
      keys: import("./contracts.js").QueryKey[],
      afterCancel?: () => void,
    ) => Promise<unknown>;
    queryClient: QueryClient;
    queryKeys: typeof queryKeys;
    stateReconciler: StateReconciler;
    validTaskSnapshot(data: unknown): boolean;
    operationCoordinator: OperationCoordinator;
    resourceInvalidation: typeof resourceInvalidation;
  },
): ApplicationStateModule;
