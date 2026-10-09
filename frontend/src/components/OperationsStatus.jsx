import React from "react";
import { useOperations } from "../app/useOperations";
import { operationCoordinator } from "../app/operationCoordinator";
export default function OperationsStatus() {
  const operations = useOperations();
  if (!operations.length) return null;
  const active = operations.filter(
    (operation) => !operation.terminal && operation.status !== "unknown",
  );
  return (
    <details className="operation-status">
      <summary>{active.length} active operations</summary>
      <ul>
        {operations
          .slice(-20)
          .reverse()
          .map((operation) => (
            <li key={operation.id}>
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
              {operation.error && (
                <p role="alert">
                  {typeof operation.error === "string"
                    ? operation.error
                    : (operation.error.message ?? "Operation failed")}
                </p>
              )}
              {(operation.terminal || operation.status === "unknown") && (
                <button
                  type="button"
                  onClick={() => operationCoordinator.remove(operation.id)}
                >
                  Dismiss
                </button>
              )}
            </li>
          ))}
      </ul>
    </details>
  );
}
