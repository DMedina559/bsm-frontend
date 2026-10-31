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
import IntegrationTokens from "./IntegrationTokens";
import Sessions from "./Sessions";
import "../../styles/access.css";

function SecondFactor({ status, identity, sessionGeneration }) {
  const { confirmAction } = useDialog();
  const [enrollment, setEnrollment] = useState(null);
  const [codes, setCodes] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
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
    controller.current = abort;
    setBusy(true);
    setError("");
    try {
      let result;
      if (action === "enroll")
        result = await callOperation("enroll_account_mfa", {
          signal: abort.signal,
        });
      else if (action === "confirm")
        result = await callOperation("confirm_account_mfa", {
          body: { code },
          signal: abort.signal,
        });
      else if (action === "rotate")
        result = await callOperation("rotate_account_recovery_codes", {
          signal: abort.signal,
        });
      else
        result = await callOperation("disable_account_mfa", {
          signal: abort.signal,
        });
      if (abort.signal.aborted) return;
      if (action === "enroll") setEnrollment(result);
      else {
        setEnrollment(null);
        setCode("");
        setCodes(result.recovery_codes ?? null);
      }
      await queryClient.invalidateQueries({
        queryKey: ["account-security", identity, sessionGeneration],
      });
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure.message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  function downloadCodes() {
    const url = URL.createObjectURL(
      new Blob(
        [
          "Bedrock Server Manager recovery codes\nEach code can be used once. Keep these private.\n\n" +
            codes.join("\n"),
        ],
        { type: "text/plain" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bsm-recovery-codes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
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
              <button className="action-button primary-button" disabled={busy}>
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
          <div className="form-actions">
            <button className="action-button secondary" onClick={downloadCodes}>
              Download recovery codes
            </button>
            <button
              className="action-button secondary"
              onClick={() => setCodes(null)}
            >
              I saved my codes
            </button>
          </div>
        </div>
      )}
      <div className="form-actions">
        {!status?.enabled && !enrollment && (
          <button
            className="action-button primary-button"
            disabled={busy}
            onClick={() => run("enroll")}
          >
            Set up authenticator
          </button>
        )}
        {status?.enabled && (
          <>
            <button
              className="action-button secondary"
              disabled={busy}
              onClick={() => run("rotate")}
            >
              Replace recovery codes
            </button>
            <button
              className="action-button danger"
              disabled={busy}
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
  const [tab, setTab] = useState("sessions");
  const status = useQuery(
    {
      queryKey: ["account-security", identity, sessionGeneration],
      queryFn: ({ signal }) =>
        callOperation("get_account_security", { signal }),
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
            <SecondFactor
              status={status.data}
              {...{ identity, sessionGeneration }}
            />
            {children}
          </>
        )}
      </div>
    </section>
  );
}
