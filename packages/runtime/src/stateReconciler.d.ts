import type { Logger, SessionRuntime, StateReconciler } from "./contracts.js";
export type {
  StateTicket,
  StateReconciler,
  StateRecord,
  ReconcileOptions,
  ReconcileResult,
  TaskSnapshot,
  EpochChange,
} from "./contracts.js";
export interface StateModule {
  validTaskSnapshot(data: unknown): boolean;
  terminalTaskStatus(status: unknown): boolean;
  createStateReconciler(): StateReconciler;
  stateReconciler: StateReconciler;
}
export function createStateReconcilerModule(dependencies: {
  logger: Logger;
  sessionRuntime: SessionRuntime;
  getBackendIdentity(): string;
}): StateModule;
