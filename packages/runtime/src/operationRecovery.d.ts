import type {
  ApplicationStateModule,
  CallOperation,
  QueryClient,
  OperationCoordinator,
  StateReconciler,
  SessionRuntime,
  RuntimePlatform,
  RuntimeScheduler,
  RecoveryModule,
} from "./contracts.js";
import type { queryKeys } from "./queryKeys.js";
export function createOperationRecoveryModule(
  dependencies: Pick<
    ApplicationStateModule,
    | "captureStateRequest"
    | "reconcileResourceSnapshot"
    | "reconcileTaskResponse"
  > & {
    callOperation: CallOperation;
    queryClient: QueryClient;
    queryKeys: typeof queryKeys;
    operationCoordinator: OperationCoordinator;
    stateReconciler: StateReconciler;
    sessionRuntime: SessionRuntime;
    platform: Pick<
      RuntimePlatform,
      "isOnline" | "addEventListener" | "removeEventListener"
    >;
    scheduler?: RuntimeScheduler;
  },
): RecoveryModule;
