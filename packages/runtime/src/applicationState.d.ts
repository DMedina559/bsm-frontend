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
    mutationResources: typeof mutationResources;
    lifecycleEvents: typeof lifecycleEvents;
    queryClient: QueryClient;
    queryKeys: typeof queryKeys;
    stateReconciler: StateReconciler;
    operationCoordinator: OperationCoordinator;
    resourceInvalidation: typeof resourceInvalidation;
  },
): ApplicationStateModule;
