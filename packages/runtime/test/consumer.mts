import {
  createApplicationRuntime,
  type ApplicationRuntime,
  type RuntimePlatform,
  type RuntimeScheduler,
  type QueryClient,
  type StateTicket,
} from "@bedrock-server-manager/runtime";
import { createSessionRuntimeModule } from "@bedrock-server-manager/runtime/sessionRuntime";
import { createStateReconcilerModule } from "@bedrock-server-manager/runtime/stateReconciler";
import { createOperationCoordinatorModule } from "@bedrock-server-manager/runtime/operationCoordinator";
import { createApplicationStateModule } from "@bedrock-server-manager/runtime/applicationState";
import { createApplicationMetricsModule } from "@bedrock-server-manager/runtime/applicationMetrics";
import { createOperationRecoveryModule } from "@bedrock-server-manager/runtime/operationRecovery";
import { createWebSocketManagerModule } from "@bedrock-server-manager/runtime/webSocketManager";
import { createDraftRegistryModule } from "@bedrock-server-manager/runtime/draftRegistry";
import {
  queryKeys,
  resourceInvalidation,
} from "@bedrock-server-manager/runtime/queryKeys";
import {
  mutationResources,
  lifecycleEvents,
} from "@bedrock-server-manager/runtime/coreEvents";
import {
  validateDiagnosticSnapshot,
  validateDiagnosticHistory,
  validateDiagnosticRuns,
  validateDiagnosticTrace,
} from "@bedrock-server-manager/runtime/diagnostics";

declare const queryClient: QueryClient;
declare const platform: RuntimePlatform;
declare const scheduler: RuntimeScheduler<number>;
const logger = { debug() {}, warn() {}, error() {} };
const getBackendIdentity = () => "https://bsm.example";
const callOperation = async () => [];
const resolveWebSocketUrl = () => "wss://bsm.example/ws";
const options = {
  queryClient,
  platform,
  scheduler,
  logger,
  getBackendIdentity,
  callOperation,
  resolveWebSocketUrl,
};
const runtime: ApplicationRuntime = createApplicationRuntime(options);
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
createOperationRecoveryModule({
  ...application,
  ...state,
  ...operations,
  ...session,
  ...options,
  queryKeys,
});
const sockets = createWebSocketManagerModule({
  ...state,
  ...session,
  ...options,
});
const ticket: StateTicket = application.captureStateRequest();
const result = state.stateReconciler.accept(
  ["example"],
  { enabled: true },
  { ticket },
);
if (result.accepted) result.value.enabled satisfies boolean;
runtime.operationCoordinator.register({
  id: "task",
  kind: "backup",
  serverName: "Survival",
});
runtime.operationCoordinator.subscribe((items) => {
  items[0]?.terminal satisfies boolean | undefined;
});
const manager = sockets.createWebSocketManager({
  onMessage(message, connection) {
    application.reconcileSocketMessage(message, connection);
  },
  onState(value) {
    value.isConnected satisfies boolean;
  },
});
const stop = manager.start("account");
stop();
createDraftRegistryModule().draftRegistry.register()();
validateDiagnosticSnapshot({}).summary.status satisfies string;
validateDiagnosticHistory({}).available satisfies boolean;
validateDiagnosticRuns({}).runs[0]?.instance_id satisfies string | undefined;
validateDiagnosticTrace({}).history.available satisfies boolean;
// @ts-expect-error A host must supply the platform boundary.
createApplicationRuntime({
  queryClient,
  getBackendIdentity,
  callOperation,
  resolveWebSocketUrl,
});
// @ts-expect-error Tickets carry cancellation and session identity, not just a clock.
application.reconcileSocketMessage({ type: "event" }, { clock: 1 });
// @ts-expect-error Socket topics are strings.
manager.subscribe(42);
// @ts-expect-error Operation identity is required.
runtime.operationCoordinator.register({ kind: "backup" });
// @ts-expect-error Session reset accepts no account payload.
runtime.sessionRuntime.reset("account");
