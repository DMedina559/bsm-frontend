import { beforeEach, expect, it } from "vitest";
import { stateReconciler } from "./stateReconciler";
import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";
import {
  reconcileMetricsSnapshot,
  reconcileMetricsEvent,
} from "./applicationMetrics";
import {
  captureStateRequest,
  reconcileSocketMessage,
  reconcileResourceSnapshot,
} from "./applicationState";
const sample = (revision, epoch = "backend") => ({
  epoch,
  revision,
  timestamp: 100 + revision,
  app_cpu_percent: revision,
  asyncio_task_count: 3,
  loop_lag_ms: 0,
  servers: [],
});
beforeEach(() => {
  stateReconciler.clear();
  queryClient.clear();
});
it("rebases delayed HTTP metrics on newer socket samples", () => {
  const key = [
    ...queryKeys.applicationMetrics(),
    { identity: "admin", generation: 0 },
  ];
  queryClient.setQueryData(key, { latest: sample(1), history: [sample(1)] });
  reconcileMetricsSnapshot(
    { latest: sample(1), history: [sample(1)] },
    { source: "http" },
  );
  const ticket = captureStateRequest();
  expect(
    reconcileSocketMessage({
      type: "resource_update",
      topic: "application-metrics",
      data: sample(3),
    }),
  ).toBe(true);
  const data = reconcileResourceSnapshot(
    "applicationMetrics",
    null,
    key,
    { latest: sample(2), history: [sample(1), sample(2)] },
    ticket,
  );
  expect(data.latest.revision).toBe(3);
  expect(data.history.map((item) => item.revision)).toEqual([1, 2, 3]);
  expect(queryClient.getQueryData(key).latest.revision).toBe(3);
  expect(reconcileMetricsEvent(sample(2)).accepted).toBe(false);
});
it("bounds streaming history and resets it on a new backend epoch", () => {
  for (let revision = 1; revision <= 200; revision++)
    reconcileMetricsEvent(sample(revision));
  let value = stateReconciler.read(["application-metrics"]).value;
  expect(value.history).toHaveLength(180);
  expect(value.history[0].revision).toBe(21);
  reconcileMetricsEvent(sample(1, "restart"));
  value = stateReconciler.read(["application-metrics"]).value;
  expect(value.history).toEqual([sample(1, "restart")]);
});
it("rejects malformed metrics without poisoning the revision watermark", () => {
  expect(
    reconcileMetricsEvent({ ...sample(99), app_cpu_percent: "bad" }).accepted,
  ).toBe(false);
  expect(reconcileMetricsEvent(sample(1)).accepted).toBe(true);
  expect(() =>
    reconcileMetricsSnapshot({ latest: sample(2), history: [{}] }),
  ).toThrow("Invalid application metrics response");
});
