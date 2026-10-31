import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Palette, Monitor, HardDrive, Plug, Activity } from "lucide-react";
import AppearanceSettings from "./AppearanceSettings";
import RecoverySettings from "../components/RecoverySettings";
import FrontendRecordingSettings from "../components/FrontendRecordingSettings";
import RemoteConfigModal from "../components/RemoteConfigModal";
import { usePreference } from "../app/usePreference";
import { getApiBaseUrl, getConnectionIdentity } from "../app/connection";
import { getAppConfig } from "../app/config";
import { sessionSettings } from "../app/browserStorage";
import { SERVER_SORTS } from "../utils/serverSort";
import "../styles/frontend-settings.css";

const categories = [
  ["appearance", "Appearance", "Themes, palettes, and backgrounds", Palette],
  ["display", "Display", "Layout, units, and timestamps", Monitor],
  ["recovery", "Browser recovery", "Cached views and unsaved edits", HardDrive],
  ["connections", "Connections", "Default backend and saved instances", Plug],
  [
    "diagnostics",
    "Diagnostics",
    "Frontend recording and local history",
    Activity,
  ],
];
function WorkspaceDisplay() {
  const [layout, setLayout] = usePreference("overviewLayout", "grid");
  const [sort, setSort] = usePreference("serverSort", {
    key: "name",
    direction: "asc",
  });
  const [collapsed, setCollapsed] = usePreference("sidebarCollapsed", false);
  return (
    <section
      className="settings-panel"
      aria-labelledby="workspace-display-title"
    >
      <h2 id="workspace-display-title">Workspace layout</h2>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="fleet-layout">
            Fleet layout
          </label>
          <select
            id="fleet-layout"
            className="form-input"
            value={layout}
            onChange={(event) => setLayout(event.target.value)}
          >
            <option value="grid">Grid</option>
            <option value="compact">Compact</option>
            <option value="list">List</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="default-server-sort">
            Default server sort
          </label>
          <select
            id="default-server-sort"
            className="form-input"
            value={sort.key}
            onChange={(event) => setSort({ ...sort, key: event.target.value })}
          >
            {Object.entries(SERVER_SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="default-sort-direction">
            Sort direction
          </label>
          <select
            id="default-sort-direction"
            className="form-input"
            value={sort.direction}
            onChange={(event) =>
              setSort({ ...sort, direction: event.target.value })
            }
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>
      <label className="checkbox-wrapper">
        <input
          type="checkbox"
          checked={collapsed}
          onChange={(event) => setCollapsed(event.target.checked)}
        />
        Collapse sidebar
      </label>
      <p className="form-help-text">
        The fleet view and sidebar also provide quick controls for these
        preferences.
      </p>
    </section>
  );
}
export default function FrontendSettings() {
  const [params, setParams] = useSearchParams();
  const [showConnection, setShowConnection] = useState(false);
  const active = categories.some(([id]) => id === params.get("tab"))
    ? params.get("tab")
    : "appearance";
  const select = (tab) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", tab);
      return next;
    });
  const canConfigure =
    getAppConfig().mode === "standalone" ||
    !!getApiBaseUrl() ||
    sessionSettings.getItem("show_hidden_flag") === "true";
  return (
    <div className="container frontend-settings-page">
      <header className="account-heading">
        <div>
          <p className="workspace-eyebrow">YOUR WORKSPACE</p>
          <h1>Frontend settings</h1>
          <p className="form-help-text">
            Customize this interface in one place. Preferences are saved for
            this account and browser; your selected theme follows your account.
          </p>
        </div>
        <Link className="action-button secondary" to="/account">
          Account &amp; security
        </Link>
      </header>
      <div className="frontend-settings-layout">
        <div
          role="tablist"
          aria-label="Frontend settings categories"
          className="frontend-settings-nav"
          aria-orientation="vertical"
          onKeyDown={(event) => {
            const index = categories.findIndex(([id]) => id === active);
            const next =
              event.key === "ArrowDown" || event.key === "ArrowRight"
                ? (index + 1) % categories.length
                : event.key === "ArrowUp" || event.key === "ArrowLeft"
                  ? (index + categories.length - 1) % categories.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? categories.length - 1
                      : null;
            if (next !== null) {
              event.preventDefault();
              select(categories[next][0]);
              event.currentTarget
                .querySelectorAll('[role="tab"]')
                [next]?.focus();
            }
          }}
        >
          {categories.map(([id, label, description, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`frontend-tab-${id}`}
              aria-controls={`frontend-panel-${id}`}
              aria-selected={active === id}
              tabIndex={active === id ? 0 : -1}
              onClick={() => select(id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </button>
          ))}
        </div>
        <div
          className="frontend-settings-content"
          role="tabpanel"
          id={`frontend-panel-${active}`}
          aria-labelledby={`frontend-tab-${active}`}
        >
          {(active === "appearance" || active === "display") && (
            <AppearanceSettings section={active} />
          )}
          {active === "display" && <WorkspaceDisplay />}
          {active === "recovery" && <RecoverySettings />}
          {active === "connections" && (
            <section className="settings-panel">
              <h2>Connections</h2>
              <p className="form-help-text">
                Manage the BSM backends you connect to. Each saved instance
                keeps its own sign-in and workspace.
              </p>
              <dl>
                <dt>Current backend</dt>
                <dd className="frontend-backend-address">
                  {getConnectionIdentity()}
                </dd>
              </dl>
              <div className="form-actions">
                <Link className="action-button primary-button" to="/instances">
                  Manage saved instances
                </Link>
                {canConfigure && (
                  <button
                    className="action-button secondary"
                    onClick={() => setShowConnection(true)}
                  >
                    Configure default connection
                  </button>
                )}
              </div>
            </section>
          )}
          {active === "diagnostics" && <FrontendRecordingSettings />}
        </div>
      </div>
      {showConnection && (
        <RemoteConfigModal isOpen onClose={() => setShowConnection(false)} />
      )}
    </div>
  );
}
