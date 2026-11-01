import React, { useEffect, useState } from "react";
import { callOperation } from "../../api/operations";
import {
  getBackendIdentity,
  getPreferenceIdentity,
} from "../../app/backendIdentity";
import { useAuth } from "../../contexts/AuthContext";

/** Advisory metadata only. The write operation always revalidates current policy. */
export default function AccessPreview({
  operation,
  body,
  path,
  enabled = true,
  servers = [],
}) {
  const { user, sessionGeneration } = useAuth();
  const identity = getPreferenceIdentity(user);
  const serialized = JSON.stringify(body);
  const serializedPath = JSON.stringify(path ?? {});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const refresh = (event) => {
      if (event.detail?.backend === getBackendIdentity())
        setRetry((value) => value + 1);
    };
    window.addEventListener("bsm:access-changed", refresh);
    window.addEventListener("bsm:security-verified", refresh);
    return () => {
      window.removeEventListener("bsm:access-changed", refresh);
      window.removeEventListener("bsm:security-verified", refresh);
    };
  }, [identity, sessionGeneration]);
  const key = JSON.stringify([
    identity,
    sessionGeneration,
    operation,
    serialized,
    serializedPath,
    retry,
  ]);
  const [record, setRecord] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    setRecord(null);
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await callOperation(operation, {
          body: JSON.parse(serialized),
          path: JSON.parse(serializedPath),
          signal: abort.signal,
        });
        if (
          !Array.isArray(data?.effective_permissions) ||
          !Array.isArray(data?.requested_permissions) ||
          !Array.isArray(data?.unavailable_permissions) ||
          !data?.server_permissions ||
          typeof data.policy_revision !== "string"
        )
          throw new Error("Backend did not return an access preview.");
        if (!abort.signal.aborted) setRecord({ key, data });
      } catch (failure) {
        if (!abort.signal.aborted) setRecord({ key, error: failure.message });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [
    enabled,
    identity,
    sessionGeneration,
    operation,
    serialized,
    serializedPath,
    key,
  ]);
  if (!enabled)
    return (
      <p className="help-text">
        Complete the credential details to preview effective access.
      </p>
    );
  const current = record?.key === key ? record : null;
  return (
    <section className="access-preview" aria-label="Effective access preview">
      <h4>Effective access preview</h4>
      {!current && <p role="status">Checking current access…</p>}
      {current?.error && (
        <p role="status">
          Preview unavailable: {current.error}{" "}
          <button
            type="button"
            className="action-button secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry preview
          </button>
        </p>
      )}
      {current?.data && (
        <>
          <p>
            {current.data.effective_permissions.length} effective capabilities ·{" "}
            {current.data.requested_permissions.length} requested
          </p>
          {current.data.unavailable_permissions.length > 0 && (
            <div className="message warning">
              <strong>
                Unavailable under the current role or server limits
              </strong>
              <ul>
                {current.data.unavailable_permissions.map((value) => (
                  <li key={value}>
                    <code>{value}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details>
            <summary>Effective capabilities</summary>
            <ul className="security-permissions">
              {current.data.effective_permissions.map((value) => (
                <li key={value}>
                  <code>{value}</code>
                </li>
              ))}
            </ul>
          </details>
          {Object.entries(current.data.server_permissions).map(
            ([id, permissions]) => (
              <details key={id}>
                <summary>
                  {servers.find((server) => server.id === id)?.name ?? id} ·{" "}
                  {permissions.length} capabilities
                </summary>
                <ul className="security-permissions">
                  {permissions.map((value) => (
                    <li key={value}>
                      <code>{value}</code>
                    </li>
                  ))}
                </ul>
              </details>
            ),
          )}
          <p className="help-text">
            Policy revision: <code>{current.data.policy_revision}</code>. Access
            is checked again when you save.
          </p>
        </>
      )}
    </section>
  );
}
