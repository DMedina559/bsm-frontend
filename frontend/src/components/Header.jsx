import React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useServer } from "../ServerContext";
import { ChevronRight, ShieldCheck, Server } from "lucide-react";
import "./Header.css";

const Header = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { selectedServer } = useServer();

  // Format breadcrumbs based on route
  const getBreadcrumbs = () => {
    const rawPath = location.pathname.trim().replace(/^\/|\/$/g, "");
    if (!rawPath) return [{ label: "Overview", active: true }];

    const segments = rawPath.split("/");
    const items = [{ label: "Platform", active: false }];

    if (selectedServer) {
      items.push({ label: selectedServer, active: false });
    }

    segments.forEach((seg, idx) => {
      const formatted = seg.replace(/-/g, " ");
      items.push({
        label: formatted,
        active: idx === segments.length - 1,
      });
    });

    return items;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="platform-header">
      <div className="header-left">
        <div className="header-breadcrumbs">
          {breadcrumbs.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <ChevronRight className="breadcrumb-separator" size={14} />
              )}
              <span
                className={`breadcrumb-item ${item.active ? "active" : ""}`}
              >
                {idx === 0 && <Server size={14} />}
                {item.label}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="header-right">
        <div className="system-status-badge">
          <span className="status-pulse" />
          <span>Nodes Active & Operational</span>
        </div>

        {user && (
          <div className="header-user-badge">
            <div className="user-avatar-dot">
              {user.username ? user.username.charAt(0).toUpperCase() : "U"}
            </div>
            <span>{user.username || "User"}</span>
            <ShieldCheck
              size={14}
              style={{ color: "var(--neon-cyan, #00e5ff)" }}
            />
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
