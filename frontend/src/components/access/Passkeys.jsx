import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { callOperation } from "../../api/operations";
import { queryClient } from "../../app/queryClient";
import { getPreferenceIdentity } from "../../app/backendIdentity";
import {
  createPasskeyCredential,
  isPasskeySupported,
} from "../../app/passkeys";
import { trustedDeviceOptions } from "../../app/trustedDevices";
import { useTimeFormat } from "../../app/useTimeFormat";
import { useAuth } from "../../contexts/AuthContext";
import { useDialog } from "../../contexts/DialogContext";

function PasskeyRow({ record, admin, busy, canRevoke, perform, time }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(record.name);
  useEffect(() => {
    setName(record.name);
  }, [record.name]);
  return (
    <article className="security-session">
      <div className="security-session-icon">
        <KeyRound size={22} aria-hidden="true" />
      </div>
      <div className="security-session-detail">
        <div className="security-session-title">
          <strong>{record.name}</strong>
          <span className={`security-state ${record.active ? "active" : ""}`}>
            {record.active ? "Active" : "Revoked"}
          </span>
          {record.user_verified && <span className="badge">User verified</span>}
          {record.backup_state && <span className="badge">Synced</span>}
        </div>
        <p>
          {record.last_used_at
            ? `Last used ${time.format(record.last_used_at, { unit: "seconds" })}`
            : "Never used to sign in"}
        </p>
        <p className="help-text">
          Registered {time.format(record.created_at, { unit: "seconds" })}
          {record.transports?.length
            ? ` · ${record.transports.join(", ")}`
            : ""}
          {record.revoked_at
            ? ` · Revoked ${time.format(record.revoked_at, { unit: "seconds" })}`
            : ""}
        </p>
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
              aria-label="Passkey name"
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
      {!admin && record.active && (
        <div className="security-session-actions">
          <button
            type="button"
            className="action-button secondary"
            disabled={busy}
            onClick={() => setRenaming(!renaming)}
          >
            Rename
          </button>
          <button
            type="button"
            className="action-button danger"
            disabled={busy || !canRevoke}
            title={
              !canRevoke
                ? "Administrator MFA is required. Enable an authenticator app or add another passkey before removing your last passkey."
                : undefined
            }
            onClick={() => perform("revoke", record.id, record.name)}
          >
            Remove passkey
          </button>
        </div>
      )}
    </article>
  );
}

