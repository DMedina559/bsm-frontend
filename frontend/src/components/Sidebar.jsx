import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useServer } from "../ServerContext";
import { useToast } from "../ToastContext";
import { getApiProxyBasePath } from "../utils/basePath";
import { get } from "../api";
import { logger } from "../utils/logger";
import {
  LayoutDashboard,
  Users,
  Settings,
  Database,
  Server,
  ScrollText,
  LogOut,
  Package,
  User,
  Plug,
  Wrench,
  Shield,
  RefreshCw,
  PlusSquare,
  Gamepad2,
  ChevronLeft,
  UserCheck,
  ChevronRight,
  Palette,
  Code,
  Search,
} from "lucide-react";
import "../styles/SidebarEnhanced.css";
const Sidebar = ({ mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const { logout, user } = useAuth();
  const { addToast } = useToast();
  const {
    servers,
    selectedServer,
    setSelectedServer,
    refreshServers,
    loading,
  } = useServer();
  const [pluginPages, setPluginPages] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "true",
  );
  const [appVersion, setAppVersion] = useState("Unknown");
  const [splashText, setSplashText] = useState("");
  const [query, setQuery] = useState("");
  const effectiveCollapsed = isCollapsed && !mobileOpen;
  useEffect(() => {
    let active = true;
    get("/api/info")
      .then((data) => {
        if (!active) return;
        setAppVersion(data?.info?.app_version || "Unknown");
        setSplashText(data?.info?.splash_text || data?.data?.splash_text || "");
      })
      .catch((error) =>
        logger.warn("[Sidebar] Unable to load platform info", {
          error,
        }),
      );
    get("/api/plugins/pages")
      .then((data) => {
        if (active && data?.status === "success" && Array.isArray(data.pages))
          setPluginPages(data.pages);
      })
      .catch((error) =>
        logger.warn("[Sidebar] Unable to load plugin pages", {
          error,
        }),
      );
    return () => {
      active = false;
    };
  }, []);
  const toggleSidebar = () => {
    setIsCollapsed((previous) => {
      localStorage.setItem("sidebarCollapsed", String(!previous));
      return !previous;
    });
  };
  const handleNavClick = () => {
    if (mobileOpen) setMobileOpen?.(false);
  };
  const refresh = async () => {
    if (await refreshServers()) addToast("Server list refreshed", "success");
    else addToast("Server list could not be refreshed", "error");
  };
  const groups = [
    {
      label: "Fleet",
      items: [
        {
          path: "/",
          label: "Overview",
          icon: LayoutDashboard,
          end: true,
        },
        ...(user?.role === "admin"
          ? [
              {
                path: "/server-install",
                label: "Install Server",
                icon: PlusSquare,
              },
            ]
          : []),
      ],
    },
    {
      label: "Selected server",
      items: [
        {
          path: "/monitor",
          label: "Monitor",
          icon: LayoutDashboard,
          server: true,
        },
        {
          path: "/online-players",
          label: "Online Players",
          icon: UserCheck,
          server: true,
        },
        {
          path: "/server-config",
          label: "Settings",
          icon: Wrench,
          server: true,
        },
        {
          path: "/server-properties",
          label: "Properties",
          icon: Server,
          server: true,
        },
        {
          path: "/access-control",
          label: "Access Control",
          icon: Shield,
          server: true,
        },
        {
          path: "/backups",
          label: "Backups",
          icon: Database,
          server: true,
        },
        {
          path: "/content",
          label: "Content",
          icon: Package,
          server: true,
        },
      ],
    },
    {
      label: "Players",
      items: [
        {
          path: "/global-players",
          label: "Players",
          icon: Gamepad2,
        },
      ],
    },
    {
      label: "Global",
      items: [
        {
          path: "/plugins",
          label: "Plugins",
          icon: Plug,
        },
        {
          path: "/bsm-settings",
          label: "Global Settings",
          icon: Settings,
        },
        ...(sessionStorage.getItem("show_hidden_flag") === "true"
          ? [
              {
                path: "/playground",
                label: "Playground",
                icon: Code,
              },
            ]
          : []),
      ],
    },
    {
      label: "Administration",
      items: [
        {
          path: "/users",
          label: "Users",
          icon: Users,
        },
        {
          path: "/audit-log",
          label: "Logs & tasks",
          icon: ScrollText,
        },
      ],
    },
    ...(pluginPages.length
      ? [
          {
            label: "Extensions",
            items: pluginPages.map((page) => ({
              path: `/plugin-native-view?url=${encodeURIComponent(page.path)}`,
              label: page.name,
              icon: Plug,
              pluginPath: page.path,
            })),
          },
        ]
      : []),
  ];
  const filtered = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${group.label} ${item.label}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    }))
    .filter((group) => group.items.length);
  return (
    <aside
      id="platform-navigation"
      aria-label="Main navigation"
      className={`sidebar-nav ${effectiveCollapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
    >
      <header className="sidebar-header">
        <img
          className="sidebar-brand-icon"
          src={`${getApiProxyBasePath()}/app/image/icon/favicon-96x96.png`}
          alt="Bedrock Server Manager"
        />
        {!effectiveCollapsed && (
          <div className="sidebar-brand">
            <strong>
              Bedrock<span>Server Manager</span>
            </strong>
            <small className="platform-brand-version">
              Version {appVersion}
            </small>
          </div>
        )}
        <button
          className="icon-button sidebar-collapse"
          onClick={() => {
            if (mobileOpen) setMobileOpen?.(false);
            else toggleSidebar();
          }}
          aria-label={
            mobileOpen
              ? "Close Sidebar"
              : effectiveCollapsed
                ? "Expand Sidebar"
                : "Collapse Sidebar"
          }
          type="button"
        >
          {effectiveCollapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronLeft size={16} />
          )}
        </button>
      </header>
      {!effectiveCollapsed && (
        <>
          {splashText && <p className="sidebar-splash">{splashText}</p>}
          <div className="sidebar-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              className="form-input"
              placeholder="Find a page…"
              aria-label="Search navigation"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="sidebar-server-picker">
            <label className="form-label" htmlFor="server-select">
              Server workspace
            </label>
            <div className="inline-controls">
              <select
                id="server-select"
                className="form-input"
                value={selectedServer || ""}
                onChange={(event) => setSelectedServer(event.target.value)}
                disabled={loading || !servers.length}
              >
                <option value="" disabled>
                  {loading ? "Loading servers…" : "Select a server"}
                </option>
                {servers.map((server) => (
                  <option key={server.name} value={server.name}>
                    {server.name}
                  </option>
                ))}
              </select>
              <button
                className="icon-button"
                title="Refresh Server List"
                aria-label="Refresh Server List"
                onClick={refresh}
                disabled={loading}
                type="button"
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} />
              </button>
            </div>
          </div>
        </>
      )}
      <nav aria-label="Application pages">
        {filtered.map((group) => (
          <div className="nav-group" key={group.label}>
            {!effectiveCollapsed && (
              <h2 className="nav-section-label">{group.label}</h2>
            )}
            {group.items.map((item) => {
              const disabled = item.server && !selectedServer;
              const Icon = item.icon;
              const pluginActive =
                item.pluginPath &&
                location.pathname === "/plugin-native-view" &&
                new URLSearchParams(location.search).get("url") ===
                  item.pluginPath;
              return (
                <NavLink
                  key={item.path}
                  to={disabled ? "#" : item.path}
                  end={item.end}
                  aria-disabled={disabled || undefined}
                  tabIndex={disabled ? -1 : undefined}
                  className={({ isActive }) =>
                    `nav-link ${!disabled && (item.pluginPath ? pluginActive : isActive) ? "active" : ""} ${disabled ? "disabled" : ""}`
                  }
                  title={
                    disabled
                      ? "Select a server to open this page"
                      : effectiveCollapsed
                        ? item.label
                        : undefined
                  }
                  onClick={(event) => {
                    if (disabled) event.preventDefault();
                    else handleNavClick();
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                  {effectiveCollapsed ? (
                    <span className="sr-only">{item.label}</span>
                  ) : (
                    <span className="nav-label">{item.label}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
        {!filtered.length && (
          <p className="navigation-empty">No matching pages.</p>
        )}
      </nav>
      <div className="footer-nav">
        <NavLink
          to="/appearance"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          onClick={handleNavClick}
          title="Appearance"
        >
          <Palette size={18} />
          {effectiveCollapsed ? (
            <span className="sr-only">Appearance</span>
          ) : (
            <span>Appearance</span>
          )}
        </NavLink>
        <NavLink
          to="/account"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          onClick={handleNavClick}
        >
          <User size={18} />
          {effectiveCollapsed ? (
            <span className="sr-only">Account</span>
          ) : (
            <span>Account</span>
          )}
        </NavLink>
        <button
          className="nav-link logout-button"
          onClick={() => {
            handleNavClick();
            logout();
          }}
          type="button"
        >
          <LogOut size={18} />
          {effectiveCollapsed ? (
            <span className="sr-only">Logout</span>
          ) : (
            <span>Logout</span>
          )}
        </button>
        {!effectiveCollapsed && (
          <div className="sidebar-version">
            <span>Frontend {__APP_VERSION__}</span>
          </div>
        )}
      </div>
    </aside>
  );
};
export default Sidebar;
