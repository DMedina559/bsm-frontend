import React, { useState } from "react";
import { Activity } from "lucide-react";
import Modal from "./Modal";
import TaskOutcome from "./TaskOutcome";
import "../styles/operations.css";
import { useResourceQuery } from "../app/resourceQueries";
import { terminalTaskStatus } from "../app/stateReconciler";
import { useOperations } from "../app/useOperations";
import { operationCoordinator } from "../app/operationCoordinator";
export default function OperationsStatus() {
  const tracked = useOperations();
  const { data: tasks = [] } = useResourceQuery("tasks", null, {
    refetchInterval: 15000,
  });
  const backendIds = new Set(tasks.map((task) => String(task.id)));
  const operations = [
    ...tracked.filter((operation) => !backendIds.has(operation.id)),
    ...tasks.map((task) => {
      const previous = tracked.find(
        (operation) => operation.id === String(task.id),
      );
      return {
        ...previous,
        id: String(task.id),
        kind: previous?.kind || "Background task",
        status: task.status,
        terminal: terminalTaskStatus(task.status),
        task,
        error: task.error,
      };
    }),
  ];
  const [open, setOpen] = useState(false);
  if (!operations.length && !open) return null;
  const active = operations.filter(
    (operation) => !operation.terminal && operation.status !== "unknown",
  );
  return (
    <>
      <button
        type="button"
        className="operations-trigger"
        onClick={() => setOpen(true)}
        aria-label={`${active.length} active ${active.length === 1 ? "operation" : "operations"}. View operations`}
        aria-haspopup="dialog"
      >
        <Activity size={16} aria-hidden="true" />
        <span className="operations-trigger-label">Operations</span>
        <span className="operations-count">{active.length}</span>
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Operations"
        className="operations-dialog"
      >
        <p className="operations-summary">
          {active.length} active · {operations.length - active.length} finished
          or unavailable
        </p>
        {!operations.length && <p>No operations to show.</p>}
        <ul className="operations-list">
          {operations
            .slice(-20)
            .reverse()
            .map((operation) => (
              <li key={operation.id} className="operations-item">
                <strong>
                  {operation.serverName ? `${operation.serverName}: ` : ""}
                  {operation.kind}
                </strong>{" "}
                — {operation.status}
                {Number.isFinite(operation.progress) && (
                  <progress
                    max="100"
                    value={Math.max(0, Math.min(100, operation.progress))}
                    aria-label={`${operation.kind} progress`}
                  />
                )}
                {operation.task?.message && (
                  <p className="operation-message">{operation.task.message}</p>
                )}
                <TaskOutcome
                  result={operation.task?.result}
                  error={operation.error}
                />
                {!backendIds.has(operation.id) &&
                  (operation.terminal || operation.status === "unknown") && (
                    <button
                      type="button"
                      onClick={() => operationCoordinator.remove(operation.id)}
                      className="action-button secondary"
                      aria-label={`Dismiss ${operation.kind}${operation.serverName ? ` for ${operation.serverName}` : ""}`}
                    >
                      Dismiss
                    </button>
                  )}
              </li>
            ))}
        </ul>
      </Modal>
    </>
  );
}
