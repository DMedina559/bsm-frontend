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
  renameInstance,
  selectInstance,
  subscribeInstances,
  readInstanceToken,
  openInstanceTab,
} from "../app/instanceProfiles";
import { createInstanceConnection } from "../features/instances/connection";
import { useDialog } from "../contexts/DialogContext";
import "../styles/instances.css";

const running = (server) => String(server.status).toLowerCase() === "running";
function InstanceCard({ profile, token, onState, onOpen, onRemove }) {
  const [snapshot, setSnapshot] = useState({
    status: token ? "connecting" : "signed-out",
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
      { id: profile.id, url: profile.url },
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
  }, [profile.id, profile.url, token]);
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
  async function action(server, operation) {
    setError("");
    try {
      await connection.current.action(server.name, operation);
    } catch (failure) {
      setError(failure.message);
    }
  }
  const canManage = ["admin", "moderator"].includes(snapshot.user?.role);
  return (
    <article className="instance-card" aria-label={profile.name}>
      <div className="instance-card-header">
        <div className="instance-avatar">
          <Server size={20} />
        </div>
        <div className="instance-identity">
          <h2>{profile.name}</h2>
          <code title={profile.url}>{profile.url}</code>
        </div>
        <span className={`instance-state instance-state-${snapshot.status}`}>
          {snapshot.status === "signed-out" ? "Sign in" : snapshot.status}
        </span>
      </div>
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
      {(error || snapshot.error) && (
        <p className="instance-error" role="alert">
          {error || snapshot.error}
        </p>
      )}
      {(snapshot.status === "signed-out" || showLogin) && (
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
            <button className="instance-button primary" disabled={busy}>
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
          <div className="instance-server-list">
            {snapshot.servers.map((server) => (
              <div className="instance-server" key={server.name}>
                <span
                  className={`instance-server-dot ${running(server) ? "running" : ""}`}
                />
                <div>
                  <strong>{server.name}</strong>
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
      <div className="instance-card-footer">
        <button
          className="instance-button"
          disabled={busy || snapshot.status === "signed-out"}
          onClick={() => void connection.current.refresh()}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
        <button
          className="instance-button"
          disabled={busy}
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
          title="Open an independent workspace in a separate tab"
        >
          New tab
        </button>
      </div>
      <details className="instance-options">
        <summary>Connection options</summary>
        <div>
          <button
            className="instance-button"
            onClick={() => setShowLogin(!showLogin)}
          >
            Switch account
          </button>
          {snapshot.user && (
            <button
              className="instance-button"
              disabled={busy}
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
        <label>
          Display name
          <input
            defaultValue={profile.name}
            maxLength={80}
            onBlur={(e) => {
              try {
                if (e.target.value.trim() !== profile.name)
                  renameInstance(profile.id, e.target.value);
              } catch (failure) {
                setError(failure.message);
              }
            }}
          />
        </label>
      </details>
    </article>
  );
}
function InstanceWorkspace() {
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
    .map((profile) => states[profile.id])
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
      <div className="instances-grid">
        {profiles.map((profile) => (
          <InstanceCard
            key={profile.id}
            profile={profile}
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
        Only instance names and URLs are saved as profiles. Passwords are never
        retained. Saved bearer tokens follow your choice of session or
        remembered login.
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
