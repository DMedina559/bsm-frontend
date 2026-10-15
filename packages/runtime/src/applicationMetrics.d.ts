import type { MetricsModule, StateReconciler } from "./contracts.js";
export type {
  MetricsModule,
  MetricsSample,
  MetricsSnapshot,
} from "./contracts.js";
export function createApplicationMetricsModule(dependencies: {
  stateReconciler: StateReconciler;
}): MetricsModule;
