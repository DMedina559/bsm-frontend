import { useTimeFormat } from "../app/useTimeFormat";
import Timestamp from "../components/Timestamp";
import { Link } from "react-router-dom";
import "../styles/backup-settings.css";
import React, { useEffect, useRef, useState } from "react";
import { Archive, Download, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { callOperation } from "../api/operations";
import QueryStatus from "../components/QueryStatus";
import Modal from "../components/Modal";
import { queryKeys } from "../app/queryKeys";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import { useDialog } from "../contexts/DialogContext";
import { useServer } from "../contexts/ServerContext";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";

const labels = {
  world: "World",
  "server.properties": "Server properties",
  "allowlist.json": "Allowlist",
  "permissions.json": "Player permissions",
  script_config: "Script configuration (includes secrets)",
  bsm_settings: "BSM server settings",
  behavior_packs: "Behavior packs",
  resource_packs: "Resource packs",
  development_behavior_packs: "Development behavior packs",
  development_resource_packs: "Development resource packs",
};
const unlockOperations = new Set([
  "inspect_server_snapshot",
  "plan_snapshot_restore",
  "dry_run_server_restore",
  "restore_server_snapshot",
  "export_decrypted_snapshot",
  "manage_server_snapshot",
  "prepare_backup_copy",
]);

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

export default function Backups() {
  const { selectedServer } = useServer();
  const { sessionGeneration } = useAuth();
  return <ServerBackups key={`${sessionGeneration}:${selectedServer}`} />;
}

function ServerBackups() {
  const { date } = useTimeFormat();
  const { selectedServer, setSelectedServer, refreshServers } = useServer();
  const { user, sessionGeneration } = useAuth();
  const { confirmAction } = useDialog();
  const { addToast } = useToast();
  const snapshots = useResourceQuery("snapshots", selectedServer, {
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const health = useResourceQuery("backupHealth", selectedServer, {
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const [destination, setDestination] = useState("");
  const [copyName, setCopyName] = useState("");
  const [copyVersion, setCopyVersion] = useState("LATEST");
  const [port, setPort] = useState(19134);
  const [portv6, setPortv6] = useState(19135);
  const [transferring, setTransferring] = useState(false);
  const [legacyExpanded, setLegacyExpanded] = useState(false);
  const legacy = useResourceQuery("backups", selectedServer, {
    enabled: legacyExpanded,
  });
  const recovery = useResourceQuery("backupRecovery", selectedServer);
  const [encryption, setEncryption] = useState("default");
  const [packs, setPacks] = useState("default");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [components, setComponents] = useState([]);
  const [plan, setPlan] = useState(null);
  const [restart, setRestart] = useState(true);
  const [progress, setProgress] = useState("");
  const secret = useRef("");
  const input = useRef(null);
  const scope = useRef(new AbortController());
  useEffect(() => {
    scope.current = new AbortController();
    return () => {
      scope.current.abort();
      secret.current = "";
    };
  }, [selectedServer, sessionGeneration]);
  const reset = () => {
    setSelected(null);
    setManifest(null);
    setPlan(null);
    setComponents([]);
    secret.current = "";
    if (input.current) input.current.value = "";
  };

  const write = useResourceMutation(
    async ({ id, options, wait = true }, { session }) => {
      const signal = AbortSignal.any([session.signal, scope.current.signal]);
      const body =
        unlockOperations.has(id) || id === "import_server_snapshot"
          ? {
              ...options.body,
              ...(secret.current ? { recovery_key: secret.current } : {}),
            }
          : options.body;
      /** @type {any} */
      const result = await callOperation(id, {
        ...options,
        body,
        session,
        signal,
        timeout: 0,
      });
      if (!wait || !result?.task_id) return result;
      for (;;) {
        signal.throwIfAborted();
        const task = await callOperation("get_task_status", {
          path: { task_id: result.task_id },
          signal,
          session,
        });
        setProgress(task.message);
        if (task.status === "completed") return task.result;
        if (["failed", "cancelled"].includes(task.status))
          throw new Error(task.error?.message ?? task.message);
        await new Promise((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException("Cancelled", "AbortError"));
          };
          const timer = setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve();
          }, 700);
          signal.addEventListener("abort", onAbort, { once: true });
        });
      }
    },
    [queryKeys.serverBackups(selectedServer)],
  );
  const busy = write.isPending;
  const perform = async (id, options = {}, wait = true) => {
    try {
      return await write.mutateAsync({ id, options, wait });
    } catch (error) {
      if (error.name !== "AbortError") addToast(error.message, "error");
      return null;
    } finally {
      setProgress("");
    }
  };
  const path = selectedServer ? { server_name: selectedServer } : {};
  const visibleSnapshots = (snapshots.data ?? [])
    .filter(
      (item) =>
        (filter === "all" ||
          item.purpose === filter ||
          item.origin === filter ||
          (filter === "pinned" && item.pinned) ||
          (filter === "failed" &&
            (item.error || item.verification?.status === "failed"))) &&
        `${item.filename} ${item.label ?? ""} ${item.notes ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (Date.parse(b.created_at ?? "") || 0) -
          (Date.parse(a.created_at ?? "") || 0) ||
        b.filename.localeCompare(a.filename),
    );
  const archivePath = selected
    ? { ...path, backup_id: selected.backup_id }
    : path;
  const create = async () => {
    const encrypted =
      encryption === "default" ? null : encryption === "encrypted";
    const result = await perform("create_server_snapshot", {
      path,
      body: {
        encrypted,
        include_packs: packs === "default" ? null : packs === "include",
      },
    });
    if (result) {
      addToast(
        result.backup?.error ?? "Server backup created.",
        result.backup?.error ? "warning" : "success",
      );
      await snapshots.refetch();
    }
  };
  const inspect = async () => {
    const result = await perform("inspect_server_snapshot", {
      path: archivePath,
      body: {},
    });
    if (result?.backup?.manifest) {
      setManifest(result.backup.manifest);
      setComponents(
        Object.entries(result.backup.manifest.components)
          .filter(([, state]) => state === "included")
          .map(([name]) => name),
      );
    }
  };
  const review = async (dryRun = false) => {
    const result = await perform(
      dryRun === true ? "dry_run_server_restore" : "plan_snapshot_restore",
      {
        path: archivePath,
        body: { components },
      },
    );
    if (result?.plan) setPlan(result.plan);
  };
  const restore = async () => {
    if (
      !(await confirmAction(
        `Replace the selected data on ${selectedServer}? The Minecraft server will stop while BSM restores it.`,
      ))
    )
      return;
    const result = await perform("restore_server_snapshot", {
      path: archivePath,
      body: { components, token: plan.token, restart, stop_running: true },
    });
    if (result) {
      addToast(
        result.result?.restart_error ??
          result.result?.cleanup_warning ??
          "Selected components restored.",
        result.status === "partial" ? "warning" : "success",
      );
      reset();
    }
  };
  const transferProgress = (verb) => (loaded, total) =>
    setProgress(
      `${verb}: ${(loaded / 1048576).toFixed(1)} MB${total ? ` of ${(total / 1048576).toFixed(1)} MB` : ""}`,
    );
  const manage = async (item, action, extra = {}) => {
    const result = await perform("manage_server_snapshot", {
      path: { ...path, backup_id: item.backup_id },
      body: { action, ...extra },
    });
    if (result) {
      await snapshots.refetch();
      await health.refetch();
      addToast("Backup operation completed.", "success");
    }
  };
  const download = async (item) => {
    let writable;
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: item.filename,
          types: [
            {
              description: "BSM backup",
              accept: { "application/octet-stream": [".bsmbackup"] },
            },
          ],
        });
        writable = await handle.createWritable();
      } catch (error) {
        if (error.name !== "AbortError") addToast(error.message, "error");
        return;
      }
    }
    setTransferring(true);
    const blob = await perform(
      "download_server_snapshot",
      {
        path: { ...path, backup_id: item.backup_id },
        responseType: "blob",
        downloadTo: writable,
        onDownloadProgress: transferProgress("Downloading"),
      },
      false,
    );
    setTransferring(false);
    if (blob) saveBlob(blob, item.filename);
    else if (writable) await writable.abort().catch(() => {});
  };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTransferring(true);
    const result = await perform("import_server_snapshot", {
      path,
      body: { file },
      onUploadProgress: transferProgress("Uploading"),
    });
    setTransferring(false);
    if (result) {
      secret.current = "";
      if (input.current) input.current.value = "";
      await snapshots.refetch();
      addToast("Backup imported and validated.", "success");
    }
    event.target.value = "";
  };
  if (!selectedServer)
    return <div className="container">Select a server to manage backups.</div>;
  return (
    <div className="container backups-page">
      <div className="header">
        <div>
          <h1>
            <Archive size={24} /> Backups: {selectedServer}
          </h1>
          <p className="backup-page-subtitle">
            Create, inspect and restore recovery points.
          </p>
        </div>
        <div className="button-group">
          <button
            className="action-button secondary"
            disabled={busy}
            aria-label="Recovery report"
            onClick={async () => {
              const report = await perform(
                "download_backup_recovery_report",
                { path, responseType: "blob" },
                false,
              );
              if (report) saveBlob(report, "bsm-recovery-report.json");
            }}
          >
            <Download size={16} /> Report
          </button>
          <button
            className="action-button secondary"
            disabled={busy}
            onClick={() => snapshots.refetch()}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            className="action-button secondary"
            disabled={busy}
            aria-label="Prune old"
            onClick={async () => {
              if (
                await confirmAction(
                  "Prune completed archives using the retention setting? Zero disables automatic pruning.",
                )
              )
                await perform("prune_backups", { path });
            }}
          >
            <Trash2 size={16} /> Prune
          </button>
          {user?.role === "admin" && (
            <Link
              className="action-button secondary"
              to="/bsm-settings?tab=backups"
              aria-label="Backup settings"
            >
              Settings
            </Link>
          )}
        </div>
      </div>
      <QueryStatus query={snapshots} />
      <QueryStatus query={health} />
      <div className="backup-overview-grid">
        {health.data && (
          <section className="card backup-health" aria-label="Backup health">
            <div className="backup-section-heading">
              <h2>Recovery readiness</h2>
              <span className="backup-readiness">
                {health.data.readiness ?? "Checking"}
              </span>
            </div>
            <ul>
              {(health.data.readiness_reasons ?? []).map((reason) => (
                <li key={reason}>
                  {reason}
                  {user?.role === "admin" &&
                  /destination|external|key|scheduled/.test(
                    reason.toLowerCase(),
                  ) ? (
                    <Link to="/bsm-settings?tab=backups"> Review settings</Link>
                  ) : /verification/.test(reason.toLowerCase()) ? (
                    <button
                      className="action-button secondary"
                      onClick={() => setFilter("failed")}
                    >
                      Show affected archives
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <dl className="backup-stats">
              <div>
                <dt>Recovery points</dt>
                <dd>{health.data.count}</dd>
              </div>
              <div>
                <dt>Storage used</dt>
                <dd>{(health.data.total_bytes / 1048576).toFixed(1)} MB</dd>
              </div>
              <div>
                <dt>Last backup</dt>
                <dd>
                  {health.data.last_success_at ? (
                    <Timestamp value={health.data.last_success_at} />
                  ) : (
                    "Never"
                  )}
                </dd>
              </div>
              <div>
                <dt>Last verified</dt>
                <dd>
                  {health.data.last_verified_at ? (
                    <Timestamp value={health.data.last_verified_at} />
                  ) : (
                    "Never"
                  )}
                </dd>
              </div>
            </dl>
            <details className="backup-health-details">
              <summary>Recovery and destination details</summary>
              {health.data.recovery_backup_id && (
                <p>
                  Latest usable recovery point:{" "}
                  <code>{health.data.recovery_backup_id}</code>
                </p>
              )}
              {health.data.drill && (
                <p>
                  Last isolated drill: {health.data.drill.status} ·{" "}
                  {<Timestamp value={health.data.drill.checked_at} />} ·{" "}
                  {health.data.drill.checked_files ?? 0} files checked
                </p>
              )}
              {Object.entries(health.data.destinations ?? {}).map(
                ([name, destination]) => (
                  <p key={name}>
                    {name}:{" "}
                    {!destination.enabled
                      ? "Disabled"
                      : !destination.available
                        ? "Unavailable"
                        : `${(destination.available_bytes / 1073741824).toFixed(1)} GiB free${destination.low_space ? " — low space" : ""}`}
                  </p>
                ),
              )}
            </details>
            {(health.data.failed_count > 0 ||
              health.data.destination_failures > 0) && (
              <p className="message-warning" role="alert">
                {health.data.failed_count} failed verification ·{" "}
                {health.data.destination_failures} destination copies need
                attention
              </p>
            )}
            {!!health.data.missing_key_ids?.length && (
              <p role="alert">
                Recovery keys are missing for{" "}
                {health.data.missing_key_ids.join(", ")}. Use their emergency
                kits.
              </p>
            )}
            {!!health.data.older_key_ids?.length && (
              <p>
                Older backups still require {health.data.older_key_ids.length}{" "}
                previous encryption keys. Keep their emergency kits.
              </p>
            )}
            {health.data.schedule && (
              <p>
                Schedule: {health.data.schedule.enabled ? "Enabled" : "Paused"}.
                Next run:{" "}
                {health.data.schedule.next_run_at ? (
                  <Timestamp value={health.data.schedule.next_run_at} />
                ) : (
                  "None"
                )}
                . Last result: {health.data.schedule.last_status ?? "Not run"}.{" "}
                {health.data.schedule.last_error ?? ""}
              </p>
            )}
            {health.data.last_error && (
              <p role="alert">{health.data.last_error}</p>
            )}
          </section>
        )}
        <QueryStatus query={recovery} />
        {recovery.data?.active && (
          <section className="message-warning">
            <p>
              {recovery.data.error ??
                (recovery.data.committed
                  ? "Restore committed; cleanup needs attention."
                  : "An interrupted restore needs recovery before this server can start.")}
            </p>
            <button
              className="action-button"
              disabled={busy}
              onClick={async () => {
                if (
                  await confirmAction(
                    "Retry restore recovery? Stop the Minecraft server first if rollback is required.",
                  )
                ) {
                  await perform("recover_server_backup", { path });
                  await recovery.refetch();
                }
              }}
            >
              Retry recovery
            </button>
          </section>
        )}
        <section className="card backup-create">
          <h2>Create backup</h2>
          <p>
            Capture the world, configuration and server settings in one archive.
          </p>
          <label>
            Server-level packs{" "}
            <select
              className="form-input"
              value={packs}
              disabled={busy}
              onChange={(event) => setPacks(event.target.value)}
            >
              <option value="default">Use configured default</option>
              <option value="include">Include packs</option>
              <option value="exclude">Exclude packs</option>
            </select>
          </label>{" "}
          <label>
            Encryption{" "}
            <select
              className="form-input"
              value={encryption}
              disabled={busy}
              onChange={(e) => setEncryption(e.target.value)}
            >
              <option value="default">Use configured default</option>
              <option value="encrypted">Encrypted</option>
              <option value="plain">Unencrypted</option>
            </select>
          </label>{" "}
          <button className="action-button" disabled={busy} onClick={create}>
            Create backup
          </button>
          <details>
            <summary>Import a backup</summary>
            <form onSubmit={(event) => event.preventDefault()}>
              <label>
                Recovery key (if encrypted){" "}
                <input
                  className="form-input"
                  ref={input}
                  type="password"
                  name="recovery_key"
                  autoComplete="off"
                  onChange={(e) => {
                    secret.current = e.target.value;
                  }}
                />
              </label>
            </form>
            <label>
              Backup file{" "}
              <input
                className="form-input"
                type="file"
                accept=".bsmbackup,.tar"
                disabled={busy}
                onChange={upload}
              />
            </label>
          </details>
        </section>
      </div>
      {progress && (
        <p role="status" className="message info">
          {progress}
        </p>
      )}
      {transferring && (
        <button
          className="action-button secondary"
          onClick={() => {
            scope.current.abort();
            scope.current = new AbortController();
          }}
        >
          Cancel transfer
        </button>
      )}
      <div className="backup-section-heading backup-history-heading">
        <h2>Recovery points</h2>
        {user?.role === "admin" && (
          <Link className="action-button secondary" to="/scheduler">
            Schedules
          </Link>
        )}
      </div>
      <div className="button-group backup-filters">
        <label>
          Find backups
          <input
            className="form-input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Label, notes, or filename"
          />
        </label>
        <label>
          Filter
          <select
            className="form-input"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {[
              ["all", "All archives"],
              ["manual", "Manual"],
              ["scheduled", "Scheduled"],
              ["pre_update", "Before update"],
              ["pre_start", "Before start"],
              ["pre_restore", "Safety backups"],
              ["imported", "Imported"],
              ["pinned", "Pinned"],
              ["failed", "Needs attention"],
            ].map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
      </div>
      {snapshots.isFetching && snapshots.data !== undefined && (
        <p className="form-help-text" role="status">
          Refreshing recovery points… Existing results remain visible.
        </p>
      )}
      <div className="backup-history-table" aria-busy={snapshots.isFetching}>
        <table className="table">
          <thead>
            <tr>
              <th>Archive</th>
              <th>Size</th>
              <th>Protection</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleSnapshots.map((item, index) => (
              <React.Fragment key={item.backup_id}>
                {(index === 0 ||
                  date(item.created_at ?? 0) !==
                    date(visibleSnapshots[index - 1].created_at ?? 0)) && (
                  <tr className="backup-date-group">
                    <th colSpan={4} scope="colgroup">
                      {item.created_at
                        ? date(item.created_at)
                        : "Date unavailable"}
                    </th>
                  </tr>
                )}
                <tr>
                  <td>
                    <strong>
                      {item.label ||
                        (item.created_at ? (
                          <Timestamp value={item.created_at} />
                        ) : (
                          "Server backup"
                        ))}
                    </strong>
                    <small className="archive-filename" title={item.filename}>
                      {item.filename}
                    </small>

                    {item.notes && <p>{item.notes}</p>}
                    {item.drill && (
                      <small>Recovery drill: {item.drill.status}</small>
                    )}
                    <small>
                      {item.origin === "imported"
                        ? "Imported"
                        : ({
                            manual: "Manual backup",
                            scheduled: "Scheduled backup",
                            pre_update: "Before update",
                            pre_start: "Before start",
                            pre_restore: "Restore safety backup",
                          }[item.purpose] ?? "Archive")}
                    </small>
                    {item.error && <p role="alert">{item.error}</p>}
                  </td>
                  <td>{(item.size / 1048576).toFixed(1)} MB</td>
                  <td>
                    {item.encrypted ? "Encrypted" : "Unencrypted"}
                    <br />
                    {item.verification?.status ?? "unverified"}
                    {item.verification?.verified_at && (
                      <span>
                        {" "}
                        · {<Timestamp value={item.verification.verified_at} />}
                      </span>
                    )}
                    {item.pinned && <span> · Pinned</span>}
                    {item.protected_until && (
                      <span>
                        {" "}
                        · Protected until{" "}
                        {<Timestamp value={item.protected_until} />}
                      </span>
                    )}
                    {Object.entries(item.copies ?? {}).map(([name, copy]) => (
                      <p key={name}>
                        {name}: {copy.status}
                        {copy.error ? ` — ${copy.error}` : ""}
                      </p>
                    ))}
                  </td>
                  <td>
                    <button
                      className="action-button secondary"
                      disabled={busy}
                      onClick={() => download(item)}
                    >
                      <Download size={14} /> Download
                    </button>{" "}
                    <button
                      className="action-button"
                      disabled={busy || !!item.error}
                      onClick={() => {
                        reset();
                        setSelected(item);
                        setLabel(item.label ?? "");
                        setNotes(item.notes ?? "");
                      }}
                    >
                      <RotateCcw size={14} /> Inspect
                    </button>{" "}
                    <button
                      className="action-button secondary"
                      disabled={busy}
                      onClick={() => manage(item, "verify")}
                    >
                      Verify
                    </button>
                    <details className="backup-more">
                      <summary>More</summary>
                      <button
                        className="action-button secondary"
                        disabled={busy || !!item.error}
                        onClick={() => manage(item, "drill")}
                      >
                        Recovery drill
                      </button>{" "}
                      <button
                        className="action-button secondary"
                        disabled={busy}
                        onClick={() =>
                          manage(item, item.pinned ? "unpin" : "pin")
                        }
                      >
                        {item.pinned ? "Unpin" : "Pin"}
                      </button>
                    </details>
                  </td>
                </tr>
              </React.Fragment>
            ))}
            {visibleSnapshots.length === 0 && (
              <tr>
                <td colSpan={4} className="backup-list-state">
                  {snapshots.data === undefined && !snapshots.error ? (
                    <span role="status">Loading recovery points…</span>
                  ) : snapshots.error ? (
                    "Recovery points could not be loaded or refreshed. Retry the request above."
                  ) : filter !== "all" || search.trim() ? (
                    "No backups match this view."
                  ) : (
                    "No recovery points yet. Create or import a backup to get started."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <details
        onToggle={(event) => setLegacyExpanded(event.currentTarget.open)}
      >
        <summary>Legacy backups</summary>
        <p>
          These files are independent snapshots. Restore each explicitly; they
          do not form one historical backup.
        </p>
        <QueryStatus query={legacy} />
        {legacyExpanded && legacy.isPending && !legacy.error && (
          <p role="status">Loading legacy backups…</p>
        )}
        {Object.entries(legacy.data ?? {}).map(([type, files]) => (
          <section key={type}>
            <h3>{type}</h3>
            {files.map((filename) => (
              <p key={filename}>
                {filename}{" "}
                <button
                  className="action-button secondary"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await confirmAction(`Replace ${type} using ${filename}?`)
                    )
                      await perform("restore_backup", {
                        path,
                        body: { restore_type: type, backup_file: filename },
                      });
                  }}
                >
                  Restore legacy file
                </button>
              </p>
            ))}
          </section>
        ))}
      </details>
      {selected && (
        <Modal
          title="Inspect backup"
          className="backup-inspector"
          onClose={reset}
          closeDisabled={busy}
        >
          <p className="backup-inspector-hint">
            Inspect this archive, select components, then review a restore plan.
          </p>
          <dl className="backup-summary">
            <div>
              <dt>Archive</dt>
              <dd>{selected.filename}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>
                {selected.created_at ? (
                  <Timestamp value={selected.created_at} />
                ) : (
                  "Unknown"
                )}
              </dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{(selected.size / 1048576).toFixed(1)} MB</dd>
            </div>
            <div>
              <dt>Encryption</dt>
              <dd>{selected.encrypted ? "Encrypted" : "Unencrypted"}</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>{selected.verification?.status ?? "unverified"}</dd>
            </div>
          </dl>
          <details>
            <summary>Capture timings</summary>
            <dl>
              {Object.entries(selected.stage_durations_ms ?? {}).map(
                ([stage, duration]) => (
                  <div key={stage}>
                    <dt>{stage}</dt>
                    <dd>{(duration / 1000).toFixed(2)} seconds</dd>
                  </div>
                ),
              )}
            </dl>
          </details>
          <details>
            <summary>Label and notes</summary>
            <label>
              Label
              <input
                className="form-input"
                maxLength={120}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
            <label>
              Notes
              <textarea
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <p>
              Labels and notes stay with this manager; archive downloads keep
              their original contents.
            </p>
            <button
              className="action-button secondary"
              disabled={busy}
              onClick={() => manage(selected, "annotate", { label, notes })}
            >
              Save
            </button>
          </details>
          {!manifest ? (
            <>
              <p>
                Validate and inspect this archive before choosing what to
                restore.
              </p>
              {selected.encrypted && (
                <form onSubmit={(event) => event.preventDefault()}>
                  <label>
                    Recovery key (leave blank to use the stored key)
                    <input
                      className="form-input"
                      type="password"
                      name="recovery_key"
                      autoComplete="off"
                      onChange={(e) => {
                        secret.current = e.target.value;
                      }}
                    />
                  </label>
                </form>
              )}
              <button
                className="action-button"
                disabled={busy}
                onClick={inspect}
              >
                Inspect
              </button>
            </>
          ) : (
            <>
              <p>
                Captured {<Timestamp value={manifest.created_at} />} from{" "}
                {manifest.source_server}, world {manifest.source_world}. Bedrock{" "}
                {manifest.bedrock_version}; BSM {manifest.bsm_version}.
              </p>
              <details>
                <summary>
                  File inventory ({manifest.files?.length ?? 0})
                </summary>
                {(manifest.files?.length ?? 0) > 500 && (
                  <p>
                    Showing the first 500 files. Download the archive for the
                    complete inventory.
                  </p>
                )}
                <ul>
                  {(manifest.files ?? []).slice(0, 500).map((file) => (
                    <li key={file.path}>
                      {file.path} · {file.size} bytes
                    </li>
                  ))}
                </ul>
              </details>
              {!plan ? (
                <>
                  <button
                    className="action-button secondary"
                    disabled={busy}
                    onClick={() =>
                      setComponents(
                        Object.keys(manifest.components).filter(
                          (name) => manifest.components[name] === "included",
                        ),
                      )
                    }
                  >
                    Select all
                  </button>
                  <fieldset disabled={busy}>
                    <legend>Components to restore</legend>
                    {Object.entries(manifest.components).map(
                      ([name, state]) => (
                        <label
                          key={name}
                          style={{ display: "block", margin: "0.5rem 0" }}
                        >
                          <input
                            className="form-input"
                            type="checkbox"
                            disabled={state !== "included"}
                            checked={components.includes(name)}
                            onChange={(e) =>
                              setComponents(
                                e.target.checked
                                  ? [...components, name]
                                  : components.filter((c) => c !== name),
                              )
                            }
                          />
                          {labels[name]}
                          {state === "absent" ? " — absent in this backup" : ""}
                        </label>
                      ),
                    )}
                  </fieldset>
                  <button
                    className="action-button"
                    disabled={busy || !components.length}
                    onClick={review}
                  >
                    Review restore
                  </button>{" "}
                  <button
                    className="action-button secondary"
                    disabled={busy || !components.length}
                    onClick={() => review(true)}
                  >
                    Dry run
                  </button>
                </>
              ) : (
                <>
                  <h3>Replace on {selectedServer}</h3>
                  {plan.dry_run && (
                    <p role="status">
                      Dry run: {plan.checked_files} selected files copied and
                      checked in isolation. The server was not stopped.
                    </p>
                  )}
                  {plan.sufficient_space === false && (
                    <p role="alert">
                      Insufficient free space. Free storage and review again
                      before restoring.
                    </p>
                  )}
                  {!!plan.volumes?.length && (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Storage volume</th>
                          <th>Required</th>
                          <th>Available</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.volumes.map((volume, index) => (
                          <tr key={index}>
                            <td>{volume.roles.join(" + ")}</td>
                            <td>
                              {(volume.required_bytes / 1048576).toFixed(1)} MB
                            </td>
                            <td>
                              {(volume.available_bytes / 1048576).toFixed(1)} MB
                            </td>
                            <td>
                              {volume.sufficient
                                ? "Enough space"
                                : "Not enough space"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {components.some((component) =>
                    [
                      "script_config",
                      "bsm_settings",
                      "permissions.json",
                      "allowlist.json",
                    ].includes(component),
                  ) && (
                    <p className="message-warning" role="note">
                      This selection may replace script secrets, module
                      permissions, player access, or custom settings. Sensitive
                      values are hidden.
                    </p>
                  )}
                  <p>
                    A protected safety backup will be created before any files
                    are replaced.
                  </p>
                  <p>
                    {Object.entries(plan.change_counts ?? {})
                      .map(([action, count]) => `${count} ${action}`)
                      .join(" · ")}
                  </p>
                  <details>
                    <summary>File changes</summary>
                    <ul>
                      {(plan.changes ?? []).map((change) => (
                        <li key={`${change.component}:${change.path}`}>
                          {change.action}: {change.path}
                        </li>
                      ))}
                    </ul>
                    {plan.changes_truncated && (
                      <p>
                        Showing the first 1,000 changes. Totals include all
                        files.
                      </p>
                    )}
                  </details>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Setting</th>
                        <th>Current</th>
                        <th>Backup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(plan.setting_changes ?? []).map((change) => (
                        <tr key={`${change.component}:${change.key}`}>
                          <td>{change.key}</td>
                          <td>{change.before ?? "Absent"}</td>
                          <td>{change.after ?? "Absent"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ul>
                    {Object.entries(plan.destinations).map(
                      ([name, destination]) => (
                        <li key={name}>
                          {labels[name]} → {destination}
                        </li>
                      ),
                    )}
                  </ul>
                  {plan.warnings.map((warning) => (
                    <p key={warning} className="message-warning">
                      {warning}
                    </p>
                  ))}
                  <p>
                    Required staging and recovery space:{" "}
                    {(plan.required_bytes / 1048576).toFixed(1)} MB.
                  </p>
                  <label>
                    <input
                      className="form-input"
                      type="checkbox"
                      checked={restart}
                      disabled={busy}
                      onChange={(e) => setRestart(e.target.checked)}
                    />
                    Restart after success if the server was running
                  </label>
                  <div className="button-group">
                    <button
                      className="action-button secondary"
                      disabled={busy}
                      onClick={() => setPlan(null)}
                    >
                      Change selection
                    </button>
                    <button
                      className="action-button danger-button"
                      disabled={busy || plan.sufficient_space === false}
                      onClick={restore}
                    >
                      Restore
                    </button>
                  </div>
                </>
              )}
              {user?.role === "admin" && (
                <button
                  className="action-button secondary"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await confirmAction(
                        "Export an unencrypted copy containing server secrets?",
                      )
                    ) {
                      const blob = await perform(
                        "export_decrypted_snapshot",
                        { path: archivePath, body: {}, responseType: "blob" },
                        false,
                      );
                      if (blob) saveBlob(blob, "decrypted.bsmbackup");
                    }
                  }}
                >
                  Export decrypted
                </button>
              )}
            </>
          )}
          <details>
            <summary>Recovery key and destinations</summary>
            <form onSubmit={(event) => event.preventDefault()}>
              <label>
                Emergency-kit recovery key
                <input
                  className="form-input"
                  type="password"
                  name="recovery_key"
                  autoComplete="off"
                  onChange={(event) => {
                    secret.current = event.target.value;
                  }}
                />
              </label>
            </form>
            <button
              className="action-button secondary"
              disabled={busy || !selected.encrypted}
              onClick={() => manage(selected, "test_key")}
            >
              Test key
            </button>
            <label>
              Destination name
              <input
                className="form-input"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              />
            </label>
            <button
              className="action-button secondary"
              disabled={busy || !destination}
              onClick={() => manage(selected, "copy", { destination })}
            >
              Copy
            </button>
          </details>
          {user?.role === "admin" && (
            <details>
              <summary>Restore as a new server</summary>
              <p>
                Install a stopped server, remap its ports, then review and
                restore the prepared archive on that server. Autostart stays
                disabled.
              </p>
              <label>
                New server name
                <input
                  className="form-input"
                  value={copyName}
                  onChange={(event) => setCopyName(event.target.value)}
                />
              </label>
              <label>
                Bedrock version
                <input
                  className="form-input"
                  value={copyVersion}
                  onChange={(event) => setCopyVersion(event.target.value)}
                />
              </label>
              <label>
                IPv4 port
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  max="65535"
                  value={port}
                  onChange={(event) => setPort(Number(event.target.value))}
                />
              </label>
              <label>
                IPv6 port
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  max="65535"
                  value={portv6}
                  onChange={(event) => setPortv6(Number(event.target.value))}
                />
              </label>
              <button
                className="action-button"
                disabled={busy || !copyName}
                onClick={async () => {
                  if (
                    !(await confirmAction(
                      `Install a stopped server named ${copyName} for this backup?`,
                    ))
                  )
                    return;
                  const result = await perform("prepare_backup_copy", {
                    path: archivePath,
                    body: {
                      target_server: copyName,
                      target_version: copyVersion,
                      server_port: port,
                      server_portv6: portv6,
                    },
                  });
                  if (result) {
                    addToast(result.message, "success");
                    await refreshServers?.();
                    await setSelectedServer(result.server_name);
                  }
                }}
              >
                Prepare new server
              </button>
            </details>
          )}
          {progress && <p role="status">{progress}</p>}
        </Modal>
      )}
    </div>
  );
}
