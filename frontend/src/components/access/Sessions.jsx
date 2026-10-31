import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Monitor, Radio, ShieldCheck } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useDialog } from "../../contexts/DialogContext";
import { useTimeFormat } from "../../app/useTimeFormat";
import { getPreferenceIdentity } from "../../app/backendIdentity";
import { queryClient } from "../../app/queryClient";
import { callOperation } from "../../api/operations";

function SessionRow({ record, admin, busy, perform, time }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(record.name);
  return (
    <article className="security-session">
      <div className="security-session-icon">
        <Monitor size={22} aria-hidden="true" />
      </div>
      <div className="security-session-detail">
        <div className="security-session-title">
          <strong>{record.name}</strong>
          {record.current && <span className="badge">This session</span>}
          <span className={`security-state ${record.active ? "active" : ""}`}>
            {record.revoked_at
              ? "Signed out"
              : record.active
                ? "Active"
                : "Expired"}
          </span>
        </div>
        <p>
          Last active {time.format(record.last_seen_at, { unit: "seconds" })}
        </p>
        <p className="help-text">
          Signed in {time.format(record.created_at, { unit: "seconds" })} ·
          Expires {time.format(record.expires_at, { unit: "seconds" })}
        </p>
        {record.connected && (
          <p className="security-live">
            <Radio size={13} aria-hidden="true" />
            Live socket on this instance
          </p>
        )}
        <details>
          <summary>Connection details</summary>
          <dl className="security-connection">
            <dt>IP address</dt>
            <dd>{record.ip_address || "Not recorded"}</dd>
            <dt>Client hint</dt>
            <dd>{record.user_agent || "Not recorded"}</dd>
          </dl>
        </details>
        {renaming && (
          <form
            className="security-rename"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await perform("rename", record.id, name)) setRenaming(false);
            }}
          >
            <input
              className="form-input"
              aria-label="Session name"
              maxLength={100}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button className="action-button secondary" disabled={busy}>
              Save name
            </button>
          </form>
        )}
      </div>
      <div className="security-session-actions">
        {!admin && record.active && (
          <button
            className="action-button secondary"
            disabled={busy}
            onClick={() => setRenaming(!renaming)}
          >
            Rename
          </button>
        )}
        {record.active && (
          <button
            className="action-button danger"
            disabled={busy}
            onClick={() => perform("revoke", record.id)}
          >
            Sign out {record.current ? "this session" : record.name}
          </button>
        )}
      </div>
    </article>
  );
}

export default function Sessions({ userId }) {
  const { user, sessionGeneration, logout } = useAuth();
  const { confirmAction } = useDialog();
  const time = useTimeFormat();
  const admin = userId != null;
  const identity = getPreferenceIdentity(user);
  const key = [
    "login-sessions",
    identity,
    sessionGeneration,
    userId ?? user?.id,
  ];
  const rows = useQuery(
    {
      queryKey: key,
      queryFn: ({ signal }) =>
        admin
          ? callOperation("list_account_login_sessions", {
              path: { user_id: userId },
              signal,
            })
          : callOperation("list_login_sessions", { signal }),
      refetchInterval: 60000,
    },
    queryClient,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function perform(action, id, name) {
    if (
      action !== "rename" &&
      !(await confirmAction(
        action === "others"
          ? "Sign out every other login? Integration credentials will keep working."
          : action === "all"
            ? "Sign out all logins, including this one? Integration credentials will keep working."
            : "Sign out this login and close its live connections?",
      ))
    )
      return false;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    try {
      if (action === "admin-all")
        await callOperation("revoke_account_login_sessions", {
          path: { user_id: userId },
          signal: abort.signal,
        });
      else if (action === "reset-mfa")
        await callOperation("reset_account_mfa", {
          path: { user_id: userId },
          signal: abort.signal,
        });
      else if (action === "rename")
        await callOperation("rename_login_session", {
          path: { session_id: id },
          body: { name },
          signal: abort.signal,
        });
      else if (action === "others" || action === "all")
        await callOperation("revoke_login_sessions", {
          body: { mode: action === "all" ? "all" : "others" },
          signal: abort.signal,
        });
      else if (admin)
        await callOperation("revoke_account_login_session", {
          path: { user_id: userId, session_id: id },
          signal: abort.signal,
        });
      else
        await callOperation("revoke_login_session", {
          path: { session_id: id },
          signal: abort.signal,
        });
      if (
        !admin &&
        (action === "all" ||
          (action === "revoke" &&
            rows.data?.find((row) => row.id === id)?.current))
      )
        await logout();
      else await queryClient.invalidateQueries({ queryKey: key });
      return true;
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure.message);
      return false;
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="security-sessions"
      aria-label={admin ? "Account login sessions" : "Your login sessions"}
    >
      <div className="section-heading">
        <ShieldCheck size={20} />
        <div>
          <h3>{admin ? "Login sessions" : "Where you’re signed in"}</h3>
          <p>
            Device labels are hints. Last activity includes authenticated
            requests and background polling.
          </p>
        </div>
      </div>
      {rows.isPending && <p role="status">Loading sessions…</p>}
      {(error || rows.error) && (
        <p role="alert">{error || rows.error.message}</p>
      )}
      <div className="security-session-list">
        {rows.data?.map((record) => (
          <SessionRow
            key={record.id}
            {...{ record, admin, busy, perform, time }}
          />
        ))}
      </div>
      {rows.data?.length === 0 && <p>No recorded sessions.</p>}
      {admin && (
        <div className="form-actions">
          <button
            className="action-button danger"
            disabled={busy}
            onClick={() => perform("admin-all")}
          >
            Sign out all account sessions
          </button>
          <button
            className="action-button secondary"
            disabled={busy}
            onClick={() => perform("reset-mfa")}
          >
            Reset second factor
          </button>
        </div>
      )}
      {!admin && (
        <div className="form-actions">
          <button
            className="action-button secondary"
            disabled={busy || rows.isPending}
            onClick={() => perform("others")}
          >
            Sign out other sessions
          </button>
          <button
            className="action-button danger"
            disabled={busy || rows.isPending}
            onClick={() => perform("all")}
          >
            Sign out everywhere
          </button>
        </div>
      )}
      <p className="help-text">
        Session revocation takes effect on subsequent requests and closes the
        session’s live sockets. Integration credentials are managed separately.
      </p>
    </section>
  );
}
