import { createSessionRuntimeModule } from "./sessionRuntime.js";
import { createStateReconcilerModule } from "./stateReconciler.js";
import { createOperationCoordinatorModule } from "./operationCoordinator.js";
import { createApplicationMetricsModule } from "./applicationMetrics.js";
import { createApplicationStateModule } from "./applicationState.js";
import { createOperationRecoveryModule } from "./operationRecovery.js";
import { createWebSocketManagerModule } from "./webSocketManager.js";
import { createDraftRegistryModule } from "./draftRegistry.js";
import { queryKeys, resourceInvalidation } from "./queryKeys.js";
import { mutationResources, lifecycleEvents } from "./coreEvents.js";

/** Create isolated BSM state against an application-owned cache and platform. */
export function createApplicationRuntime({
  queryClient,
  getBackendIdentity,
  callOperation,
  resolveWebSocketUrl,
  platform,
  scheduler,
  logger = { debug() {}, warn() {}, error() {} },
}) {
  const session = createSessionRuntimeModule();
  const state = createStateReconcilerModule({
    ...session,
    logger,
    getBackendIdentity,
  });
  const operations = createOperationCoordinatorModule({
    ...state,
    queryClient,
    queryKeys,
    resourceInvalidation,
  });
  const metrics = createApplicationMetricsModule(state);
  const application = createApplicationStateModule({
    ...state,
    ...operations,
    ...metrics,
    queryClient,
    queryKeys,
    resourceInvalidation,
    mutationResources,
    lifecycleEvents,
  });
  const recovery = createOperationRecoveryModule({
    ...session,
    ...state,
    ...operations,
    ...application,
    callOperation,
    queryClient,
    queryKeys,
    platform,
    scheduler,
  });
  const sockets = createWebSocketManagerModule({
    ...session,
    ...state,
    logger,
    resolveWebSocketUrl,
    platform,
    scheduler,
  });
  return {
    ...session,
    ...state,
    ...operations,
    ...metrics,
    ...application,
    ...recovery,
    ...sockets,
    ...createDraftRegistryModule(),
    queryKeys,
  };
}
