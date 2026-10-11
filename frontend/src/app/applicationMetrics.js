import { stateReconciler } from "./stateReconciler";

export const metricsFields = [
  "app_cpu_percent",
  "app_ram_mb",
  "thread_count",
  "asyncio_task_count",
  "loop_lag_ms",
  "uptime_seconds",
  "sys_cpu_percent",
  "sys_ram_mb",
  "sys_ram_total_mb",
  "sys_ram_percent",
  "net_tx_kib_s",
  "net_rx_kib_s",
  "disk_read_kib_s",
  "disk_write_kib_s",
];
export function validMetricsSample(sample) {
  return Boolean(
    sample &&
    Number.isFinite(sample.timestamp) &&
    typeof sample.epoch === "string" &&
    sample.epoch.trim() &&
    Number.isSafeInteger(sample.revision) &&
    sample.revision > 0 &&
    metricsFields.every(
      (field) =>
        sample[field] == null ||
        (Number.isFinite(sample[field]) && sample[field] >= 0),
    ) &&
    Number.isInteger(sample.asyncio_task_count) &&
    Number.isFinite(sample.loop_lag_ms) &&
    Array.isArray(sample.servers) &&
    sample.servers.every(
      (server) =>
        typeof server.server_name === "string" &&
        ["pid", "cpu_percent", "memory_mb"].every(
          (field) =>
            server[field] == null ||
            (Number.isFinite(server[field]) && server[field] >= 0),
        ),
    ),
  );
}
export function reconcileMetricsSnapshot(data, options) {
  if (
    !validMetricsSample(data?.latest) ||
    !Array.isArray(data.history) ||
    !data.history.every(
      (sample, index) =>
        validMetricsSample(sample) &&
        sample.epoch === data.latest.epoch &&
        sample.revision <= data.latest.revision &&
        (index === 0 || sample.revision > data.history[index - 1].revision),
    )
  )
    throw new Error("Invalid application metrics response");
  const result = stateReconciler.accept(
    ["application-metrics"],
    { ...data, history: data.history.slice(-180) },
    { ...options, revision: data.latest.revision, epoch: data.latest.epoch },
  );
  // A delayed history read can fill earlier samples without replacing the
  // newest live observation. Epoch and ticket checks still govern acceptance.
  if (
    !result.accepted &&
    options?.source === "http" &&
    result.value &&
    result.value.latest.epoch === data.latest.epoch &&
    stateReconciler.current(options.ticket)
  ) {
    const history = new Map(
      data.history.map((sample) => [sample.revision, sample]),
    );
    for (const sample of result.value.history)
      history.set(sample.revision, sample);
    const merged = [...history.values()]
      .sort((a, b) => a.revision - b.revision)
      .slice(-180);
    const value = { ...result.value, history: merged };
    stateReconciler.read(["application-metrics"]).value = value;
    return { ...result, value };
  }
  return result;
}
export function reconcileMetricsEvent(sample, options) {
  if (!validMetricsSample(sample)) return { accepted: false };
  const previous = stateReconciler.read(["application-metrics"])?.value;
  const history = [
    ...(previous?.history ?? []).filter(
      (item) => item.epoch === sample.epoch && item.revision < sample.revision,
    ),
    sample,
  ].slice(-180);
  return reconcileMetricsSnapshot(
    { latest: sample, history, interval_seconds: 3, history_limit: 180 },
    options,
  );
}
