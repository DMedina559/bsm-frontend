import React, { useId, useState } from "react";
import { callOperation } from "../api/operations";
import { useResourceQuery } from "../app/resourceQueries";
import QueryStatus from "./QueryStatus";
import { useToast } from "../contexts/ToastContext";
import { useDialog } from "../contexts/DialogContext";

const initial = (serverName) => ({
  task: "backup",
  server_name: serverName,
  enabled: false,
  time: "03:00",
  timezone: "UTC",
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
  const fieldId = useId();
  const query = useResourceQuery("schedules", serverName, {
    refetchInterval: 30000,
  });
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
      <h2>Schedules</h2>
      <p>
        Backup and verification run independently. Automatic verification is off
        until you configure it. New schedules start with their next occurrence.
      </p>
      <QueryStatus query={query} />
      {(query.data?.schedules ?? []).map((entry) => (
        <article key={entry.schedule_id}>
          <strong>{entry.schedule_id}</strong> · {entry.configuration.task} ·{" "}
          {entry.configuration.server_name} ·{" "}
          {entry.configuration.enabled ? "Enabled" : "Paused"}
          {!entry.available && " · Handler unavailable"}
          <p>
            {entry.configuration.time} {entry.configuration.timezone} · Next:{" "}
            {entry.next_run_at
              ? new Date(entry.next_run_at).toLocaleString()
              : "None"}{" "}
            · Last: {entry.last_status ?? "Not run"}
          </p>
          {entry.last_error && <p role="alert">{entry.last_error}</p>}
          <div className="button-group">
            <button
              className="action-button secondary"
              disabled={busy}
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
                  {run.started_at} · {run.status}
                  {run.error && ` · ${run.error}`}
                  {run.correlation_id && ` · Trace ${run.correlation_id}`}
                </li>
              ))}
            </ul>
          </details>
        </article>
      ))}
      {!editing ? (
        <button
          className="action-button"
          disabled={busy}
          onClick={() => {
            setScheduleId("");
            setExisting(false);
            setConfig(initial(serverName || defaultServer || ""));
            setEditing(true);
          }}
        >
          Add schedule
        </button>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
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
            <legend>Schedule</legend>
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
                Time
                <input
                  className="form-input"
                  type="time"
                  required
                  value={config.time}
                  onChange={(event) => change("time", event.target.value)}
                />
              </label>
              <label>
                Timezone
                <input
                  className="form-input"
                  required
                  value={config.timezone}
                  onChange={(event) => change("timezone", event.target.value)}
                />
              </label>
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
            <fieldset>
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
