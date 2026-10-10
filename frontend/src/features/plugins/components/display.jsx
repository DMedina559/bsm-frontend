import { useState, useEffect, useRef } from "react";
import { useToast } from "../../../contexts/ToastContext";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Copy,
  ExternalLink,
} from "lucide-react";
import { isSafeUrl } from "../../../utils/urlValidation";
import { logger } from "../../../utils/logger";
import { PluginIcon } from "./icons";
export const displayComponents = {
  Text: ({ content, variant = "body", className = "" }) => {
    const Tag =
      variant === "h1"
        ? "h1"
        : variant === "h2"
          ? "h2"
          : variant === "h3"
            ? "h3"
            : "p";
    return <Tag className={className}>{content}</Tag>;
  },
  Label: ({ content, htmlFor, className = "" }) => (
    <label htmlFor={htmlFor} className={`form-label ${className}`}>
      {content}
    </label>
  ),
  Badge: ({ content, variant = "primary", className = "" }) => (
    <span className={`badge ${variant} ${className}`}>{content}</span>
  ),
  CodeBlock: ({ content, title, className = "" }) => {
    const { addToast } = useToast();
    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(content);
        addToast("Copied to clipboard", "success");
      } catch {
        addToast("Could not copy. Select and copy the text manually.", "error");
      }
    };
    return (
      <div className={`code-block ${className}`}>
        {(title || content) && (
          <div className="code-block-header">
            {title && <span>{title}</span>}
            <button
              onClick={copyToClipboard}
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
              }}
              title="Copy"
              type="button"
              aria-label="Copy"
            >
              <PluginIcon name="Copy" size={14} />
            </button>
          </div>
        )}
        <code>{content}</code>
      </div>
    );
  },
  Image: ({ src, alt, width, height, className = "" }) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={`dynamic-image ${className}`}
    />
  ),
  iframe: ({ src, title, height = "400px", className = "" }) => {
    if (!isSafeUrl(src)) {
      logger.warn(`[DynamicPage] Blocked unsafe iframe src`, {
        src,
      });
      return (
        <div
          className={`dynamic-iframe ${className}`}
          style={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,0,0,0.1)",
            border: "1px solid red",
            color: "red",
          }}
        >
          Blocked unsafe iframe content
        </div>
      );
    }
    return (
      <iframe
        src={src}
        title={title || "Plugin content"}
        height={height}
        className={`dynamic-iframe ${className}`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    );
  },
  Link: ({ href, label, target = "_self", className = "", icon }) => {
    const Icon = icon
      ? PluginIcon({
          name: icon,
          size: 14,
        })
      : target === "_blank"
        ? PluginIcon({
            name: "ExternalLink",
            size: 14,
          })
        : null;
    return (
      <a
        href={href}
        target={target}
        className={`action-link ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "calc(5px * var(--bsm-spacing-scale))",
        }}
      >
        {label}
        {Icon}
      </a>
    );
  },
  LogViewer: ({ lines, height = 200, className = "" }) => {
    const containerRef = useRef(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const handleScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
      setAutoScroll(isAtBottom);
    };
    useEffect(() => {
      const el = containerRef.current;
      if (el && autoScroll) {
        el.scrollTop = el.scrollHeight;
      }
    }, [lines, autoScroll]);
    return (
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`log-viewer ${className}`}
        style={{
          height,
          position: "relative",
        }}
      >
        {!lines || lines.length === 0 ? (
          <div className="log-placeholder">Waiting for logs...</div>
        ) : (
          lines.map((line, idx) => (
            <div key={idx} className="log-line">
              {line}
            </div>
          ))
        )}
        {!autoScroll && lines && lines.length > 0 && (
          <button
            type="button"
            className="log-viewer-scroll-btn"
            onClick={() => {
              setAutoScroll(true);
              if (containerRef.current) {
                containerRef.current.scrollTop =
                  containerRef.current.scrollHeight;
              }
            }}
            style={{
              position: "sticky",
              bottom: "10px",
              float: "right",
              background: "rgba(0, 123, 255, 0.85)",
              color: "var(--text-color)",
              border: "none",
              borderRadius: "12px",
              padding:
                "calc(4px * var(--bsm-spacing-scale)) calc(10px * var(--bsm-spacing-scale))",
              fontSize: "0.75rem",
              cursor: "pointer",
              boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
              zIndex: 5,
            }}
          >
            Scroll to bottom
          </button>
        )}
      </div>
    );
  },
  StatCard: ({ label, value, icon, trend, className = "" }) => (
    <div className={`stat-card ${className}`}>
      {icon && (
        <div className="stat-icon">
          <PluginIcon name={icon} size={24} />
        </div>
      )}
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {trend && (
          <div
            className={`stat-trend ${trend === "up" ? "trend-up" : trend === "down" ? "trend-down" : ""}`}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "•"}
          </div>
        )}
      </div>
    </div>
  ),
  StatusIndicator: ({ status, text, className = "" }) => (
    <span className={`status-indicator status-${status} ${className}`}>
      <span className="status-dot">●</span> {text}
    </span>
  ),
  ProgressBar: ({
    value = 0,
    max = 100,
    showLabel = true,
    variant = "primary",
    className = "",
  }) => {
    const percentage = Math.min(
      100,
      Math.max(0, Math.round((value / max) * 100)),
    );
    return (
      <div
        className={`progress-bar-container ${className}`}
        style={{
          width: "100%",
          margin: "calc(8px * var(--bsm-spacing-scale)) 0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.85rem",
            marginBottom: "calc(4px * var(--bsm-spacing-scale))",
          }}
        >
          {showLabel && <span>{percentage}%</span>}
        </div>
        <div
          style={{
            width: "100%",
            height: "10px",
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: "5px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percentage}%`,
              height: "100%",
              backgroundColor:
                variant === "danger"
                  ? "var(--bsm-danger)"
                  : variant === "warning"
                    ? "var(--bsm-warning)"
                    : variant === "success"
                      ? "var(--bsm-success)"
                      : "var(--primary-color, #007bff)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
    );
  },
  Alert: ({ title, message, variant = "info", icon, className = "" }) => {
    const defaultIcon =
      variant === "danger" || variant === "error"
        ? "AlertCircle"
        : variant === "success"
          ? "CheckCircle2"
          : "Info";
    const IconComponent = PluginIcon({
      name: icon || defaultIcon,
      size: 20,
    });
    return (
      <div className={`alert-box alert-${variant} ${className}`}>
        <div className="alert-icon">{IconComponent}</div>
        <div className="alert-content">
          {title && <div className="alert-title">{title}</div>}
          {message && <div className="alert-message">{message}</div>}
        </div>
      </div>
    );
  },
  Table: ({ headers, rows, className = "" }) => (
    <div className="table-container">
      <table className={`data-table ${className}`}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
};
