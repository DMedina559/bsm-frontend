import { useAuth } from "../contexts/AuthContext";
import React, { useEffect, useRef, useState } from "react";
import { callOperation } from "../api/operations";
import { useResourceMutation } from "../app/resourceQueries";
import { queryKeys } from "../app/queryKeys";
import { useDialog } from "../contexts/DialogContext";
import { useToast } from "../contexts/ToastContext";

export default function DestinationCleanup(props) {
  const { sessionGeneration, loading, user } = useAuth();
  if (loading || !user) return null;
  return (
    <Cleanup
      key={`${sessionGeneration}:${props.serverName}:${props.destination}`}
      {...props}
    />
  );
}

function Cleanup({ serverName, destination }) {
  const [plan, setPlan] = useState(null);
  const scope = useRef(null);
  const { confirmAction } = useDialog();
  const { addToast } = useToast();
  useEffect(() => {
    const controller = new AbortController();
    scope.current = controller;
    return () => controller.abort();
  }, []);
  const write = useResourceMutation(
    async (token, { session }) => {
      const signal = scope.current.signal;
      const result = await callOperation("cleanup_backup_destination", {
        path: { server_name: serverName, destination },
        body: { token },
        session,
        signal,
      });
      for (;;) {
        signal.throwIfAborted();
        const task = await callOperation("get_task_status", {
          path: { task_id: result.task_id },
          session,
          signal,
        });
        if (task.status === "completed") return task.result.plan;
        if (["failed", "cancelled"].includes(task.status))
          throw new Error(
            task.error?.message || task.message || "Cleanup failed.",
          );
        await new Promise((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(new DOMException("Cancelled", "AbortError"));
          };
          const timer = setTimeout(() => {
            signal.removeEventListener("abort", abort);
            resolve();
          }, 500);
          signal.addEventListener("abort", abort, { once: true });
        });
      }
    },
    [queryKeys.serverBackups(serverName)],
  );
  const run = async (token) => {
    try {
      const next = await write.mutateAsync(token);
      if (!scope.current.signal.aborted) setPlan(next);
    } catch (error) {
      if (error.name !== "AbortError") addToast(error.message, "error");
      setPlan(null);
    }
  };
  return (
    <div className="destination-cleanup">
      <button
        type="button"
        className="action-button secondary"
        disabled={!serverName || write.isPending}
        onClick={() => run(null)}
      >
        Preview external cleanup
      </button>
      {plan && (
        <div role="status">
          <p>
            {plan.delete.length} copies eligible ·{" "}
            {(plan.reclaim_bytes / 1073741824).toFixed(2)} GiB reclaimable.{" "}
            {plan.retain.length} retained.
          </p>
          <ul>
            {plan.delete.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {plan.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          {plan.applied ? (
            <p>Cleanup completed.</p>
          ) : (
            <button
              type="button"
              className="action-button danger"
              disabled={write.isPending || !plan.delete.length}
              onClick={async () => {
                if (
                  await confirmAction(
                    `Permanently remove these ${plan.delete.length} external copies? Local archives are unaffected.`,
                  )
                )
                  await run(plan.token);
              }}
            >
              Delete reviewed copies
            </button>
          )}
        </div>
      )}
      <small className="form-help-text">
        Uses the saved destination policy for the selected server. Save policy
        edits before previewing.
      </small>
    </div>
  );
}
