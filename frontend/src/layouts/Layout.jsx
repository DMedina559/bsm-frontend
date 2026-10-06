import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import { Menu, ChevronRight, Radio } from "lucide-react";
import { useAuth } from "../AuthContext";
import { useServer } from "../ServerContext";
import { useWebSocket } from "../WebSocketContext";
import { PAGE_INFO } from "../utils/navigation";
import { useFocusTrap } from "../utils/useFocusTrap";

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { selectedServer } = useServer();
  const { isConnected, isFallback } = useWebSocket();
  const [group, title, description] = PAGE_INFO[pathname] || [
    "Platform",
    "Workspace",
    "",
  ];
  const mainRef = useRef(null);
  const navigationRef = useRef(null);
  useFocusTrap(navigationRef, mobileOpen, () => setMobileOpen(false));
  useEffect(() => {
    document.title = `${title} · Bedrock Server Manager 4.0`;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, title]);

  return (
    <div className="page-layout">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <div ref={navigationRef} className="navigation-shell">
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      </div>
      <div className="workspace-shell" inert={mobileOpen ? true : undefined}>
        <header className="workspace-topbar">
          <button
            className="icon-button mobile-menu-toggle"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-controls="platform-navigation"
          >
            <Menu size={20} />
          </button>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link to="/">{group}</Link>
            <ChevronRight size={12} />
            <span aria-current="page">{title}</span>
          </nav>
          <div className="workspace-indicators">
            <span
              className={`connection-indicator ${isConnected ? "connected" : "degraded"}`}
              title="Update connection; not an overall platform health check"
            >
              <Radio size={14} />
              {isConnected ? "Live" : isFallback ? "Polling" : "Offline"}
            </span>
            <Link className="account-chip" to="/account">
              <span className="avatar">
                {user?.username?.slice(0, 1).toUpperCase() || "U"}
              </span>
              <span>{user?.username}</span>
            </Link>
          </div>
        </header>
        <main
          id="main-content"
          className="main-content"
          ref={mainRef}
          tabIndex={-1}
        >
          <div className="page-context">
            <span>{description}</span>
            {group === "Selected server" && (
              <span className="workspace-server">
                {selectedServer || "No server selected"}
              </span>
            )}
          </div>
          <Outlet />
          <Footer />
        </main>
      </div>
    </div>
  );
};
export default Layout;
