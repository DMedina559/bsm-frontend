import type {
  OperationCoordinator,
  StateReconciler,
  QueryClient,
} from "./contracts.js";
import type { StateModule } from "./stateReconciler.js";
import type { queryKeys, resourceInvalidation } from "./queryKeys.js";
export type {
  Operation,
  OperationInput,
  OperationCoordinator,
} from "./contracts.js";
export interface OperationModule {
  createOperationCoordinator(
    reconciler?: StateReconciler,
  ): OperationCoordinator;
  operationCoordinator: OperationCoordinator;
}
export function createOperationCoordinatorModule(
  dependencies: Pick<
    StateModule,
    "createStateReconciler" | "stateReconciler" | "terminalTaskStatus"
  > & {
    refreshResources?: (
      keys: import("./contracts.js").QueryKey[],
    ) => Promise<unknown>;
    queryClient: QueryClient;
    queryKeys: typeof queryKeys;
    resourceInvalidation: typeof resourceInvalidation;
  },
): OperationModule;
