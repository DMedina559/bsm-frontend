import { trustedDeviceOptions } from "../../app/trustedDevices";
import RememberedDevices from "./RememberedDevices";
import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { callOperation } from "../../api/operations";
import { queryClient } from "../../app/queryClient";
import {
  getBackendIdentity,
  getPreferenceIdentity,
} from "../../app/backendIdentity";
import { useTimeFormat } from "../../app/useTimeFormat";
import { useAuth } from "../../contexts/AuthContext";
import { useDialog } from "../../contexts/DialogContext";
import { saveTextFile } from "../../utils/saveTextFile";
import { sessionRuntime } from "../../app/sessionRuntime";
import IntegrationTokens from "./IntegrationTokens";
import Passkeys from "./Passkeys";
import Sessions from "./Sessions";
import "../../styles/access.css";

function SecondFactor({ status, identity, sessionGeneration }) {
  const { confirmAction } = useDialog();
  const { user, checkUser } = useAuth();
  const [enrollment, setEnrollment] = useState(null);
  const [codes, setCodes] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);
  const copyControllerRef = useRef(null);
  const copyFieldRef = useRef(null);
  useEffect(() => {
    setCopyMessage("");
    setCopyFailed(false);
    return () => copyControllerRef.current?.abort();
  }, [codes]);
  useEffect(() => {
    if (copyFailed) {
      copyFieldRef.current?.focus();
      copyFieldRef.current?.select();
    }
  }, [copyFailed]);
  async function copyCodes() {
    const abort = new AbortController();
    copyControllerRef.current?.abort();
    copyControllerRef.current = abort;
    setCopyMessage("Copying recovery codes…");
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      if (!abort.signal.aborted) setCopyMessage("Recovery codes copied.");
    } catch {
      if (!abort.signal.aborted) {
        setCopyMessage(
          "Could not copy automatically. Select the codes below and copy them manually.",
        );
        setCopyFailed(true);
      }
    }
  }
  const downloadUrlRef = useRef(null);
  const saveControllerRef = useRef(null);
  const savingCodesRef = useRef(false);
  const [savingCodes, setSavingCodes] = useState(false);
  // A save dialog may stay open indefinitely. Keep its source alive until the
  // codes are dismissed, replaced, or this view is unmounted.
  useEffect(
    () => () => {
      saveControllerRef.current?.abort();
      savingCodesRef.current = false;
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    },
    [codes],
  );
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);
  async function run(action) {
    if (
      action === "disable" &&
      !(await confirmAction(
        "Disable two-factor authentication and sign out other sessions?",
      ))
    )
      return;
    if (
      action === "rotate" &&
      !(await confirmAction(
        "Replace every existing recovery code? Save the new codes before leaving this page.",
      ))
    )
      return;
    const abort = new AbortController();
    controllerRef.current = abort;
    setBusy(true);
    setError("");
    try {
      let result;
      if (action === "enroll")
        result = await callOperation("enroll_account_mfa", {
          signal: abort.signal,
          ...trustedDeviceOptions(user?.username),
        });
      else if (action === "confirm")
        result = await callOperation("confirm_account_mfa", {
          body: { code },
          signal: abort.signal,
          ...trustedDeviceOptions(user?.username),
        });
      else if (action === "rotate")
        result = await callOperation("rotate_account_recovery_codes", {
          signal: abort.signal,
          ...trustedDeviceOptions(user?.username),
        });
      else
        result = await callOperation("disable_account_mfa", {
          signal: abort.signal,
          ...trustedDeviceOptions(user?.username),
        });
      if (abort.signal.aborted) return;
      if (action === "enroll") setEnrollment(result);
      else {
        setEnrollment(null);
        setCode("");
        setDownloadMessage("");
        setSavingCodes(false);
        setCodes(result.recovery_codes ?? null);
      }
      await queryClient.invalidateQueries({
        queryKey: ["account-security", identity, sessionGeneration],
      });
      await queryClient.invalidateQueries({
        queryKey: ["trusted-devices", identity, sessionGeneration],
      });
      if (action === "confirm" || action === "disable") await checkUser?.();
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure.message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  async function downloadCodes() {
    if (savingCodes || savingCodesRef.current) return;
    savingCodesRef.current = true;
    const controller = new AbortController();
    saveControllerRef.current = controller;
    const content =
      "Bedrock Server Manager recovery codes\nEach code can be used once. Keep these private.\n\n" +
      codes.join("\n") +
      "\n";
    const anchor = document.createElement("a");
    try {
      const saved = await saveTextFile(
        "bsm-recovery-codes.txt",
        content,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (saved) {
        setDownloadMessage("Recovery codes saved.");
        return;
      }
      if (!downloadUrlRef.current) {
        downloadUrlRef.current = URL.createObjectURL(
          new Blob([content], { type: "text/plain;charset=utf-8" }),
        );
      }
      anchor.href = downloadUrlRef.current;
      anchor.download = "bsm-recovery-codes.txt";
      anchor.rel = "noopener";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      setDownloadMessage(
        "Download requested. Keep these codes visible until the file has been saved.",
      );
    } catch (failure) {
      if (!controller.signal.aborted)
        setDownloadMessage(
          failure.name === "AbortError"
            ? "Save cancelled. Your recovery codes are still shown."
            : "The codes could not be saved. Try again or save the displayed codes manually.",
        );
    } finally {
      anchor.remove();
      savingCodesRef.current = false;
      if (!controller.signal.aborted) setSavingCodes(false);
    }
  }
  return (
    <section aria-label="Two-factor authentication">
      <h3>Authenticator app</h3>
      <p>
        Add a second factor using an authenticator app. Recovery codes provide
        access if your device is lost.
      </p>
      {error && <p role="alert">{error}</p>}
      <p>
        <span className="badge">
          {status?.enabled ? "Two-factor enabled" : "Two-factor not enabled"}
        </span>
        {status?.enabled &&
          ` · ${status.recovery_codes_remaining} recovery codes remaining`}
      </p>
      {enrollment && (
        <div className="security-enrollment">
          <img
            src={enrollment.qr_svg}
            alt="Authenticator enrollment QR code"
            width={200}
            height={200}
          />
          <div>
            <p>
              Scan this code, or enter the setup key manually. Setup expires
              after ten minutes.
            </p>
            <label className="form-label">
              Setup key
              <input
                className="form-input"
                value={enrollment.secret}
                readOnly
                autoComplete="off"
              />
            </label>
            <form
              className="security-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run("confirm");
              }}
            >
              <label className="form-label">
                Six-digit authenticator code
                <input
                  className="form-input"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                />
              </label>
              <button
                className="action-button primary-button"
                disabled={busy || savingCodes}
              >
                Enable two-factor authentication
              </button>
            </form>
          </div>
        </div>
      )}
      {codes && (
        <div className="security-recovery">
          <h4>Save your recovery codes</h4>
          <p>
            These codes are shown once. Each works only once. Leaving this tab
            hides them.
          </p>
          <ul>
            {codes.map((value) => (
              <li key={value}>
                <code>{value}</code>
              </li>
            ))}
          </ul>
          {copyFailed && (
            <textarea
              ref={copyFieldRef}
              className="form-input"
              rows={6}
              readOnly
              value={codes.join("\n")}
              aria-label="Recovery codes to copy"
            />
          )}
          {copyMessage && <p role="status">{copyMessage}</p>}
          <div className="form-actions">
            <button
              type="button"
              className="action-button secondary"
              disabled={savingCodes}
              onClick={copyCodes}
            >
              Copy recovery codes
            </button>
            <button
              type="button"
              className="action-button secondary"
              onClick={downloadCodes}
              disabled={savingCodes}
            >
              {savingCodes
                ? "Saving recovery codes…"
                : "Download recovery codes"}
            </button>
            <button
              className="action-button secondary"
              type="button"
              disabled={savingCodes}
              onClick={() => setCodes(null)}
            >
              I saved my codes
            </button>
          </div>
          {downloadMessage && <p role="status">{downloadMessage}</p>}
        </div>
      )}
      {status?.required && (
        <p className="help-text">MFA is required for administrator accounts.</p>
      )}
      <div className="form-actions">
        {!status?.enabled && !enrollment && (
          <button
            className="action-button primary-button"
            disabled={busy || savingCodes}
            onClick={() => run("enroll")}
          >
            Set up authenticator
          </button>
        )}
        {status?.enabled && (
          <>
            <button
              className="action-button secondary"
              disabled={busy || savingCodes}
              onClick={() => run("rotate")}
            >
              Replace recovery codes
            </button>
            <button
              className="action-button danger"
              disabled={
                busy ||
                savingCodes ||
                (status.required && !status.passkeys_enabled)
              }
              title={
                status.required && !status.passkeys_enabled
                  ? "Administrator MFA is required. Register a passkey before disabling your authenticator app."
                  : undefined
              }
              onClick={() => run("disable")}
            >
              Disable two-factor
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function EffectiveAccess({ user, identity, sessionGeneration }) {
  const servers = useQuery(
    {
      queryKey: ["access-servers", identity, sessionGeneration],
      queryFn: ({ signal }) => callOperation("list_access_servers", { signal }),
      enabled: user.permissions?.includes("servers:read") === true,
    },
    queryClient,
  );
  const [permission, setPermission] = useState("");
  const [serverId, setServerId] = useState("");
  const permissions = [...(user.permissions ?? [])].sort();
  const selected = servers.data?.find((server) => server.id === serverId);
  const reason = !permission
    ? null
    : !permissions.includes(permission)
      ? "Your current role or credential does not include this permission."
      : selected && !selected.permissions.includes(permission)
        ? "This server’s assignment does not grant that permission."
        : "The permission is present. Ownership, resource limits, and operation-specific checks still apply.";
  return (
    <section aria-label="Your effective access">
      <h3>Your effective access</h3>
      <p>
        Role: <strong>{user.role}</strong> ·{" "}
        {user.server_access === "assigned"
          ? "Assigned servers only"
          : "All servers allowed by your role"}
      </p>
      <div className="security-form">
        <label className="form-label">
          Check a permission
          <input
            className="form-input"
            value={permission}
            onChange={(event) => setPermission(event.target.value)}
            placeholder="servers:control"
          />
        </label>
        <label className="form-label">
          Server
          <select
            className="form-input"
            value={serverId}
            onChange={(event) => setServerId(event.target.value)}
          >
            <option value="">Account capability only</option>
            {servers.data?.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))}
          </select>
        </label>
        {reason && <p role="status">{reason}</p>}
      </div>
      {servers.error && <p role="alert">{servers.error.message}</p>}
      <details>
        <summary>Account permissions ({permissions.length})</summary>
        <ul className="security-permissions">
          {permissions.map((value) => (
            <li key={value}>
              <code>{value}</code>
            </li>
          ))}
        </ul>
      </details>
      <div className="security-access-servers">
        {servers.data?.map((server) => (
          <details key={server.id}>
            <summary>
              {server.name} · {server.permissions.length} permissions
            </summary>
            <ul className="security-permissions">
              {server.permissions.map((value) => (
                <li key={value}>
                  <code>{value}</code>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function AccountSecurity({ children }) {
  const { user, sessionGeneration } = useAuth();
  const time = useTimeFormat();
  const identity = getPreferenceIdentity(user);
  useEffect(() => {
    const refresh = (event) => {
      if (
        event.detail?.backend !== getBackendIdentity() ||
        event.detail?.generation !== sessionRuntime.capture().generation
      )
        return;
      for (const group of [
        "account-security",
        "account-passkeys",
        "trusted-devices",
        "security-activity",
        "login-sessions",
        "integration-tokens",
      ])
        void queryClient.invalidateQueries({ queryKey: [group, identity] });
    };
    window.addEventListener("bsm:security-notice", refresh);
    return () => window.removeEventListener("bsm:security-notice", refresh);
  }, [identity, sessionGeneration]);
  const [tab, setTab] = useState(
    user?.mfa_enrollment_required ? "sign-in" : "sessions",
  );
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const status = useQuery(
    {
      queryKey: ["account-security", identity, sessionGeneration],
      queryFn: ({ signal }) =>
        callOperation("get_account_security", {
          signal,
          ...trustedDeviceOptions(user?.username),
        }),
    },
    queryClient,
  );
  const activity = useQuery(
    {
      queryKey: ["security-activity", identity, sessionGeneration],
      queryFn: ({ signal }) =>
        callOperation("list_security_activity", { signal }),
      enabled: tab === "activity",
    },
    queryClient,
  );
  return (
    <section
      className="settings-panel account-security"
      aria-labelledby="account-security-heading"
    >
      {user?.mfa_enrollment_required && (
        <p className="message warning" role="alert">
          Your administrator requires MFA. Set up an authenticator or register a
          passkey below to unlock this account.
        </p>
      )}
      {status.data?.recent_until * 1000 > clock && (
        <p className="help-text" role="status">
          Identity verified for about{" "}
          {Math.ceil((status.data.recent_until * 1000 - clock) / 60000)} more
          minutes.
        </p>
      )}
      <div className="section-heading">
        <ShieldCheck size={22} />
        <div>
          <h2 id="account-security-heading">Security</h2>
          <p>
            Manage your logins, integration credentials, and account protection.
          </p>
        </div>
        <button
          className="action-button secondary"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("bsm:security-verification-required", {
                detail: { backend: getBackendIdentity() },
              }),
            )
          }
        >
          Verify password
        </button>
      </div>
      <div
        className="settings-tabs security-tabs"
        role="tablist"
        aria-label="Account security"
      >
        {[
          ["sessions", "Sessions"],
          ["integrations", "Integrations"],
          ["access", "My access"],
          ["activity", "Activity"],
          ["sign-in", "Password & MFA"],
        ].map(([id, label]) => (
          <button
            key={id}
            id={`security-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls="security-tab-panel"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {status.error && <p role="alert">{status.error.message}</p>}
      <div
        id="security-tab-panel"
        role="tabpanel"
        aria-labelledby={`security-tab-${tab}`}
        className="security-tab-panel"
      >
        {tab === "sessions" && (
          <>
            <Sessions />
            <RememberedDevices />
            <p className="help-text">
              Idle expiry:{" "}
              {Math.round((status.data?.idle_timeout_seconds ?? 0) / 3600)}{" "}
              hours of authenticated inactivity. Maximum lifetime:{" "}
              {status.data?.max_session_days ?? "…"} days; individual logins may
              expire earlier.
            </p>
          </>
        )}
        {tab === "integrations" && <IntegrationTokens />}
        {tab === "access" && (
          <EffectiveAccess {...{ user, identity, sessionGeneration }} />
        )}
        {tab === "activity" && (
          <section aria-label="Security activity">
            <h3>Security activity</h3>
            <p>
              Recent security events from the last 90 days. Credentials and
              verification codes are never displayed here.
            </p>
            {activity.isPending && (
              <p role="status">Loading security activity…</p>
            )}
            {activity.error && <p role="alert">{activity.error.message}</p>}
            <ol className="security-activity">
              {activity.data?.map((event) => (
                <li key={event.id}>
                  <strong>{event.action.replaceAll("_", " ")}</strong>
                  <time>
                    {time.format(event.timestamp, { unit: "seconds" })}
                  </time>
                </li>
              ))}
            </ol>
            {activity.data?.length === 0 && (
              <p>No security events recorded yet.</p>
            )}
          </section>
        )}
        {tab === "sign-in" && (
          <>
            <Passkeys status={status.data} />
            <SecondFactor
              status={status.data}
              {...{ identity, sessionGeneration }}
            />
            {!user?.mfa_enrollment_required && children}
          </>
        )}
      </div>
    </section>
  );
}
