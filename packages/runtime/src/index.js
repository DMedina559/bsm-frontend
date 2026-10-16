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
/** @param {import("./index.d.ts").RuntimeOptions} options
 * @returns {import("./index.d.ts").ApplicationRuntime} */
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
  let stopActive = () => {};
  const drafts = createDraftRegistryModule();
  const reset = () => {
    stopActive();
    const generation = session.sessionRuntime.reset();
    operations.operationCoordinator.clear();
    drafts.draftRegistry.clear();
    if (queryClient.clear) queryClient.clear();
    else queryClient.removeQueries({});
    return generation;
  };
  const start = ({
    identity,
    generation = 0,
    onMessage = () => {},
    onState = () => {},
    manager = sockets.createWebSocketManager({ onMessage, onState }),
  }) => {
    stopActive();
    const stopSocket = manager.start(identity);
    const stopRecovery =
      identity === null
        ? () => {}
        : recovery.startOperationRecovery(identity, generation);
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      stopSocket();
      stopRecovery();
    };
    stopActive = stop;
    return { manager, stop };
  };
  return {
    reset,
    start,
    dispose: reset,
    ...session,
    ...state,
    ...operations,
    ...metrics,
    ...application,
    ...recovery,
    ...sockets,
    ...drafts,
    queryKeys,
  };
}
