import {
  createStateReconciler,
  stateReconciler,
  terminalTaskStatus,
} from "./stateReconciler";
import { queryClient } from "./queryClient";
import { queryKeys, resourceInvalidation } from "./queryKeys";
import { createOperationCoordinatorModule } from "@bedrock-server-manager/runtime/operationCoordinator";
export const { createOperationCoordinator, operationCoordinator } =
  createOperationCoordinatorModule({
    createStateReconciler,
    stateReconciler,
    terminalTaskStatus,
    queryClient,
    queryKeys,
    resourceInvalidation,
  });
