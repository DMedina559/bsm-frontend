import BackupContents from "./BackupContents";
import PluginSettingsFields from "../features/plugins/PluginSettingsFields";
import { updateSetting } from "../utils/settings";
import { defaultBackupComponents } from "../utils/backupContents";
import { browserTimezone } from "../utils/time";
import { useTimeFormat } from "../app/useTimeFormat";
import Timestamp from "./Timestamp";
import React, { useId, useState } from "react";
import { callOperation } from "../api/operations";
import { useResourceQuery } from "../app/resourceQueries";
import QueryStatus from "./QueryStatus";
import { useToast } from "../contexts/ToastContext";
import { useDialog } from "../contexts/DialogContext";

const initial = (serverName, timezone = "UTC") => ({
  task: "backup",
  server_name: serverName,
  enabled: false,
  time: "03:00",
  timezone,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  catch_up: false,
  stagger_minutes: 15,
  options: {},
});
export default function BackupSchedules({
  serverName,
  defaultServer,
  serverNames = [],
}) {
  const { applicationTimezone } = useTimeFormat();
  const fieldId = useId();
  const query = useResourceQuery("schedules", serverName, {
    refetchInterval: 30000,
  });
  const browserZone = browserTimezone();
  const zones =
    query.data?.timezone_database_available === false
      ? ["UTC", "Etc/UTC"]
      : [
          ...new Set([
            "UTC",
            ...(query.data?.timezones?.length
              ? query.data.timezones
              : (Intl.supportedValuesOf?.("timeZone") ?? [])),
            browserZone,
          ]),
        ].sort();
  const defaultZone = zones.includes(applicationTimezone)
    ? applicationTimezone
    : "UTC";
  const { addToast } = useToast();
  const { confirmAction } = useDialog();
  const [scheduleId, setScheduleId] = useState("");
  const [editing, setEditing] = useState(false);
  const [existing, setExisting] = useState(false);
  const [config, setConfig] = useState(() =>
    initial(serverName || defaultServer || ""),
  );
  const [busy, setBusy] = useState(false);
  const change = (key, value) => setConfig({ ...config, [key]: value });
  const perform = async (id, options) => {
    setBusy(true);
    try {
      await callOperation(id, options);
      await query.refetch();
      addToast("Schedule updated.", "success");
      return true;
    } catch (error) {
      const rejected = error.details?.errors;
      const fields = Array.isArray(rejected)
        ? rejected
            .slice(0, 10)
            .map(
              (item) =>
                `${(item.location ?? []).join(".")}: ${item.code ?? "invalid"}`,
            )
            .join("; ")
        : "";
      addToast(fields ? `${error.message} ${fields}` : error.message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card backup-schedules" aria-label="Schedules">
      <div className="schedule-toolbar">
        <div>
          <h2>Schedules</h2>
          <p className="schedule-muted">
            Backups and verification run independently.
          </p>
        </div>
        {!editing && (
          <button
            className="action-button"
            disabled={busy}
            onClick={() => {
              setScheduleId("");
              setExisting(false);
              setConfig(
                initial(serverName || defaultServer || "", defaultZone),
              );
              setEditing(true);
            }}
          >
            Add schedule
          </button>
        )}
      </div>
      {query.data?.timezone_database_available === false && (
        <div className="schedule-warning" role="alert">
          <strong>Regional timezones unavailable</strong>
          <span>
            UTC remains available. Install or repair tzdata in BSM’s Python
            environment, then restart BSM.
          </span>
        </div>
      )}
      <QueryStatus query={query} />
      <div className="schedule-list">
        {(query.data?.schedules ?? []).map((entry) => (
          <article key={entry.schedule_id}>
            <div className="schedule-entry-header">
              <div>
                <h3>{entry.schedule_id}</h3>
                <span className="schedule-muted">
                  {entry.configuration.server_name} ·{" "}
                  {entry.configuration.task === "verify"
                    ? "Verify backups"
                    : entry.configuration.task}
                </span>
              </div>
              <span
                className={`schedule-status ${entry.configuration.enabled && entry.available ? "is-enabled" : ""}`}
              >
                {!entry.available
                  ? "Unavailable"
                  : entry.configuration.enabled
                    ? "Enabled"
                    : "Paused"}
              </span>
            </div>
            <dl className="schedule-facts">
              <div>
                <dt>Time</dt>
                <dd>
                  {entry.configuration.time}{" "}
                  <span className="schedule-muted">
                    {entry.configuration.timezone.replaceAll("_", " ")}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Next run</dt>
                <dd>
                  {entry.next_run_at ? (
                    <Timestamp
                      value={entry.next_run_at}
                      timezone={entry.configuration.timezone}
                    />
                  ) : (
                    "None"
                  )}
                </dd>
              </div>
              <div>
                <dt>Last result</dt>
                <dd>{entry.last_status ?? "Not run"}</dd>
              </div>
            </dl>
            {entry.next_attempt_at && (
              <p className="schedule-muted">
                Next attempt: <Timestamp value={entry.next_attempt_at} />
              </p>
            )}
            {entry.retry_exhausted && (
              <p role="alert">
                Automatic retries exhausted. Review the failure before retrying.
              </p>
            )}
            {entry.blocked_reason && (
              <p className="schedule-muted">
                Waiting: {entry.blocked_reason.replaceAll("_", " ")}
              </p>
            )}
            {entry.last_error && <p role="alert">{entry.last_error}</p>}
            <div className="button-group">
              {[
                ["run_now", "Run now"],
                [
                  entry.configuration.enabled ? "pause" : "resume",
                  entry.configuration.enabled ? "Pause" : "Resume",
                ],
                ...(["failed", "interrupted", "deferred"].includes(
                  entry.last_status,
                )
                  ? [["retry", "Retry now"]]
                  : []),
              ].map(([action, label]) => (
                <button
                  key={action}
                  className="action-button secondary"
                  disabled={
                    busy ||
                    (["run_now", "retry"].includes(action) && !entry.available)
                  }
                  onClick={async () => {
                    if (
                      (action === "run_now" || action === "retry") &&
                      !(await confirmAction(
                        `${label} for ${entry.schedule_id}?`,
                      ))
                    )
                      return;
                    await perform("control_schedule", {
                      path: { schedule_id: entry.schedule_id },
                      body: {
                        action:
                          /** @type {"run_now" | "pause" | "resume" | "retry"} */ (
                            action
                          ),
                        revision: entry.revision,
                      },
                    });
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                className="action-button secondary"
                disabled={busy || editing}
                onClick={() => {
                  setScheduleId(entry.schedule_id);
                  setExisting(true);
                  setConfig(entry.configuration);
                  setEditing(true);
                }}
              >
                Edit
              </button>
              <button
                className="action-button secondary"
                disabled={busy}
                onClick={async () => {
                  if (
                    await confirmAction(`Remove schedule ${entry.schedule_id}?`)
                  )
                    await perform("delete_schedule", {
                      path: { schedule_id: entry.schedule_id },
                    });
                }}
              >
                Remove
              </button>
            </div>
            <details>
              <summary>Recent runs</summary>
              <ul>
                {(entry.runs ?? []).map((run) => (
                  <li key={run.run_id}>
                    <Timestamp value={run.started_at} /> · {run.status}
                    {run.error && ` · ${run.error}`}
                    {run.correlation_id && ` · Trace ${run.correlation_id}`}
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
      {!editing &&
        !query.isLoading &&
        !query.error &&
        !query.data?.schedules?.length && (
          <p className="schedule-empty">
            No schedules yet. Add a backup or verification schedule to get
            started.
          </p>
        )}
      {editing && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!zones.includes(config.timezone)) {
              addToast(
                "This timezone is unavailable on the BSM host. Choose UTC or repair the host timezone data.",
                "error",
              );
              return;
            }
            const identifier = existing
              ? scheduleId
              : scheduleId.trim().replace(/\s+/g, "-");
            if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(identifier)) {
              addToast(
                "Use letters, numbers, dots, underscores, or hyphens for the schedule name.",
                "error",
              );
              return;
            }
            if (
              !existing &&
              (query.data?.schedules ?? []).some(
                (entry) => entry.schedule_id === identifier,
              )
            ) {
              addToast(
                "A schedule with this ID already exists. Edit it or choose another name.",
                "error",
              );
              return;
            }
            if (
              await perform("save_schedule", {
                path: { schedule_id: identifier },
                body: config,
              })
            )
              setEditing(false);
          }}
        >
          <fieldset disabled={busy}>
            <legend>{existing ? "Edit schedule" : "New schedule"}</legend>
            <div className="settings-grid">
              <label>
                Name
                <input
                  className="form-input"
                  value={scheduleId}
                  readOnly={existing}
                  required
                  pattern={"[a-zA-Z0-9_.\\- ]{1,100}"}
                  title="Letters, numbers, dots, underscores, hyphens, and spaces. Spaces become hyphens in the schedule ID."
                  maxLength={100}
                  onChange={(event) => setScheduleId(event.target.value)}
                />
              </label>
              <div>
                <label htmlFor={`${fieldId}-server`}>Server</label>
                <select
                  id={`${fieldId}-server`}
                  className="form-input"
                  required
                  value={config.server_name}
                  onChange={(event) =>
                    change("server_name", event.target.value)
                  }
                >
                  <option value="" disabled>
                    Select a server
                  </option>
                  {[
                    ...new Set([
                      ...serverNames,
                      ...(config.server_name ? [config.server_name] : []),
                    ]),
                  ].map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${fieldId}-task`}>Task</label>
                <select
                  id={`${fieldId}-task`}
                  className="form-input"
                  value={config.task}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      task: event.target.value,
                      options: {},
                    })
                  }
                >
                  {[
                    ...new Set([
                      "backup",
                      "verify",
                      ...(query.data?.task_types ?? []),
                      config.task,
                    ]),
                  ].map((task) => (
                    <option key={task} value={task}>
                      {task === "backup"
                        ? "Backup"
                        : task === "verify"
                          ? "Verify backups"
                          : task}
                    </option>
                  ))}
                </select>
              </div>
              <label>
                Time in selected timezone
                <input
                  className="form-input"
                  type="time"
                  required
                  value={config.time}
                  onChange={(event) => change("time", event.target.value)}
                />
              </label>
              <div>
                <label htmlFor={`${fieldId}-timezone`}>Timezone</label>
                <select
                  id={`${fieldId}-timezone`}
                  className="form-input"
                  required
                  value={config.timezone}
                  onChange={(event) => change("timezone", event.target.value)}
                >
                  {[...new Set([...zones, config.timezone])].map((zone) => (
                    <option
                      key={zone}
                      value={zone}
                      disabled={!zones.includes(zone)}
                    >
                      {zone === "America/Los_Angeles"
                        ? "Pacific Time (America/Los_Angeles)"
                        : zone.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <label>
                Stagger (minutes)
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="120"
                  value={config.stagger_minutes}
                  onChange={(event) =>
                    change("stagger_minutes", Number(event.target.value))
                  }
                />
              </label>
              {config.task === "backup" && (
                <BackupContents
                  mode={config.options.mode ?? "default"}
                  components={
                    config.options.components ?? defaultBackupComponents
                  }
                  allowDefault
                  disabled={busy}
                  onChange={(mode, components) =>
                    change("options", {
                      ...config.options,
                      mode: mode === "default" ? null : mode,
                      components: mode === "selected" ? components : null,
                    })
                  }
                />
              )}
              {config.task.includes(":") && (
                <PluginSettingsFields
                  key={config.task}
                  values={config.options}
                  schema={
                    query.data?.task_definitions?.[config.task]?.options_schema
                  }
                  onChange={(path, value) =>
                    change(
                      "options",
                      path ? updateSetting(config.options, path, value) : value,
                    )
                  }
                />
              )}
              {config.task === "verify" && (
                <label>
                  Recheck after (hours)
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max="8760"
                    value={config.options.minimum_age_hours ?? 168}
                    onChange={(event) =>
                      change("options", {
                        minimum_age_hours: Number(event.target.value),
                      })
                    }
                  />
                  <small>Unverified archives are always eligible.</small>
                </label>
              )}
            </div>
            <p className="schedule-muted">
              Times follow the selected timezone, including daylight-saving
              changes. New schedules begin at their next occurrence.
            </p>
            <details className="schedule-help">
              <summary>Clock information</summary>
              <p>
                Your timezone: {browserZone}. BSM host clock:{" "}
                {query.data?.host_timezone ?? "Unknown"}. BSM converts each
                occurrence to UTC automatically.
              </p>
              <p>
                Enable verification in backup policy or add a verification
                schedule.
              </p>
            </details>
            <fieldset className="schedule-days">
              <legend>Days</legend>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day, index) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={config.weekdays.includes(index)}
                      onChange={(event) =>
                        change(
                          "weekdays",
                          event.target.checked
                            ? [...config.weekdays, index].sort()
                            : config.weekdays.filter((v) => v !== index),
                        )
                      }
                    />
                    {day}
                  </label>
                ),
              )}
            </fieldset>
            <label>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) => change("enabled", event.target.checked)}
              />
              Enabled
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.catch_up}
                onChange={(event) => change("catch_up", event.target.checked)}
              />
              Run the latest missed occurrence after downtime
            </label>
            <div className="button-group">
              <button
                className="action-button"
                disabled={!config.weekdays.length}
              >
                Save
              </button>
              <button
                type="button"
                className="action-button secondary"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
