import {
  captureStateRequest,
  reconcileResourceSnapshot,
  reconcileTaskResponse,
} from "./applicationState";
import { callOperation } from "../api/operations";
import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";
import { operationCoordinator } from "./operationCoordinator";
import { stateReconciler } from "./stateReconciler";
import { sessionRuntime } from "./sessionRuntime";
import { browserPlatform as platform } from "./browserPlatform";
import { createOperationRecoveryModule } from "@bedrock-server-manager/runtime/operationRecovery";
export const { startOperationRecovery } = createOperationRecoveryModule({
  captureStateRequest,
  reconcileResourceSnapshot,
  reconcileTaskResponse,
  callOperation,
  queryClient,
  queryKeys,
  operationCoordinator,
  stateReconciler,
  sessionRuntime,
  platform,
});
