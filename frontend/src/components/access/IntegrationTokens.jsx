import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { callOperation } from "../../api/operations";
import { queryClient } from "../../app/queryClient";
import { getPreferenceIdentity } from "../../app/backendIdentity";
import { useTimeFormat } from "../../app/useTimeFormat";
import { useDialog } from "../../contexts/DialogContext";
import { useAuth } from "../../contexts/AuthContext";

export default function IntegrationTokens() {
  const { user, sessionGeneration } = useAuth();
  const { confirmAction } = useDialog();
  const [preset, setPreset] = useState("monitoring");
  const time = useTimeFormat();
  const identity = getPreferenceIdentity(user);
  const key = ["integration-tokens", identity, sessionGeneration];
  const tokens = useQuery(
    {
      queryKey: key,
      queryFn: ({ signal }) =>
        callOperation("list_integration_tokens", { signal }),
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
  const servers = useQuery(
    {
      queryKey: ["access-servers", identity, sessionGeneration],
      queryFn: ({ signal }) => callOperation("list_access_servers", { signal }),
    },
    queryClient,
  );
  const [name, setName] = useState("");
  const [days, setDays] = useState(30);
  const [neverExpire, setNeverExpire] = useState(false);
  const [permissions, setPermissions] = useState([
    "account:read",
    "health:read",
    "servers:read",
    "tasks:read",
  ]);
  const [allServers, setAllServers] = useState(true);
  const [selected, setSelected] = useState([]);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const refresh = () =>
      void queryClient.invalidateQueries({
        queryKey: ["integration-tokens", identity],
      });
    window.addEventListener("bsm:credentials-changed", refresh);
    return () => window.removeEventListener("bsm:credentials-changed", refresh);
  }, [identity]);
  const toggle = (values, value) =>
    values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCreated(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      // The one-time secret deliberately stays outside query/mutation caches.
      const result = await callOperation("create_integration_token", {
        signal: abort.signal,
        body: {
          name,
          expires_in_days: neverExpire ? null : days,
          permissions,
          server_ids: allServers ? null : selected,
        },
      });
      setCreated(result.token);
      setName("");
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  async function revoke(id) {
    if (
      !(await confirmAction(
        "Revoke this integration credential and close its live connections?",
      ))
    )
      return;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      await callOperation("revoke_integration_token", {
        path: { token_id: id },
        signal: abort.signal,
      });
      setCreated(null);
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  async function rotate(id) {
    if (
      !(await confirmAction(
        "Replace this credential immediately? Its old secret will stop working. Copy the new secret before leaving this page.",
      ))
    )
      return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    try {
      const result = await callOperation("rotate_integration_token", {
        path: { token_id: id },
        signal: abort.signal,
      });
      if (!abort.signal.aborted) setCreated(result.token);
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure.message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  async function revokeAll() {
    if (
      !(await confirmAction(
        "Revoke every integration credential? Home Assistant, Supervisor, and other integrations using them will stop working. Your login sessions will remain signed in.",
      ))
    )
      return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    try {
      await callOperation("revoke_all_integration_tokens", {
        signal: abort.signal,
      });
      setCreated(null);
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure.message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  const presets = {
    monitoring: ["account:read", "health:read", "servers:read", "tasks:read"],
    operator: [
      "account:read",
      "health:read",
      "servers:read",
      "servers:inspect",
      "servers:control",
      "logs:read",
      "tasks:read",
    ],
    backups: [
      "account:read",
      "health:read",
      "servers:read",
      "backups:read",
      "backups:create",
      "tasks:read",
    ],
  };
  const failure =
    error ||
    tokens.error?.message ||
    policy.error?.message ||
    servers.error?.message;
  return (
    <section
      className="settings-panel"
      aria-labelledby="integration-credentials-heading"
    >
      <div className="section-heading">
        <div>
          <h2 id="integration-credentials-heading">Integration credentials</h2>
          <p>
            Give Home Assistant, Supervisor, or another integration its own
            revocable credential.
          </p>
        </div>
      </div>
      {failure && <p role="alert">{failure}</p>}
      {(tokens.isPending || policy.isPending || servers.isPending) && (
        <p role="status">Loading access settings…</p>
      )}
      {created && (
        <div className="alert alert-info">
          <p>Copy this credential now. It will not be shown again.</p>
          <textarea
            aria-label="New integration credential"
            readOnly
            value={created}
            rows={3}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="action-button secondary"
            onClick={() =>
              navigator.clipboard
                .writeText(created)
                .catch(() =>
                  setError("Copy the credential from the field above."),
                )
            }
          >
            Copy credential
          </button>
          <button
            type="button"
            className="action-button secondary"
            onClick={() => setCreated(null)}
          >
            Dismiss credential
          </button>
        </div>
      )}
      {policy.data && (
        <form onSubmit={create}>
          <label className="form-label">
            Credential name
            <input
              className="form-input"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Home Assistant"
            />
          </label>
          <label className="form-label">
            <input
              type="checkbox"
              checked={neverExpire}
              onChange={(event) => setNeverExpire(event.target.checked)}
            />
            Never expire
          </label>
          <label className="form-label">
            Expires after days
            <input
              className="form-input"
              type="number"
              min={1}
              max={365}
              required={!neverExpire}
              disabled={neverExpire}
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            />
          </label>
          <label className="form-label">
            Permission preset
            <select
              className="form-input"
              value={preset}
              onChange={(event) => {
                const value = event.target.value;
                setPreset(value);
                if (presets[value])
                  setPermissions(
                    presets[value].filter((permission) =>
                      policy.data.token_permissions.includes(permission),
                    ),
                  );
              }}
            >
              <option value="monitoring">Monitoring</option>
              <option
                value="operator"
                disabled={
                  !policy.data.token_permissions.includes("servers:control")
                }
              >
                Server operator
              </option>
              <option
                value="backups"
                disabled={
                  !policy.data.token_permissions.includes("backups:create")
                }
              >
                Backup automation
              </option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <details>
            <summary>Allowed capabilities ({permissions.length})</summary>
            <div className="access-choice-list">
              {policy.data.token_permissions.map((permission) => (
                <label key={permission}>
                  <input
                    type="checkbox"
                    checked={permissions.includes(permission)}
                    onChange={() => {
                      setPreset("custom");
                      setPermissions(toggle(permissions, permission));
                    }}
                  />
                  {permission}
                  <small>{policy.data.permissions[permission]}</small>
                </label>
              ))}
            </div>
          </details>
          <label>
            <input
              type="checkbox"
              checked={allServers}
              onChange={(event) => setAllServers(event.target.checked)}
            />
            All servers this account may access
          </label>
          {!allServers && (
            <div className="access-choice-list">
              {servers.data?.map((server) => (
                <label key={server.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(server.id)}
                    onChange={() => setSelected(toggle(selected, server.id))}
                  />
                  {server.name}
                </label>
              ))}
            </div>
          )}
          <p>
            Credentials cannot exceed your account’s role or server assignments.
            They cannot manage accounts or create more credentials.
          </p>
          <button
            className="action-button primary-button"
            type="submit"
            disabled={
              busy || !permissions.length || (!allServers && !selected.length)
            }
          >
            Create credential
          </button>
        </form>
      )}
      <div className="access-credentials-list">
        {tokens.data?.map((token) => (
          <div key={token.id} className="access-credential-row">
            <div>
              <strong>{token.name}</strong>
              <p>
                {token.revoked_at
                  ? "Revoked"
                  : token.expires_at === null
                    ? "Never expires"
                    : token.expires_at * 1000 <= now
                      ? "Expired"
                      : `Expires ${time.format(token.expires_at, { unit: "seconds", kind: "date" })}`}
              </p>
              <details>
                <summary>
                  {token.permissions.length} permissions ·{" "}
                  {token.server_ids === null
                    ? "All permitted servers"
                    : `${token.server_ids?.length ?? 0} selected servers`}
                </summary>
                <ul className="security-permissions">
                  {token.permissions.map((permission) => (
                    <li key={permission}>
                      <code>{permission}</code>
                    </li>
                  ))}
                </ul>
                {token.server_ids?.map((id) => (
                  <p key={id} className="help-text">
                    {servers.data?.find((server) => server.id === id)?.name ??
                      `Removed or inaccessible server (${id})`}
                  </p>
                ))}
              </details>
              <small>
                {token.last_used_at
                  ? `Last used ${time.format(token.last_used_at, { unit: "seconds" })}`
                  : "Not used yet"}
              </small>
            </div>
            <div className="security-session-actions">
              {!token.revoked_at &&
                (token.expires_at === null ||
                  token.expires_at * 1000 > now) && (
                  <button
                    className="action-button secondary"
                    disabled={busy}
                    onClick={() => rotate(token.id)}
                  >
                    Rotate {token.name}
                  </button>
                )}
              <button
                className="action-button danger"
                type="button"
                disabled={busy || Boolean(token.revoked_at)}
                onClick={() => revoke(token.id)}
              >
                Revoke {token.name}
              </button>
            </div>
          </div>
        ))}
        {tokens.data?.length === 0 && <p>No integration credentials.</p>}
      </div>
      {tokens.data?.some((token) => !token.revoked_at) && (
        <button
          className="action-button danger"
          disabled={busy}
          onClick={revokeAll}
        >
          Revoke all integration credentials
        </button>
      )}
    </section>
  );
}
