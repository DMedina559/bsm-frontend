import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePublicQuery } from "../app/publicRequests";
import { getAppConfig } from "../app/config";
import { inspectBackendContract } from "../api/operations";
import { contractMetadata } from "@bedrock-server-manager/api-client/metadata";
export default function BackendCompatibility() {
  const { user } = useAuth();
  const query = usePublicQuery(
    ["backend-capabilities"],
    ({ signal }) => inspectBackendContract({ signal }),
    {
      enabled: Boolean(user) && getAppConfig().mode === "standalone",
      staleTime: Infinity,
      gcTime: 300000,
    },
  );
  if (!user || getAppConfig().mode !== "standalone") return null;
  if (query.error)
    return (
      <p role="status" className="message message-warning">
        Backend compatibility could not be verified. {query.error.message}
      </p>
    );
  if (!query.data?.missing.length) return null;
  return (
    <details className="message message-warning">
      <summary>
        This backend lacks {query.data.missing.length} operations used by this
        UI.
      </summary>
      <p>
        Some features may be unavailable. UI contract:{" "}
        {contractMetadata.schemaHash.slice(0, 12)}.
      </p>
      <ul>
        {query.data.missing.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
    </details>
  );
}
