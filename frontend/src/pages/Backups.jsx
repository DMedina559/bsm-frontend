import React, { useEffect, useRef, useState } from "react";
import {
  Archive,
  Download,
  RefreshCw,
  RotateCcw,
  Shield,
  Trash2,
} from "lucide-react";
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
};
const unlockOperations = new Set([
  "inspect_server_snapshot",
  "plan_snapshot_restore",
  "restore_server_snapshot",
  "export_decrypted_snapshot",
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
  const { selectedServer } = useServer();
  const { user, sessionGeneration } = useAuth();
  const { confirmAction } = useDialog();
  const { addToast } = useToast();
  const snapshots = useResourceQuery("snapshots", selectedServer);
  const legacy = useResourceQuery("backups", selectedServer);
  const recovery = useResourceQuery("backupRecovery", selectedServer);
  const [encryption, setEncryption] = useState("default");
  const [selected, setSelected] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [components, setComponents] = useState([]);
  const [plan, setPlan] = useState(null);
  const [restart, setRestart] = useState(true);
  const [progress, setProgress] = useState("");
  const [keyDialog, setKeyDialog] = useState(false);
  const [keys, setKeys] = useState(null);
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
  const archivePath = selected
    ? { ...path, backup_id: selected.backup_id }
    : path;
  const create = async () => {
    const encrypted =
      encryption === "default" ? null : encryption === "encrypted";
    const result = await perform("create_server_snapshot", {
      path,
      body: { encrypted },
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
  const review = async () => {
    const result = await perform("plan_snapshot_restore", {
      path: archivePath,
      body: { components },
    });
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
  const download = async (item) => {
    const blob = await perform(
      "download_server_snapshot",
      { path: { ...path, backup_id: item.backup_id }, responseType: "blob" },
      false,
    );
    if (blob) saveBlob(blob, item.filename);
  };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await perform("import_server_snapshot", {
      path,
      body: { file },
    });
    if (result) {
      secret.current = "";
      if (input.current) input.current.value = "";
      await snapshots.refetch();
      addToast("Backup imported and validated.", "success");
    }
    event.target.value = "";
  };
  const manageKeys = async () => {
    const result = await perform("list_backup_keys");
    if (result) {
      setKeys(result);
      setKeyDialog(true);
    }
  };
  if (!selectedServer)
    return <div className="container">Select a server to manage backups.</div>;
  return (
    <div className="container">
      <div className="header">
        <h1>
          <Archive size={24} /> Backups: {selectedServer}
        </h1>
        <div className="button-group">
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
            onClick={async () => {
              if (
                await confirmAction(
                  "Prune completed archives using the retention setting? Zero disables automatic pruning.",
                )
              )
                await perform("prune_backups", { path });
            }}
          >
            <Trash2 size={16} /> Prune old
          </button>
          {user?.role === "admin" && (
            <button
              className="action-button secondary"
              disabled={busy}
              onClick={manageKeys}
            >
              <Shield size={16} /> Encryption keys
            </button>
          )}
        </div>
      </div>
      <QueryStatus query={snapshots} />
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
      <section
        className="card"
        style={{ padding: "1rem", marginBottom: "1rem" }}
      >
        <p>
          One archive contains the active world, configuration, script secrets,
          and BSM server settings.
        </p>
        <label>
          Encryption{" "}
          <select
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
          <label>
            Recovery key (if encrypted){" "}
            <input
              ref={input}
              type="password"
              autoComplete="off"
              onChange={(e) => {
                secret.current = e.target.value;
              }}
            />
          </label>
          <label>
            Backup file{" "}
            <input
              type="file"
              accept=".bsmbackup,.tar"
              disabled={busy}
              onChange={upload}
            />
          </label>
        </details>
      </section>
      {progress && <p role="status">{progress}</p>}
      <div style={{ overflowX: "auto" }}>
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
            {(snapshots.data ?? []).map((item) => (
              <tr key={item.backup_id}>
                <td>
                  {item.filename}
                  {item.error && <p role="alert">{item.error}</p>}
                </td>
                <td>{(item.size / 1048576).toFixed(1)} MB</td>
                <td>{item.encrypted ? "Encrypted" : "Unencrypted"}</td>
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
                    }}
                  >
                    <RotateCcw size={14} /> Inspect / restore
                  </button>
                </td>
              </tr>
            ))}
            {snapshots.data?.length === 0 && (
              <tr>
                <td colSpan={4}>No server backups yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <details>
        <summary>Legacy backups</summary>
        <p>
          These files are independent snapshots. Restore each explicitly; they
          do not form one historical backup.
        </p>
        <QueryStatus query={legacy} />
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
          title={`Restore ${selected.filename}`}
          onClose={reset}
          closeDisabled={busy}
        >
          {!manifest ? (
            <>
              <p>
                Validate and inspect this archive before choosing what to
                restore.
              </p>
              {selected.encrypted && (
                <label>
                  Recovery key (leave blank to use the stored key)
                  <input
                    type="password"
                    autoComplete="off"
                    onChange={(e) => {
                      secret.current = e.target.value;
                    }}
                  />
                </label>
              )}
              <button
                className="action-button"
                disabled={busy}
                onClick={inspect}
              >
                Unlock and inspect
              </button>
            </>
          ) : (
            <>
              <p>
                Captured {new Date(manifest.created_at).toLocaleString()} from{" "}
                {manifest.source_server}, world {manifest.source_world}. Bedrock{" "}
                {manifest.bedrock_version}; BSM {manifest.bsm_version}.
              </p>
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
                    Select all available
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
                  </button>
                </>
              ) : (
                <>
                  <h3>Replace on {selectedServer}</h3>
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
                      disabled={busy}
                      onClick={restore}
                    >
                      Restore selected components
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
                  Export decrypted copy
                </button>
              )}
            </>
          )}
          {progress && <p role="status">{progress}</p>}
        </Modal>
      )}
      {keyDialog && (
        <Modal
          title="Backup encryption keys"
          onClose={() => setKeyDialog(false)}
          closeDisabled={busy}
        >
          <p>
            Download your emergency kit and store it outside this host. Rotating
            the active key preserves older keys.
          </p>
          <button
            className="action-button"
            disabled={busy}
            onClick={async () => {
              if (
                await confirmAction(
                  "Generate a new active backup key? Older keys will be retained.",
                )
              ) {
                await perform("rotate_backup_key");
                setKeys(await perform("list_backup_keys"));
              }
            }}
          >
            Generate / rotate key
          </button>
          {(keys?.keys ?? []).map((key) => (
            <p key={key.key_id}>
              {key.key_id}
              {keys.active === key.key_id ? " (active)" : ""}{" "}
              <button
                className="action-button secondary"
                disabled={busy}
                onClick={async () => {
                  const blob = await perform(
                    "download_backup_emergency_kit",
                    { path: { key_id: key.key_id }, responseType: "blob" },
                    false,
                  );
                  if (blob) saveBlob(blob, "bsm-backup-emergency-kit.txt");
                }}
              >
                Download emergency kit
              </button>
            </p>
          ))}
          <button
            className="action-button secondary"
            disabled={busy || !keys?.active}
            onClick={async () => {
              await perform("set_setting", {
                body: { key: "backups.encryption", value: true },
              });
              addToast("Encryption enabled for automatic backups.", "success");
            }}
          >
            Encrypt automatic backups
          </button>{" "}
          <button
            className="action-button secondary"
            disabled={busy}
            onClick={async () => {
              if (
                await confirmAction(
                  "Disable encryption for future automatic backups?",
                )
              )
                await perform("set_setting", {
                  body: { key: "backups.encryption", value: false },
                });
            }}
          >
            Disable default encryption
          </button>
        </Modal>
      )}
    </div>
  );
}
