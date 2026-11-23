const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const statuses = new Set(["ok", "degraded", "unavailable", "unknown"]);
export function validateDiagnosticSnapshot(value) {
  if (
    !object(value) ||
    typeof value.instance_id !== "string" ||
    typeof value.snapshot_id !== "string" ||
    !Number.isFinite(value.collected_at) ||
    !object(value.summary) ||
    !statuses.has(value.summary.status) ||
    !(
      typeof value.summary.ready === "boolean" || value.summary.ready === null
    ) ||
    !(
      value.summary.findings == null ||
      (Array.isArray(value.summary.findings) &&
        value.summary.findings.every(
          (finding) =>
            object(finding) &&
            typeof finding.subsystem === "string" &&
            object(finding.issue) &&
            typeof finding.issue.message === "string",
        ))
    ) ||
    !Array.isArray(value.sections) ||
    !value.sections.every(
      (section) =>
        object(section) &&
        typeof section.name === "string" &&
        typeof section.owner === "string" &&
        statuses.has(section.status) &&
        (section.issues == null ||
          (Array.isArray(section.issues) &&
            section.issues.every(
              (issue) => object(issue) && typeof issue.message === "string",
            ))) &&
        (section.data === null || object(section.data)),
    )
  )
    throw new Error("Invalid diagnostic snapshot response");
  return value;
}
export function validateDiagnosticHistory(value) {
  if (
    !object(value) ||
    typeof value.available !== "boolean" ||
    !Array.isArray(value.records) ||
    !value.records.every(
      (record) =>
        object(record) &&
        typeof record.id === "string" &&
        typeof record.operation === "string" &&
        typeof record.subsystem === "string" &&
        Number.isFinite(record.timestamp) &&
        (record.correlation_id == null ||
          typeof record.correlation_id === "string") &&
        ["completed", "failed", "cancelled"].includes(record.outcome),
    ) ||
    !(value.next_cursor == null || typeof value.next_cursor === "string")
  )
    throw new Error("Invalid diagnostic history response");
  return value;
}
export function validateDiagnosticRuns(value) {
  if (
    !object(value) ||
    typeof value.available !== "boolean" ||
    !Array.isArray(value.runs) ||
    !value.runs.every(
      (run) => object(run) && typeof run.instance_id === "string",
    )
  )
    throw new Error("Invalid diagnostic run response");
  return value;
}
export function validateDiagnosticTrace(value) {
  if (
    !object(value) ||
    typeof value.events_available !== "boolean" ||
    typeof value.tasks_available !== "boolean" ||
    !Array.isArray(value.tasks)
  )
    throw new Error("Invalid diagnostic trace response");
  if (
    value.operations != null &&
    !activityRecords(value.operations, "operation_id")
  )
    throw new Error("Invalid diagnostic trace operations");
  validateDiagnosticHistory(value.history);
  return value;
}

const activityRecords = (value, identity) =>
  object(value) &&
  [value.active, value.recent].every(
    (records) =>
      Array.isArray(records) &&
      records.every(
        (record) =>
          object(record) &&
          typeof record[identity] === "string" &&
          typeof record.name === "string" &&
          typeof record.correlation_id === "string" &&
          typeof record.status === "string",
      ),
  );
export function validateDiagnosticActivity(value) {
  if (
    !object(value) ||
    value.scope !== "application" ||
    !(value.events === null || activityRecords(value.events, "event_id")) ||
    !(
      value.operations === null ||
      activityRecords(value.operations, "operation_id")
    ) ||
    !(
      value.subscriptions === null ||
      (object(value.subscriptions) &&
        Number.isInteger(value.subscriptions.total) &&
        value.subscriptions.total >= 0 &&
        Array.isArray(value.subscriptions.items) &&
        value.subscriptions.items.every(
          (item) =>
            object(item) &&
            typeof item.listener_id === "string" &&
            typeof item.owner === "string",
        ))
    ) ||
    !(
      value.issues == null ||
      (Array.isArray(value.issues) &&
        value.issues.every(
          (issue) => object(issue) && typeof issue.message === "string",
        ))
    )
  )
    throw new Error("Invalid diagnostic activity response");
  return value;
}
