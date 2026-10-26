import React, { useState } from "react";
import { callOperation } from "../api/operations";
import { useToast } from "../contexts/ToastContext";
import { useDialog } from "../contexts/DialogContext";

export default function BackupKeys() {
  const [keys, setKeys] = useState(null);
  const [busy, setBusy] = useState(false);
  const { addToast } = useToast();
  const { confirmAction } = useDialog();
  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      addToast(error.message || "Key operation failed.", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="settings-group">
      <h3>Recovery keys</h3>
      <p>
        Keep an emergency kit outside this host. Older archives still need their
        original keys. Key operations apply immediately.
      </p>
      <div className="button-group">
        <button
          type="button"
          className="action-button secondary"
          disabled={busy}
          onClick={() =>
            run(async () => setKeys(await callOperation("list_backup_keys")))
          }
        >
          Load recovery keys
        </button>
        <button
          type="button"
          className="action-button secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              if (
                !(await confirmAction(
                  "Generate a new active backup key? Older keys will be retained.",
                ))
              )
                return;
              await callOperation("rotate_backup_key");
              setKeys(await callOperation("list_backup_keys"));
            })
          }
        >
          Generate / rotate key
        </button>
      </div>
      {(keys?.keys ?? []).map((key) => (
        <div className="backup-destination" key={key.key_id}>
          <code>
            {key.key_id}
            {keys.active === key.key_id ? " (active)" : ""}
          </code>
          <button
            type="button"
            className="action-button secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const blob = await callOperation(
                  "download_backup_emergency_kit",
                  { path: { key_id: key.key_id }, responseType: "blob" },
                );
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = "bsm-backup-emergency-kit.txt";
                document.body.appendChild(anchor);
                try {
                  anchor.click();
                } finally {
                  anchor.remove();
                  URL.revokeObjectURL(url);
                }
              })
            }
          >
            Download emergency kit
          </button>
        </div>
      ))}
    </section>
  );
}
