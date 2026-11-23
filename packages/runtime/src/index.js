import { createRuntimeDiagnostics } from "./runtimeDiagnostics.js";
import { createSessionRuntimeModule } from "./sessionRuntime.js";
import { createStateReconcilerModule } from "./stateReconciler.js";
import { createOperationCoordinatorModule } from "./operationCoordinator.js";
import { createApplicationMetricsModule } from "./applicationMetrics.js";
import { createApplicationStateModule } from "./applicationState.js";
import { createOperationRecoveryModule } from "./operationRecovery.js";
import { createWebSocketManagerModule } from "./webSocketManager.js";
import { createResourceRefresh } from "./resourceRefresh.js";
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
  const diagnostics = createRuntimeDiagnostics();
  const session = createSessionRuntimeModule();
  session.sessionRuntime.onReset(() => {
    diagnostics.setEnabled(false);
    diagnostics.clear();
    diagnostics.subscriptions(0, 0);
  });
  const state = createStateReconcilerModule({
    ...session,
    diagnostics,
    logger,
    getBackendIdentity,
  });
  const refresh = createResourceRefresh({
    ...state,
    queryClient,
    resourceInvalidation,
    diagnostics,
    scheduler,
    logger,
  });
  const operations = createOperationCoordinatorModule({
    diagnostics,
    ...state,
    ...refresh,
    queryClient,
    queryKeys,
    resourceInvalidation,
  });
  const metrics = createApplicationMetricsModule(state);
  const application = createApplicationStateModule({
    diagnostics,
    ...state,
    ...operations,
    ...metrics,
    ...refresh,
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
    diagnostics,
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
    let stopRecovery = () => {};
    const ownership = (leader) => {
      stopRecovery();
      stopRecovery =
        leader && identity !== null
          ? recovery.startOperationRecovery(identity, generation)
          : () => {};
    };
    const stopOwnership = manager.subscribeOwnership
      ? manager.subscribeOwnership(ownership)
      : (ownership(true), () => {});
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      stopOwnership();
      stopSocket();
      stopRecovery();
    };
    stopActive = stop;
    return { manager, stop };
  };
  return {
    reset,
    diagnostics,
    start,
    ...refresh,
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
