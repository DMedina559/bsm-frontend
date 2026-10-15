import {
  reconcileMetricsSnapshot,
  reconcileMetricsEvent,
} from "./applicationMetrics";
import { mutationResources, lifecycleEvents } from "./coreEvents";
import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";
import { stateReconciler } from "./stateReconciler";
import { operationCoordinator } from "./operationCoordinator";
import { resourceInvalidation } from "./queryKeys";
import { createApplicationStateModule } from "@bedrock-server-manager/runtime/applicationState";
export const {
  captureStateRequest,
  reconcileMonitorSnapshot,
  reconcileServerSnapshot,
  reconcileResourceSnapshot,
  synchronizeServerEvent,
  reconcileSocketMessage,
  reconcileTaskResponse,
} = createApplicationStateModule({
  reconcileMetricsSnapshot,
  reconcileMetricsEvent,
  mutationResources,
  lifecycleEvents,
  queryClient,
  queryKeys,
  stateReconciler,
  operationCoordinator,
  resourceInvalidation,
});