export default function Passkeys({ status, userId }) {
  const { user, checkUser, sessionGeneration } = useAuth();
  const { confirmAction } = useDialog();
  const time = useTimeFormat();
  const admin = userId != null;
  const identity = getPreferenceIdentity(user);
  const supported = isPasskeySupported();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef(null);
  useEffect(() => {
    setBusy(false);
    setError("");
    return () => controllerRef.current?.abort();
  }, [identity, sessionGeneration, userId]);

  const queryKey = [
    "account-passkeys",
    identity,
    sessionGeneration,
    userId ?? user?.id,
  ];
  const passkeys = useQuery(
    {
      queryKey,
      queryFn: ({ signal }) =>
        admin
          ? callOperation("list_account_passkeys", {
              path: { user_id: userId },
              signal,
            })
          : callOperation("list_passkeys", {
              signal,
              ...trustedDeviceOptions(user?.username),
            }),
    },
    queryClient,
  );

  const rows = passkeys.data ?? [];
  const activeCount = rows.filter((item) => item.active).length;
  const canRevoke =
    !status?.required || Boolean(status?.enabled) || activeCount > 1;

  async function registerPasskey(event) {
    event.preventDefault();
    if (busy || !supported) return;
    const abort = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = abort;
    setBusy(true);
    setError("");
    try {
      const options = await callOperation("begin_passkey_registration", {
        signal: abort.signal,
        ...trustedDeviceOptions(user?.username),
      });
      if (abort.signal.aborted) return;
      const credential = await createPasskeyCredential(
        options.public_key,
        abort.signal,
      );
      if (abort.signal.aborted) return;
      await callOperation("complete_passkey_registration", {
        body: {
          challenge_id: options.challenge_id,
          name: newName.trim() || null,
          credential,
        },
        signal: abort.signal,
        ...trustedDeviceOptions(user?.username),
      });
      if (abort.signal.aborted) return;
      setNewName("");
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({
        queryKey: ["account-security", identity, sessionGeneration],
      });
      await checkUser?.();
    } catch (failure) {
      if (!abort.signal.aborted && failure?.name !== "AbortError") {
        setError(failure.message || "Unable to register passkey.");
      }
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  async function perform(action, passkeyId, name) {
    if (
      action === "revoke" &&
      !(await confirmAction(
        `Remove passkey "${name}"? You will no longer be able to sign in with it.`,
      ))
    )
      return false;
    const abort = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = abort;
    setBusy(true);
    setError("");
    try {
      if (action === "rename") {
        await callOperation("rename_passkey", {
          path: { passkey_id: passkeyId },
          body: { name },
          signal: abort.signal,
          ...trustedDeviceOptions(user?.username),
        });
      } else if (action === "revoke") {
        await callOperation("revoke_passkey", {
          path: { passkey_id: passkeyId },
          signal: abort.signal,
          ...trustedDeviceOptions(user?.username),
        });
      }
      if (abort.signal.aborted) return false;
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({
        queryKey: ["account-security", identity, sessionGeneration],
      });
      if (action === "revoke") await checkUser?.();
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
      aria-label={admin ? "Account passkeys" : "Passkeys"}
      className="security-passkeys"
    >
      <h3>Passkeys</h3>
      <p>
        {admin
          ? "Hardware security keys and device passkeys registered on this account."
          : "Sign in without a password or verify sensitive actions using a hardware security key, fingerprint, or device passkey."}
      </p>
      {!admin && (
        <p>
          <span className="badge">
            {activeCount > 0
              ? `${activeCount} active ${activeCount === 1 ? "passkey" : "passkeys"}`
              : "No passkeys registered"}
          </span>
        </p>
      )}
      {(error || passkeys.error) && (
        <p role="alert">{error || passkeys.error.message}</p>
      )}
      {passkeys.isPending && <p role="status">Loading passkeys…</p>}
      {!admin && (
        <form className="security-form" onSubmit={registerPasskey}>
          <label className="form-label">
            Passkey label (optional)
            <input
              className="form-input"
              maxLength={100}
              placeholder="YubiKey, Windows Hello, iCloud Keychain…"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              disabled={busy || !supported}
            />
          </label>
          {!supported && (
            <p className="help-text">
              This browser or connection does not support WebAuthn passkeys.
            </p>
          )}
          <div className="form-actions">
            <button
              type="submit"
              className="action-button primary-button"
              disabled={busy || !supported}
            >
              {busy ? "Waiting for passkey…" : "Register passkey"}
            </button>
          </div>
        </form>
      )}
      <div className="security-session-list">
        {rows
          .filter((item) => item.active)
          .map((record) => (
            <PasskeyRow
              key={record.id}
              {...{ record, admin, busy, canRevoke, perform, time }}
            />
          ))}
      </div>
      {rows.some((item) => !item.active) && (
        <details className="security-session-history">
          <summary>
            Revoked passkeys ({rows.filter((item) => !item.active).length})
          </summary>
          <div className="security-session-list">
            {rows
              .filter((item) => !item.active)
              .map((record) => (
                <PasskeyRow
                  key={record.id}
                  {...{ record, admin, busy, canRevoke, perform, time }}
                />
              ))}
          </div>
        </details>
      )}
      {!passkeys.isPending && rows.length === 0 && (
        <p className="help-text">No passkeys registered for this account.</p>
      )}
    </section>
  );
}
