import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { callOperation } from "../../api/operations";
import { queryClient } from "../../app/queryClient";
import { getPreferenceIdentity } from "../../app/backendIdentity";
import { useAuth } from "../../contexts/AuthContext";

export default function ServerAccessEditor({ userId, userRole }) {
  const { user, sessionGeneration } = useAuth();
  const identity = getPreferenceIdentity(user);
  const key = ["account-server-access", identity, sessionGeneration, userId];
  const access = useQuery(
    {
      queryKey: key,
      queryFn: ({ signal }) =>
        callOperation("get_account_server_access", {
          path: { user_id: userId },
          signal,
        }),
    },
    queryClient,
  );
  const servers = useQuery(
    {
      queryKey: ["access-servers", identity, sessionGeneration],
      queryFn: ({ signal }) => callOperation("list_access_servers", { signal }),
    },
    queryClient,
  );
  const policy = useQuery(
    {
      queryKey: ["access-policy", identity, sessionGeneration],
      queryFn: ({ signal }) => callOperation("get_access_policy", { signal }),
    },
    queryClient,
  );
  const [mode, setMode] = useState("all");
  const [grants, setGrants] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (access.data) {
      setMode(access.data.mode);
      setGrants(
        Object.fromEntries(
          access.data.grants.map((grant) => [
            grant.server_id,
            grant.permissions,
          ]),
        ),
      );
    }
  }, [access.data]);
  const capabilities =
    policy.data?.server_permissions.filter((permission) =>
      policy.data.role_permissions[userRole]?.includes(permission),
    ) ?? [];
  function toggle(serverId, permission) {
    setGrants((previous) => {
      const current = previous[serverId] ?? [];
      const next = current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...new Set(["servers:read", ...current, permission])];
      return {
        ...previous,
        [serverId]:
          permission === "servers:read" && current.includes(permission)
            ? []
            : next,
      };
    });
  }
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      await callOperation("set_account_server_access", {
        path: { user_id: userId },
        signal: abort.signal,
        body: {
          mode,
          grants: Object.entries(grants)
            .filter(([, permissions]) => permissions.length)
            .map(([server_id, permissions]) => ({ server_id, permissions })),
        },
      });
      setMessage("Server access saved.");
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  const failure =
    error ||
    access.error?.message ||
    policy.error?.message ||
    servers.error?.message;
  return (
    <section className="settings-panel" aria-labelledby="server-access-heading">
      <h3 id="server-access-heading">Server access</h3>
      <p>
        Assignments narrow the capabilities allowed by this account’s role. New
        servers receive no automatic grant in assigned mode.
      </p>
      {failure && <p role="alert">{failure}</p>}
      {message && <p role="status">{message}</p>}
      {access.isPending || servers.isPending || policy.isPending ? (
        <p role="status">Loading server access…</p>
      ) : (
        <>
          <label className="form-label">
            Access mode
            <select
              className="form-input"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="all">All servers allowed by role</option>
              <option value="assigned">Assigned servers only</option>
            </select>
          </label>
          {mode === "assigned" &&
            servers.data?.map((server) => (
              <details key={server.id}>
                <summary>
                  {server.name} · {grants[server.id]?.length ?? 0} capabilities
                </summary>
                <div className="access-choice-list">
                  {capabilities.map((permission) => (
                    <label key={permission}>
                      <input
                        type="checkbox"
                        checked={
                          grants[server.id]?.includes(permission) ?? false
                        }
                        onChange={() => toggle(server.id, permission)}
                      />
                      {permission}
                    </label>
                  ))}
                </div>
              </details>
            ))}
          <button
            type="button"
            className="action-button primary-button"
            disabled={busy || Boolean(failure)}
            onClick={save}
          >
            Save server access
          </button>
        </>
      )}
    </section>
  );
}
