import BackupContents from "./BackupContents";
import { defaultBackupComponents } from "../utils/backupContents";
import DestinationCleanup from "./DestinationCleanup";
import React, { useState } from "react";
import { useServer } from "../contexts/ServerContext";
import BackupKeys from "./BackupKeys";
export default function BackupSettings({
  policy,
  setPolicy,
  retention,
  setRetention,
}) {
  const { servers, selectedServer } = useServer() ?? {};
  const [serverName, setServerName] = useState(selectedServer || "");
  const serverNames = [
    ...new Set([
      ...(Array.isArray(servers)
        ? servers.map((server) =>
            typeof server === "string" ? server : server.name,
          )
        : Object.keys(servers ?? {})),
      ...Object.keys(policy.schedules ?? {}),
      ...(selectedServer ? [selectedServer] : []),
    ]),
  ].filter(Boolean);
  const [destination, setDestination] = useState("");
  const [destinationPath, setDestinationPath] = useState("");
  return (
    <section className="backup-settings">
      <h2>Backup policy</h2>
      <p className="form-help-text">
        Save changes to apply backup policy and destination settings.
      </p>
      <fieldset className="backup-policy-section">
        <legend>Defaults and retention</legend>
        <div className="settings-grid">
          <label>
            Default encryption
            <select
              className="form-input"
              value={String(policy.encryption ?? false)}
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  encryption: event.target.value === "true",
                })
              }
            >
              <option value="false">Unencrypted</option>
              <option value="true">Encrypted</option>
            </select>
            <small className="form-help-text">
              Generate a key and download its emergency kit before enabling
              encryption.
            </small>
          </label>{" "}
          <label>
            <input
              type="checkbox"
              checked={policy.verify_after_create ?? false}
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  verify_after_create: event.target.checked,
                })
              }
            />
            Verify after creation
            <small className="form-help-text">
              Off by default. Full verification reads and extracts the archive
              again and delays pre-start backups. Restore always validates
              integrity.
            </small>
          </label>
          {retention !== undefined && (
            <label>
              Recent recovery points
              <input
                className="form-input"
                type="number"
                min={0}
                step={1}
                required
                value={retention}
                onChange={(event) => setRetention(Number(event.target.value))}
              />
              <small className="form-help-text">
                Number of recent backups retained per server. Zero disables
                count-based pruning.
              </small>
            </label>
          )}
          {[
            [
              "readiness_max_age_hours",
              "Readiness: maximum backup age (hours)",
              48,
              1,
            ],
            [
              "recovery_drill_interval_hours",
              "Isolated recovery drill interval (hours; 0 disables)",
              0,
              0,
            ],
          ].map(([key, label, fallback, min]) => (
            <label key={key}>
              {label}
              <input
                className="form-input"
                type="number"
                min={min}
                max={8760}
                step={1}
                required
                value={policy[key] ?? fallback}
                onChange={(event) =>
                  setPolicy({ ...policy, [key]: Number(event.target.value) })
                }
              />
            </label>
          ))}
          {[
            [
              "verification_interval_hours",
              "Verify every (hours; 0 disables periodic checks)",
            ],
            ["safety_window_hours", "Protect safety backups for (hours)"],
            ["keep_daily", "Daily recovery points"],
            ["keep_weekly", "Weekly recovery points"],
            ["keep_monthly", "Monthly recovery points"],
          ].map(([key, label]) => (
            <label key={key} style={{ display: "block" }}>
              {label}
              <input
                className="form-input"
                type="number"
                required
                step={1}
                min={key === "safety_window_hours" ? 1 : 0}
                max={
                  {
                    verification_interval_hours: 8760,
                    safety_window_hours: 8760,
                    keep_daily: 365,
                    keep_weekly: 520,
                    keep_monthly: 120,
                  }[key]
                }
                value={policy[key] ?? 0}
                onChange={(event) =>
                  setPolicy({
                    ...policy,
                    [key]: Number(event.target.value),
                  })
                }
              />
            </label>
          ))}
          <label>
            Storage budget (GiB)
            <input
              className="form-input"
              type="number"
              min={0}
              step="any"
              required
              value={(policy.storage_budget_bytes ?? 0) / 1073741824}
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  storage_budget_bytes: Math.round(
                    Number(event.target.value) * 1073741824,
                  ),
                })
              }
            />
            <small className="form-help-text">
              Zero disables the storage budget.
            </small>
          </label>
          <p>
            Pins, protected safety backups, and the last verified recovery point
            can exceed the storage budget. A retention count of zero disables
            pruning.
          </p>
          <BackupContents
            mode={policy.mode ?? "selected"}
            components={policy.components ?? defaultBackupComponents}
            onChange={(mode, components) =>
              setPolicy({
                ...policy,
                mode,
                components,
              })
            }
          />
        </div>
      </fieldset>
      <fieldset className="backup-policy-section">
        <legend>Off-machine destinations</legend>
        <div className="settings-grid">
          <p>
            Use an existing directory, such as mounted NAS storage. Copies keep
            the archive’s encryption and are not pruned with local backups.
          </p>
          <label>
            Server for external cleanup
            <select
              className="form-input"
              value={serverName}
              onChange={(event) => setServerName(event.target.value)}
            >
              <option value="">Choose a server</option>
              {serverNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {Object.entries(policy.destinations ?? {}).map(([name, config]) => (
            <section key={name} className="backup-destination-policy">
              {name}: {config.path}{" "}
              {config.enabled ? "(enabled)" : "(disabled)"}{" "}
              <button
                type="button"
                className="action-button secondary"
                onClick={() =>
                  setPolicy({
                    ...policy,
                    destinations: {
                      ...policy.destinations,
                      [name]: { ...config, enabled: !config.enabled },
                    },
                  })
                }
              >
                {config.enabled ? "Disable" : "Enable"}
              </button>{" "}
              <button
                type="button"
                className="action-button secondary"
                onClick={() => {
                  const entries = { ...policy.destinations };
                  delete entries[name];
                  setPolicy({ ...policy, destinations: entries });
                }}
              >
                Remove destination
              </button>
              <div className="settings-grid">
                {[
                  [
                    "keep_count",
                    "External copies to retain (0 disables count pruning)",
                    0,
                  ],
                  [
                    "storage_budget_bytes",
                    "External storage budget (GiB; 0 disables)",
                    0,
                  ],
                  [
                    "min_free_bytes",
                    "Free-space warning threshold (GiB)",
                    1073741824,
                  ],
                ].map(([key, label, fallback]) => (
                  <label key={key}>
                    {label}
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      step={key === "keep_count" ? 1 : "any"}
                      required
                      value={
                        (config[key] ?? fallback) /
                        (key === "keep_count" ? 1 : 1073741824)
                      }
                      onChange={(event) =>
                        setPolicy({
                          ...policy,
                          destinations: {
                            ...policy.destinations,
                            [name]: {
                              ...config,
                              [key]: Math.round(
                                Number(event.target.value) *
                                  (key === "keep_count" ? 1 : 1073741824),
                              ),
                            },
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <DestinationCleanup
                key={`${serverName}:${name}:${config.path}`}
                serverName={serverName}
                destination={name}
              />
            </section>
          ))}
          <label>
            Destination name
            <input
              className="form-input"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
          </label>
          <label>
            Directory on the BSM host
            <input
              className="form-input"
              value={destinationPath}
              onChange={(event) => setDestinationPath(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="action-button secondary"
            disabled={
              !destination.trim() ||
              !destinationPath.trim() ||
              Object.hasOwn(policy.destinations ?? {}, destination.trim())
            }
            onClick={() => {
              setPolicy({
                ...policy,
                destinations: {
                  ...policy.destinations,
                  [destination.trim()]: {
                    path: destinationPath.trim(),
                    enabled: true,
                  },
                },
              });
              setDestination("");
              setDestinationPath("");
            }}
          >
            Add destination
          </button>
        </div>
      </fieldset>
      <details>
        <summary>Advanced archive limits</summary>
        <p className="form-help-text">
          Limits apply when reading and importing archives.
        </p>
        <div className="settings-grid">
          {[
            ["max_files", "Maximum files", 1000000],
            [
              "max_expanded_bytes",
              "Maximum expanded size (bytes)",
              1099511627776,
            ],
            [
              "max_archive_bytes",
              "Maximum archive size (bytes)",
              1099511627776,
            ],
          ].map(([key, label, fallback]) => (
            <label key={key}>
              {label}
              <input
                className="form-input"
                type="number"
                min={1}
                max={key === "max_files" ? 1000000 : undefined}
                required
                step={1}
                value={policy[key] ?? fallback}
                onChange={(event) =>
                  setPolicy({ ...policy, [key]: Number(event.target.value) })
                }
              />
            </label>
          ))}
        </div>
      </details>
      <BackupKeys />
    </section>
  );
}
