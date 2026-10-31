import ConnectionProbe from "../features/instances/ConnectionProbe";
import ProfileEditor from "../features/instances/ProfileEditor";
import { sessionSettings } from "../app/browserStorage";
import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  RefreshCw,
  Server,
  ArrowUpRight,
  Layers,
  LogOut,
  Play,
  Square,
} from "lucide-react";
import { getConnectionIdentity } from "../app/connection";
import {
  readInstances,
  saveInstance,
  removeInstance,
  updateInstance,
  exportInstanceProfiles,
  importInstanceProfiles,
  selectInstance,
  subscribeInstances,
  readInstanceToken,
  openInstanceTab,
} from "../app/instanceProfiles";
import { createInstanceConnection } from "../features/instances/connection";
import { useDialog } from "../contexts/DialogContext";
import "../styles/instances.css";

const running = (server) => String(server.status).toLowerCase() === "running";
function InstanceCard({
  profile,
  token,
  onState,
  onOpen,
  onRemove,
  search,
  statusFilter,
  hidden,
}) {
  const [snapshot, setSnapshot] = useState({
    status: profile.paused ? "paused" : token ? "connecting" : "signed-out",
    servers: [],
    pending: null,
    user: null,
    error: null,
    socket: "disconnected",
    info: null,
    updatedAt: null,
  });
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
    remember: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const connection = useRef(null);
  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);
  useEffect(() => {
    const session = createInstanceConnection(
      { id: profile.id, url: profile.url, paused: profile.paused },
      {
        onChange: (value) => {
          setSnapshot(value);
          onStateRef.current(profile.id, value);
        },
      },
    );
    connection.current = session;
    setSnapshot(session.getSnapshot());
    onStateRef.current(profile.id, session.getSnapshot());
    void session.start();
    return () => {
      session.dispose();
      connection.current = null;
    };
  }, [profile.id, profile.url, profile.paused, token]);
  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await connection.current.login(
        credentials.username,
        credentials.password,
        credentials.remember,
      );
      setShowLogin(false);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
      setCredentials((value) => ({ ...value, password: "" }));
    }
  }
  const { confirmAction } = useDialog();
  async function action(server, operation) {
    const session = connection.current;
    if (
      !(await confirmAction(
        `${operation === "stop_server" ? "Stop" : "Start"} ${server.name} on ${profile.name} (${profile.url})?`,
      ))
    )
      return;
    setError("");
    try {
      if (session !== connection.current)
        throw new Error(
          "The connection changed. Review the target instance before confirming again.",
        );
      await session.action(server.name, operation);
    } catch (failure) {
      setError(failure.message);
    }
  }
  const matches = (server) =>
    `${profile.name} ${profile.group ?? ""} ${profile.url} ${server.name}`
      .toLowerCase()
      .includes(search.toLowerCase()) &&
    (statusFilter === "all" ||
      (statusFilter === "running" ? running(server) : !running(server)));
  const blocked =
    window.location.protocol === "https:" &&
    new URL(profile.url).protocol === "http:";
  const canManage = ["admin", "moderator"].includes(snapshot.user?.role);
  return (
    <article
      hidden={hidden}
      className="instance-card"
      aria-label={profile.name}
      style={
        profile.color
          ? {
              "--instance-color": profile.color,
              borderTop: "3px solid var(--instance-color)",
            }
          : undefined
      }
    >
      <div className="instance-card-header">
        <div className="instance-avatar">
          <Server size={20} />
        </div>
        <div className="instance-identity">
          <h2>{profile.name}</h2>
          {profile.group && (
            <span className="instance-group">{profile.group}</span>
          )}
          <code title={profile.url}>{profile.url}</code>
        </div>
        <span className={`instance-state instance-state-${snapshot.status}`}>
          {snapshot.status === "signed-out" ? "Sign in" : snapshot.status}
        </span>
      </div>
      {profile.paused && (
        <p className="instance-stale">
          Connection paused · no polling or socket activity
        </p>
      )}
      <div className="instance-card-meta">
        <span>{snapshot.user?.username ?? "No active session"}</span>
        <span>{snapshot.info?.app_version ?? "BSM"}</span>
        <span>
          {snapshot.socket === "connected"
            ? "Live updates"
            : snapshot.status === "online"
              ? "HTTP refresh"
              : "Disconnected"}
        </span>
      </div>
      {blocked && (
        <p className="instance-error" role="alert">
          This profile is saved, but an HTTPS frontend cannot connect to an HTTP
          backend. Use an HTTPS backend URL or open the frontend over HTTP.
        </p>
      )}
      {(error || snapshot.error) && (
        <p className="instance-error" role="alert">
          {error || snapshot.error}
        </p>
      )}
      {!profile.paused && (
        <ConnectionProbe key={profile.url} url={profile.url} />
      )}
      {!profile.paused && (snapshot.status === "signed-out" || showLogin) && (
        <form className="instance-login" onSubmit={login}>
          <div className="instance-login-fields">
            <label>
              Username
              <input
                autoComplete="username"
                required
                value={credentials.username}
                onChange={(e) =>
                  setCredentials({ ...credentials, username: e.target.value })
                }
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
              />
            </label>
          </div>
          <div className="instance-login-actions">
            <label>
              <input
                type="checkbox"
                checked={credentials.remember}
                onChange={(e) =>
                  setCredentials({ ...credentials, remember: e.target.checked })
                }
              />
              Remember this instance
            </label>
            <button
              className="instance-button primary"
              disabled={busy || blocked || profile.paused}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      )}
      {snapshot.servers.length > 0 ? (
        <div className="instance-fleet">
          <div className="instance-fleet-heading">
            <span>
              {snapshot.servers.length}{" "}
              {snapshot.servers.length === 1 ? "server" : "servers"}
            </span>
            <span>{snapshot.servers.filter(running).length} running</span>
          </div>
          {snapshot.status !== "online" && (
            <p className="instance-stale">
              Last known state · reconnect before making changes
            </p>
          )}
          {!snapshot.servers.some(matches) && (
            <p className="instance-empty-fleet">
              No servers match these filters.
            </p>
          )}
          <div className="instance-server-list">
            {snapshot.servers.filter(matches).map((server) => (
              <div className="instance-server" key={server.name}>
                <span
                  className={`instance-server-dot ${running(server) ? "running" : ""}`}
                />
                <div>
                  <strong>{server.name}</strong>
                  <small>{profile.name}</small>
                  <small>
                    {server.status ?? "Unknown"}
                    {server.version ? ` · ${server.version}` : ""}
                  </small>
                </div>
                {canManage && (
                  <button
                    className="instance-button"
                    disabled={
                      snapshot.status !== "online" || !!snapshot.pending
                    }
                    onClick={() =>
                      action(
                        server,
                        running(server) ? "stop_server" : "start_server",
                      )
                    }
                    aria-label={`${running(server) ? "Stop" : "Start"} ${server.name} on ${profile.name}`}
                  >
                    {snapshot.pending === server.name ? (
                      "Working…"
                    ) : running(server) ? (
                      <>
                        <Square size={12} />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play size={12} />
                        Start
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : snapshot.status === "online" ? (
        <p className="instance-empty-fleet">No servers on this instance.</p>
      ) : null}
      <div className="instance-health">
        <span>
          Last successful refresh:{" "}
          {snapshot.updatedAt
            ? new Date(snapshot.updatedAt).toLocaleTimeString()
            : "Never"}
        </span>
        <span>
          {" "}
          ·{" "}
          {snapshot.pending
            ? `Action pending on ${snapshot.pending}`
            : "No pending actions"}
        </span>
      </div>
      <details className="instance-options">
        <summary>Connection details</summary>
        <dl className="instance-details">
          <dt>Backend</dt>
          <dd>{profile.url}</dd>
          <dt>Frontend origin</dt>
          <dd>{window.location.origin}</dd>
          <dt>Account</dt>
          <dd>
            {snapshot.user?.username ?? "Signed out"} ·{" "}
            {snapshot.user?.role ?? "No role"}
          </dd>
          <dt>Version</dt>
          <dd>
            {snapshot.info?.app_version ?? "Not available until connected"}
          </dd>
          <dt>HTTP / socket</dt>
          <dd>
            {snapshot.status} / {snapshot.socket}
          </dd>
          <dt>Last success</dt>
          <dd>
            {snapshot.updatedAt
              ? new Date(snapshot.updatedAt).toLocaleString()
              : "Never"}
          </dd>
          <dt>Next refresh</dt>
          <dd>
            {profile.paused
              ? "Paused"
              : snapshot.nextRefreshAt
                ? new Date(snapshot.nextRefreshAt).toLocaleTimeString()
                : "Not scheduled"}
          </dd>
          <dt>Certificate trust</dt>
          <dd>
            {profile.url.startsWith("https:")
              ? "Managed by your browser"
              : "HTTP · connection is not encrypted"}
          </dd>
        </dl>
      </details>
      <details className="instance-options">
        <summary>
          Task history · {profile.name} ({snapshot.operations?.length ?? 0})
        </summary>
        {snapshot.operations?.length ? (
          <ol className="instance-task-list">
            {[...snapshot.operations].reverse().map((operation) => (
              <li key={operation.id}>
                <strong>{operation.serverName}</strong> ·{" "}
                {operation.kind.replaceAll("_", " ")} ·{" "}
                {operation.id.startsWith("uncertain:") && operation.terminal
                  ? operation.status === "completed"
                    ? "Target state confirmed"
                    : "Acknowledged (outcome unconfirmed)"
                  : operation.uncertain
                    ? "Outcome unknown"
                    : operation.status}
                {operation.uncertain && (
                  <button
                    type="button"
                    className="instance-button"
                    onClick={async () => {
                      if (
                        await confirmAction(
                          `Have you checked ${operation.serverName} on ${profile.name}? Acknowledging this only unlocks actions; it does not cancel a backend operation.`,
                        )
                      ) {
                        connection.current.acknowledgeUncertain(operation.id);
                        setError("");
                      }
                    }}
                  >
                    I checked the server
                  </button>
                )}
                {operation.error?.message && (
                  <p role="alert">{operation.error.message}</p>
                )}
                <small>{new Date(operation.updatedAt).toLocaleString()}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p>No actions in this session.</p>
        )}
      </details>
      <div className="instance-card-footer">
        <button
          className="instance-button"
          disabled={busy || blocked || profile.paused || !token}
          onClick={() => void connection.current.refresh()}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
        <button
          className="instance-button"
          disabled={busy || blocked || profile.paused}
          onClick={() => onOpen(profile)}
        >
          Open workspace
          <ArrowUpRight size={13} />
        </button>
        <button
          className="instance-button"
          onClick={() => {
            try {
              openInstanceTab(profile.id);
            } catch (failure) {
              setError(failure.message);
            }
          }}
          disabled={blocked || profile.paused}
          title="Open an independent workspace in a separate tab"
        >
          New tab
        </button>
      </div>
      <details className="instance-options">
        <summary>Connection options</summary>
        <div>
          <button
            type="button"
            className="instance-button"
            disabled={!!snapshot.pending}
            onClick={() =>
              updateInstance(profile.id, { paused: !profile.paused })
            }
          >
            {profile.paused ? "Resume connection" : "Pause connection"}
          </button>
          <button
            className="instance-button"
            disabled={profile.paused}
            onClick={() => setShowLogin(!showLogin)}
          >
            Switch account
          </button>
          {snapshot.user && (
            <button
              className="instance-button"
              disabled={busy || blocked || profile.paused}
              onClick={async () => {
                setBusy(true);
                try {
                  await connection.current.logout();
                } catch (failure) {
                  setError(failure.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <LogOut size={13} />
              Sign out
            </button>
          )}
          <button className="instance-button" onClick={() => onRemove(profile)}>
            Remove instance
          </button>
        </div>
        <ProfileEditor
          key={JSON.stringify(profile)}
          profile={profile}
          disabled={!!snapshot.pending}
        />
      </details>
    </article>
  );
}
function InstanceWorkspace() {
  const [groupFilter, setGroupFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [connectionFilter, setConnectionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [profiles, setProfiles] = useState(readInstances);
  const [states, setStates] = useState({});
  const [form, setForm] = useState({ name: "", url: "" });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const { confirmAction } = useDialog();
  const navigate = useNavigate();
  useEffect(() => subscribeInstances(() => setProfiles(readInstances())), []);
  const currentUrl = getConnectionIdentity();
  const snapshots = profiles
    .map((profile) =>
      states[profile.id]?.url && states[profile.id].url !== profile.url
        ? null
        : states[profile.id],
    )
    .filter(Boolean);
  const online = snapshots.filter((value) => value.status === "online");
  function add(event) {
    event.preventDefault();
    setError("");
    try {
      saveInstance(form);
      setForm({ name: "", url: "" });
      setAdding(false);
    } catch (failure) {
      setError(failure.message);
    }
  }
  return (
    <div className="instances-page">
      <header className="instances-header">
        <div>
          <Link to="/" className="instances-back">
            ← Back to workspace
          </Link>
          <span className="instances-eyebrow">
            Hidden feature · Multi-instance
          </span>
          <h1>BSM Instances</h1>
          <p>
            One fleet view. Independent connections, accounts, and server
            actions.
          </p>
        </div>
        <button
          className="instance-button primary"
          onClick={() => setAdding(!adding)}
        >
          <Plus size={15} />
          Add instance
        </button>
      </header>
      <div className="instances-tools">
        <button
          type="button"
          className="instance-button"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([exportInstanceProfiles()], {
                type: "application/json",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "bsm-instances.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Export profiles
        </button>
        <label className="instance-import">
          Import profiles
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                if (file.size > 256000)
                  throw new Error(
                    "Profile imports must be smaller than 256 KB.",
                  );
                const text = await file.text();
                if (
                  !(await confirmAction(
                    "Import these profiles? Existing URLs will be skipped. Credentials are never imported.",
                  ))
                )
                  return;
                const result = importInstanceProfiles(text);
                setNotice(
                  `${result.added} profiles imported; ${result.skipped} existing or duplicate URLs skipped.`,
                );
                setError("");
              } catch (failure) {
                setError(failure.message);
              }
            }}
          />
        </label>
        <small>
          Exports contain profile settings only, without credentials or task
          history.
        </small>
      </div>
      {notice && <p role="status">{notice}</p>}
      <div className="instances-summary">
        <div>
          <Layers size={18} />
          <strong>{profiles.length}</strong>
          <span>saved instances</span>
        </div>
        <div>
          <span className="instance-server-dot running" />
          <strong>{online.length}</strong>
          <span>online</span>
        </div>
        <div>
          <Server size={18} />
          <strong>
            {online.reduce((total, value) => total + value.servers.length, 0)}
          </strong>
          <span>servers available</span>
        </div>
        <div>
          <strong>
            {online.reduce(
              (total, value) => total + value.servers.filter(running).length,
              0,
            )}
          </strong>
          <span>running</span>
        </div>
      </div>
      {error && (
        <p className="instance-error" role="alert">
          {error}
        </p>
      )}
      {adding && (
        <form className="instances-add" onSubmit={add}>
          <h2>Add a BSM instance</h2>
          <div>
            <label>
              Display name
              <input
                required
                maxLength={80}
                placeholder="Home server"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Backend URL
              <input
                required
                type="url"
                placeholder="https://bsm.example.com"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </label>
          </div>
          <ConnectionProbe key={form.url} url={form.url} />
          <p>
            Use the backend root, including any proxy prefix. Each instance
            keeps its own login.
          </p>
          <button className="instance-button primary">Save instance</button>
        </form>
      )}
      {!profiles.some((profile) => profile.url === currentUrl) && (
        <div className="instances-current">
          <span>Keep your existing connection in this workspace.</span>
          <button
            className="instance-button"
            onClick={() => {
              try {
                saveInstance({ name: "Current BSM", url: currentUrl });
              } catch (failure) {
                setError(failure.message);
              }
            }}
          >
            Save current connection
          </button>
        </div>
      )}
      <div className="instances-filters">
        <label>
          Group
          <select
            aria-label="Instance group"
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
          >
            <option value="all">All groups</option>
            {[
              ...new Set(
                profiles.map((profile) => profile.group).filter(Boolean),
              ),
            ]
              .sort()
              .map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
          </select>
        </label>
        <label>
          Search fleet
          <input
            type="search"
            placeholder="Instance, URL, or server name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Server status
          <select
            aria-label="Server status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All servers</option>
            <option value="running">Running</option>
            <option value="stopped">Not running</option>
          </select>
        </label>
        <label>
          Connection
          <select
            aria-label="Connection filter"
            value={connectionFilter}
            onChange={(event) => setConnectionFilter(event.target.value)}
          >
            <option value="all">All connections</option>
            <option value="online">Online</option>
            <option value="offline">Needs attention</option>
          </select>
        </label>
      </div>
      <div className="instances-grid">
        {profiles.map((profile) => (
          <InstanceCard
            hidden={
              (groupFilter !== "all" && profile.group !== groupFilter) ||
              (connectionFilter !== "all" &&
                (connectionFilter === "online"
                  ? states[profile.id]?.status !== "online"
                  : states[profile.id]?.status === "online"))
            }
            key={profile.id}
            profile={profile}
            search={search}
            statusFilter={statusFilter}
            token={readInstanceToken(profile.url)}
            onState={(id, value) =>
              setStates((current) => ({ ...current, [id]: value }))
            }
            onOpen={(target) => {
              selectInstance(target.id);
              navigate("/", { replace: true });
            }}
            onRemove={async (target) => {
              if (
                await confirmAction(
                  `Remove ${target.name} and forget its saved login?`,
                )
              )
                removeInstance(target.id);
            }}
          />
        ))}
      </div>
      {!profiles.length && (
        <div className="instances-empty">
          <Layers size={36} />
          <h2>Your instances, together</h2>
          <p>
            Add your BSM backends to view their fleets at the same time. Sign in
            to each independently and open full workspaces in separate tabs.
          </p>
        </div>
      )}
      <footer className="instances-footnote">
        Instance names, URLs, and display preferences are saved as profiles.
        Passwords are never retained. Saved bearer tokens follow your choice of
        session or remembered login.
      </footer>
    </div>
  );
}
export default function Instances() {
  const { search } = useLocation();
  const hidden = new URLSearchParams(search).get("hidden");
  return hidden === "true" ||
    (hidden !== "false" &&
      sessionSettings.getItem("show_hidden_flag") === "true") ? (
    <InstanceWorkspace />
  ) : (
    <Navigate to="/" replace />
  );
}
