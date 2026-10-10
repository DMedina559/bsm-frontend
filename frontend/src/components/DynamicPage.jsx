import { useRequestTracker } from "../utils/useRequestTracker";
import Modal from "./Modal";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { request, downloadFile } from "../api";
import { useToast } from "../ToastContext";
import { useSearchParams } from "react-router-dom";
import { useServer } from "../ServerContext";
import { useWebSocket } from "../WebSocketContext";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Info,
  Terminal,
  Save,
  Trash2,
  Plus,
  X,
  Upload,
  Download,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Play,
  Square,
  RotateCcw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import "../styles/DynamicPage.css";
import { isSafeUrl } from "../utils/urlValidation";
import { logger } from "../utils/logger";
import DraggableList from "./DraggableList";

// --- Component Registry ---
const ComponentRegistry = {
  // Layout
  Container: ({ children, className = "" }) => (
    <div className={`container ${className}`}>{children}</div>
  ),
  Card: ({ title, children, className = "" }) => (
    <div className={`server-card ${className}`}>
      {title && (
        <div className="server-card-header">
          <h3>{title}</h3>
        </div>
      )}
      <div className="server-card-body">{children}</div>
    </div>
  ),
  Row: ({ children, gap = "10px", className = "" }) => (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "row",
        gap,
        flexWrap: "wrap",
      }}
    >
      {children}
    </div>
  ),
  Column: ({ children, gap = "10px", className = "", flex = 1 }) => (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        flex,
      }}
    >
      {children}
    </div>
  ),
  Divider: ({ className = "" }) => <hr className={`divider ${className}`} />,
  // Typography
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
              <ComponentRegistry.Icon name="Copy" size={14} />
            </button>
          </div>
        )}
        <code>{content}</code>
      </div>
    );
  },
  // Basic Inputs
  Button: ({
    label,
    onClick,
    variant = "primary",
    icon,
    disabled = false,
    className = "",
  }) => {
    const Icon = icon
      ? ComponentRegistry.Icon({
          name: icon,
          size: 16,
        })
      : null;
    return (
      <button
        className={`action-button ${variant === "secondary" ? "secondary" : ""} ${variant === "danger" ? "danger-button" : variant === "primary" ? "primary-button" : ""} ${className}`}
        onClick={onClick}
        disabled={disabled}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
        type="button"
      >
        {Icon}
        {label}
      </button>
    );
  },
  Input: ({
    id,
    name,
    label,
    ariaLabel,
    type = "text",
    value,
    onChange,
    placeholder,
    className = "",
    readOnly = false,
    disabled = false,
  }) => (
    <input
      id={id}
      name={name}
      aria-label={
        ariaLabel || label || (name ? name.replace(/[_-]/g, " ") : undefined)
      }
      type={type}
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      className={`form-input ${className}`}
      readOnly={readOnly}
      disabled={disabled}
    />
  ),
  Textarea: ({
    id,
    name,
    label,
    ariaLabel,
    value,
    onChange,
    placeholder,
    rows = 4,
    className = "",
    readOnly = false,
    disabled = false,
  }) => (
    <textarea
      id={id}
      name={name}
      aria-label={
        ariaLabel || label || (name ? name.replace(/[_-]/g, " ") : undefined)
      }
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`form-input ${className}`}
      readOnly={readOnly}
      disabled={disabled}
      style={{
        width: "100%",
        resize: "vertical",
      }}
    />
  ),
  Slider: ({
    id,
    name,
    label,
    ariaLabel,
    value = 0,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    className = "",
  }) => (
    <div
      className={`slider-container ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <input
        id={id}
        name={name}
        aria-label={
          ariaLabel || label || (name ? name.replace(/[_-]/g, " ") : undefined)
        }
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        disabled={disabled}
        style={{
          flex: 1,
        }}
      />
      <span className="slider-value-display">{value}</span>
    </div>
  ),
  Select: ({
    value,
    onChange,
    options,
    className = "",
    disabled = false,
    id,
    name,
    label,
    ariaLabel,
  }) => (
    <select
      id={id}
      name={name}
      aria-label={
        ariaLabel || label || (name ? name.replace(/[_-]/g, " ") : undefined)
      }
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      className={`form-input ${className}`}
      disabled={disabled}
    >
      {options &&
        options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
    </select>
  ),
  Switch: ({
    value,
    onChange,
    label,
    className = "",
    disabled = false,
    id,
  }) => (
    <div className={`switch-wrapper ${className}`}>
      <label className="switch" htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          checked={!!value}
          onChange={(e) => onChange && onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className="slider round"></span>
      </label>
      {label && (
        <label className="switch-label-text" htmlFor={id}>
          {label}
        </label>
      )}
    </div>
  ),
  Checkbox: ({
    value,
    onChange,
    label,
    className = "",
    disabled = false,
    id,
  }) => (
    <label className={`checkbox-wrapper ${className}`} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={!!value}
        onChange={(e) => onChange && onChange(e.target.checked)}
        disabled={disabled}
      />
      {label && <span className="form-label-inline">{label}</span>}
    </label>
  ),
  FileUpload: ({
    id,
    name,
    label,
    ariaLabel,
    accept,
    onChange,
    className = "",
  }) => (
    <input
      id={id}
      name={name}
      aria-label={
        ariaLabel || label || (name ? name.replace(/[_-]/g, " ") : undefined)
      }
      type="file"
      accept={accept}
      onChange={(e) => onChange && onChange(e.target.files[0])}
      className={`form-input ${className}`}
    />
  ),
  FileDownload: ({
    label,
    onClick,
    variant = "primary",
    className = "",
    style = {},
  }) => (
    <button
      className={`action-button ${variant === "secondary" ? "secondary" : ""} ${className}`}
      onClick={onClick}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: "5px",
      }}
      type="button"
    >
      <ComponentRegistry.Icon name="Download" size={16} />
      {label || "Download"}
    </button>
  ),
  // Media
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
      ? ComponentRegistry.Icon({
          name: icon,
          size: 14,
        })
      : target === "_blank"
        ? ComponentRegistry.Icon({
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
          gap: "5px",
        }}
      >
        {label}
        {Icon}
      </a>
    );
  },
  // Advanced Visualizations
  Chart: ({
    type = "line",
    data,
    xAxis,
    series,
    height = 300,
    className = "",
    showLegend = false,
    layout = "horizontal",
    colors = [
      "var(--bsm-info)",
      "var(--bsm-success)",
      "var(--bsm-warning)",
      "var(--bsm-chart-3)",
      "var(--bsm-chart-1)",
      "var(--bsm-chart-2)",
    ],
    nameKey = "name",
    valueKey = "value",
  }) => {
    if (type === "pie") {
      return (
        <div
          className={`chart-container ${className}`}
          style={{
            width: "100%",
            height: height,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bsm-surface-raised)",
                  border: "1px solid var(--border-color)",
                }}
                labelStyle={{
                  color: "var(--text-color-secondary)",
                }}
              />
              {showLegend && <Legend />}
              <Pie
                data={data}
                dataKey={valueKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                outerRadius="80%"
                fill="var(--bsm-chart-1)"
                label
              >
                {Array.isArray(data) &&
                  data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color || colors[index % colors.length]}
                    />
                  ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    const ChartComponent =
      type === "area" ? AreaChart : type === "bar" ? BarChart : LineChart;
    const DataComponent = type === "area" ? Area : type === "bar" ? Bar : Line;
    const isVertical = layout === "vertical";
    return (
      <div
        className={`chart-container ${className}`}
        style={{
          width: "100%",
          height: height,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={data} layout={layout}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            {isVertical ? (
              <>
                <XAxis type="number" stroke="var(--text-color-secondary)" />
                <YAxis
                  dataKey={xAxis}
                  type="category"
                  stroke="var(--text-color-secondary)"
                />
              </>
            ) : (
              <>
                <XAxis dataKey={xAxis} stroke="var(--text-color-secondary)" />
                <YAxis stroke="var(--text-color-secondary)" />
              </>
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--bsm-surface-raised)",
                border: "1px solid var(--border-color)",
              }}
              labelStyle={{
                color: "var(--text-color-secondary)",
              }}
            />
            {showLegend && <Legend />}
            {series &&
              series.map((s, idx) => (
                <DataComponent
                  key={idx}
                  type="monotone"
                  dataKey={s.dataKey}
                  stroke={s.color}
                  fill={s.color} // For Area/Bar
                  name={s.name || s.dataKey}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
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
              padding: "4px 10px",
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
          <ComponentRegistry.Icon name={icon} size={24} />
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
          margin: "8px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.85rem",
            marginBottom: "4px",
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
    const IconComponent = ComponentRegistry.Icon({
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
  // Icons
  Icon: ({ name, size = 20, className = "" }) => {
    const icons = {
      Activity,
      AlertCircle,
      CheckCircle2,
      Info,
      Terminal,
      Save,
      Trash2,
      Plus,
      X,
      Upload,
      Download,
      ChevronDown,
      ChevronUp,
      Copy,
      ExternalLink,
      Play,
      Square,
      RotateCcw,
    };
    const LucideIcon = icons[name] || Info;
    return <LucideIcon size={size} className={className} />;
  },
  // Advanced
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
  Accordion: ({ title, children, defaultOpen = false, className = "" }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
      <div className={`accordion ${className}`}>
        <button
          type="button"
          className="accordion-header"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
        >
          {title}
          <ComponentRegistry.Icon
            name={isOpen ? "ChevronUp" : "ChevronDown"}
            size={16}
          />
        </button>
        {isOpen && <div className="accordion-body">{children}</div>}
      </div>
    );
  },
  Modal: ({ isOpen, onClose, title, children, className = "" }) => (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      className={className}
    >
      {children}
    </Modal>
  ),
  // Navigation
  Tabs: ({ children, activeTab, onTabChange, className = "" }) => {
    const [localActive, setLocalActive] = useState(activeTab || 0);

    // If activeTab changes from prop (e.g. schema re-fetch with new default), update state
    useEffect(() => {
      if (activeTab !== undefined) {
        setLocalActive(activeTab);
      }
    }, [activeTab]);

    // If children is not an array, make it one
    const childArray = React.Children.toArray(children);
    const tabHeaders = childArray.map((child, index) => {
      return {
        id: child.props.id || index,
        label: child.props.label || `Tab ${index + 1}`,
      };
    });
    const isControlled = onTabChange !== undefined;
    const currentTabId =
      isControlled && activeTab !== undefined ? activeTab : localActive;
    const handleTabClick = (id) => {
      if (!isControlled) {
        setLocalActive(id);
      }
      if (onTabChange) onTabChange(id);
    };
    return (
      <div className={`tabs-container ${className}`}>
        <div
          className="tabs-header"
          style={{
            display: "flex",
            gap: "10px",
            borderBottom: "1px solid var(--border-color)",
            marginBottom: "15px",
          }}
        >
          {tabHeaders.map((header) => (
            <button
              key={header.id}
              className={`tab-button ${currentTabId === header.id ? "active" : ""}`}
              onClick={() => handleTabClick(header.id)}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "none",
                borderBottom:
                  currentTabId === header.id
                    ? "2px solid var(--primary-color, #007bff)"
                    : "2px solid transparent",
                cursor: "pointer",
                fontWeight: currentTabId === header.id ? "bold" : "normal",
                color: "inherit",
              }}
              type="button"
              aria-pressed={currentTabId === header.id}
            >
              {header.label}
            </button>
          ))}
        </div>
        <div className="tabs-content">
          {childArray.map((child) => {
            const childId = child.props.id || childArray.indexOf(child);
            if (childId !== currentTabId) return null;
            return <div key={childId}>{child}</div>;
          })}
        </div>
      </div>
    );
  },
  Tab: ({ children, className = "" }) => (
    <div className={`tab-panel ${className}`}>{children}</div>
  ),
  DraggableList: ({
    items,
    onReorder,
    renderItem,
    className,
    itemClassName,
  }) => (
    <DraggableList
      items={items}
      onReorder={onReorder}
      renderItem={renderItem}
      className={className}
      itemClassName={itemClassName}
    />
  ),
};
const DynamicPage = ({ schemaJson }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dataUrl = searchParams.get("url");
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();
  const { selectedServer } = useServer();
  const { isConnected, subscribe, unsubscribe, addMessageListener } =
    useWebSocket();

  // State for inputs (basic form handling)
  // We'll store input values in a map: { [inputId]: value }
  const [formState, setFormState] = useState({});
  // State for active modal
  const [activeModalId, setActiveModalId] = useState(null);
  // State for WebSocket data: { [topic]: messageData }
  const [socketData, setSocketData] = useState({});

  // Using useCallback to define fetchSchema so it can be added to dependencies
  const beginRequest = useRequestTracker(`${dataUrl}:${selectedServer}`);
  const fetchSchema = useCallback(
    async (url, server) => {
      const requestTicket = beginRequest("schema");
      setLoading(true);
      setError(null);
      try {
        // Construct URL with current search params
        const fetchUrlObj = new URL(url, window.location.origin);

        // Merge current search params into the fetch URL, excluding 'url' itself
        searchParams.forEach((value, key) => {
          if (key !== "url" && !fetchUrlObj.searchParams.has(key)) {
            fetchUrlObj.searchParams.append(key, value);
          }
        });

        // Append selected server if not present
        if (server && !fetchUrlObj.searchParams.has("server")) {
          fetchUrlObj.searchParams.append("server", server);
        }
        const relativeFetchUrl = fetchUrlObj.pathname + fetchUrlObj.search;
        const response = await request(relativeFetchUrl);
        if (!requestTicket.current()) return;
        // Verify if response is valid schema
        if (
          response &&
          (Array.isArray(response) || typeof response === "object")
        ) {
          setSchema(response);
        } else {
          logger.warn("[DynamicPage] Invalid page definition response", {
            response,
          });
          setError("Invalid page definition.");
        }
      } catch (err) {
        if (!requestTicket.current()) return;
        logger.error("[DynamicPage] Error loading page", {
          error: err,
        });
        setError(err.message || "Error loading page.");
      } finally {
        if (requestTicket.current()) setLoading(false);
      }
    },
    [searchParams, beginRequest],
  ); // Dependent on searchParams

  useEffect(() => {
    if (schemaJson) {
      setFormState({});
      setActiveModalId(null);
      setSocketData({});
      setSchema(schemaJson);
      setLoading(false);
      setError(null);
    } else if (dataUrl) {
      setFormState({}); // Clear state on URL change
      setActiveModalId(null);
      setSocketData({}); // Clear socket data on page change
      fetchSchema(dataUrl, selectedServer);
    } else {
      setError("No schema URL provided");
      setLoading(false);
    }
  }, [dataUrl, selectedServer, fetchSchema, schemaJson]);

  // Handle auto-refresh / polling schema if specified
  useEffect(() => {
    let refreshIntervalId = null;

    // Check if schema or schema root object has refreshInterval (in ms or seconds)
    const intervalMs =
      schema && typeof schema === "object" && !Array.isArray(schema)
        ? schema.refreshInterval
        : null;
    if (intervalMs && dataUrl && !schemaJson) {
      const interval =
        Number(intervalMs) < 1000
          ? Number(intervalMs) * 1000
          : Number(intervalMs);
      if (interval > 0) {
        refreshIntervalId = setInterval(() => {
          fetchSchema(dataUrl, selectedServer);
        }, interval);
      }
    }
    return () => {
      if (refreshIntervalId) clearInterval(refreshIntervalId);
    };
  }, [schema, dataUrl, selectedServer, fetchSchema, schemaJson]);

  // Handle WebSocket subscriptions defined in schema
  useEffect(() => {
    if (!schema || !schema.websocketSubscriptions || !isConnected) return;
    const topics = schema.websocketSubscriptions
      .map((sub) => {
        // Replace placeholders like {server} with actual values
        return sub.replace("{server}", selectedServer || "");
      })
      .filter(Boolean);
    topics.forEach((topic) => subscribe(topic));
    return () => {
      topics.forEach((topic) => unsubscribe(topic));
    };
  }, [schema, isConnected, selectedServer, subscribe, unsubscribe]);

  // Plugin pages only retain snapshots for their declared subscriptions.
  useEffect(() => {
    setSocketData({});
    const topics = new Set(
      (schema?.websocketSubscriptions ?? []).map((topic) =>
        topic.replace("{server}", selectedServer || ""),
      ),
    );
    if (!topics.size) return;
    return addMessageListener((message) => {
      if (!topics.has(message.topic)) return;
      setSocketData((previous) => ({ ...previous, [message.topic]: message }));
    });
  }, [schema, selectedServer, addMessageListener]);
  const handleAction = async (actionDef) => {
    if (!actionDef) return;
    if (actionDef.type === "api_call") {
      try {
        // Merge formState into payload if configured
        let payload = actionDef.payload || {};
        if (actionDef.includeFormState) {
          payload = {
            ...payload,
            ...formState,
          };
        }
        let res;
        // Check for File objects in payload -> use FormData
        const hasFile = Object.values(payload).some(
          (val) => val instanceof File,
        );
        if (hasFile) {
          const formData = new FormData();
          Object.entries(payload).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              formData.append(key, value);
            }
          });
          // api.post handles FormData correctly (lets browser set Content-Type)
          res = await request(actionDef.endpoint, {
            method: "POST",
            body: formData,
          });
        } else {
          res = await request(actionDef.endpoint, {
            method: "POST",
            body: payload,
          });
        }
        if (res && res.status === "success") {
          addToast(res.message || "Action successful", "success");
          // Refresh logic if needed
          if (actionDef.refresh) {
            // Trigger re-fetch logic if extracted
            if (dataUrl) {
              fetchSchema(dataUrl, selectedServer);
            }
          }
          if (actionDef.closeModal) setActiveModalId(null);
        } else {
          addToast(res?.message || "Action failed", "error");
        }
      } catch (err) {
        addToast(err.message || "Action error", "error");
      }
    } else if (actionDef.type === "download_file") {
      try {
        await downloadFile(
          actionDef.endpoint,
          actionDef.filename || "download",
        );
      } catch (err) {
        addToast("Download failed: " + err.message, "error");
      }
    } else if (actionDef.type === "navigate") {
      if (actionDef.params) {
        const newParams = new URLSearchParams(searchParams);
        Object.keys(actionDef.params).forEach((key) => {
          newParams.set(key, actionDef.params[key]);
        });
        setSearchParams(newParams);
      } else if (actionDef.url) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("url", actionDef.url);
        setSearchParams(newParams);
      }
    } else if (actionDef.type === "open_modal") {
      if (actionDef.modalId) {
        setActiveModalId(actionDef.modalId);
      }
    } else if (actionDef.type === "close_modal") {
      setActiveModalId(null);
    }
  };
  const handleInputChange = (id, value) => {
    setFormState((prev) => ({
      ...prev,
      [id]: value,
    }));
  };
  const renderNode = (node, key) => {
    if (!node) return null;
    if (typeof node === "string") return node;
    const Component = ComponentRegistry[node.type];
    if (!Component) {
      logger.warn(`[DynamicPage] Unknown component type`, {
        nodeType: node.type,
        node,
      });
      return (
        <div
          key={key}
          style={{
            color: "red",
            border: "1px dashed red",
            padding: "5px",
          }}
        >
          Unknown component: {node.type}
        </div>
      );
    }
    const props = {
      ...node.props,
    };

    // Inject Socket Data if needed
    if (props.socketTopic) {
      const topic = props.socketTopic.replace("{server}", selectedServer || "");
      const latestMsg = socketData[topic];
      props.latestSocketMessage = latestMsg;
    }

    // Wrapper for Chart to handle internal state for history
    if (node.type === "Chart") {
      return <ChartWrapper key={key} {...props} />;
    }

    // Wrapper for LogViewer
    if (node.type === "LogViewer") {
      return <LogViewerWrapper key={key} {...props} />;
    }

    // Wrapper for StatCard
    if (node.type === "StatCard") {
      return <StatCardWrapper key={key} {...props} />;
    }

    // Dynamic evaluation for visibleIf and disabledIf
    const evaluateRule = (rule) => {
      if (!rule) return undefined;
      const { field, equals, notEquals, in: inArray } = rule;
      if (!field) return undefined;
      const fieldValue = formState[field];
      if (equals !== undefined) return fieldValue === equals;
      if (notEquals !== undefined) return fieldValue !== notEquals;
      if (Array.isArray(inArray)) return inArray.includes(fieldValue);
      return !!fieldValue;
    };
    if (props.visibleIf) {
      const isVisible = evaluateRule(props.visibleIf);
      if (isVisible === false) return null;
    }
    if (props.disabledIf) {
      const isDisabled = evaluateRule(props.disabledIf);
      if (isDisabled !== undefined) {
        props.disabled = isDisabled;
      }
    }

    // Handle input binding
    if (
      node.type === "Input" ||
      node.type === "Textarea" ||
      node.type === "Slider" ||
      node.type === "Select" ||
      node.type === "Switch" ||
      node.type === "Checkbox"
    ) {
      const formKey = props.id || props.name;
      if (formKey) {
        const stateValue = formState[formKey];

        // For Switch and Checkbox, value is boolean
        if (node.type === "Switch" || node.type === "Checkbox") {
          props.value =
            stateValue !== undefined
              ? stateValue
              : props.checked || props.defaultChecked || false;
        } else {
          props.value =
            stateValue !== undefined
              ? stateValue
              : props.value || props.defaultValue || "";
        }
        props.onChange = (val) => {
          handleInputChange(formKey, val);
          if (props.onChangeAction) {
            const action = {
              ...props.onChangeAction,
            };

            // If it's a navigation action, we might want to dynamically set a param based on the value
            if (action.type === "navigate" && action.dynamicParam) {
              if (!action.params) action.params = {};
              action.params[action.dynamicParam] = val;
            }
            handleAction(action);
          }
        };
      } else {
        if (node.type === "Input") props.readOnly = true;
      }
    }
    if (node.type === "FileUpload") {
      const formKey = props.id || props.name;
      if (formKey) {
        props.onChange = (file) => handleInputChange(formKey, file);
      }
    }
    if (node.type === "FileDownload") {
      props.onClick = () =>
        handleAction({
          type: "download_file",
          endpoint: props.endpoint,
          filename: props.filename,
        });
    }

    // Modal specific props
    if (node.type === "Modal") {
      props.isOpen = activeModalId === props.id;
      props.onClose = () => setActiveModalId(null);
    }
    if (node.type === "DraggableList") {
      props.onReorder = (newItems) => {
        if (props.onReorderAction) {
          const action = {
            ...props.onReorderAction,
          };
          action.payload = {
            ...action.payload,
            items: newItems,
          };
          handleAction(action);
        }
      };
      props.renderItem = (item, index) => {
        // Expect props.itemTemplate to be a function that takes an item and returns a node
        if (props.itemTemplate && typeof props.itemTemplate === "function") {
          return renderNode(
            props.itemTemplate(item, index),
            `draggable-item-${item.id}`,
          );
        }
        return <div>{item.name || item.id}</div>;
      };
    }

    // Special handling for Table rows to recursively render cells
    if (node.type === "Table" && Array.isArray(props.rows)) {
      props.rows = props.rows.map((row, rIndex) =>
        Array.isArray(row)
          ? row.map((cell, cIndex) => {
              if (cell && typeof cell === "object" && cell.type) {
                // Recursively render the cell if it looks like a component node
                return renderNode(cell, `row-${rIndex}-cell-${cIndex}`);
              }
              return cell;
            })
          : row,
      );
    }

    // Handle actions
    if (props.onClickAction) {
      props.onClick = () => handleAction(props.onClickAction);
      // delete props.onClickAction; // keep it or remove it, doesn't matter much for HTML props unless it leaks
    }
    const children = node.children
      ? node.children.map((child, i) => renderNode(child, i))
      : null;
    return (
      <Component key={key} {...props}>
        {children}
      </Component>
    );
  };
  if (loading) return <div className="container">Loading...</div>;
  if (error)
    return (
      <div className="container">
        <div className="message error">Error: {error}</div>
      </div>
    );
  if (!schema) return <div className="container">No schema loaded.</div>;
  return (
    <div className="dynamic-page-wrapper">
      {/* If schema is an array, render root nodes, else render single root */}
      {Array.isArray(schema)
        ? schema.map((node, i) => renderNode(node, i))
        : renderNode(schema, 0)}
    </div>
  );
};

// --- Wrapper Components for State Handling ---

const ChartWrapper = ({
  latestSocketMessage,
  data: initialData,
  updateMode = "append",
  maxPoints = 20,
  ...props
}) => {
  const [data, setData] = useState(initialData || []);
  useEffect(() => {
    if (initialData !== undefined && !latestSocketMessage) {
      setData(initialData);
    }
  }, [initialData, latestSocketMessage]);
  useEffect(() => {
    if (latestSocketMessage && latestSocketMessage.data !== undefined) {
      const incoming = latestSocketMessage.data;
      if (
        updateMode === "replace" ||
        (Array.isArray(incoming) && updateMode !== "append")
      ) {
        setData(Array.isArray(incoming) ? incoming : [incoming]);
      } else {
        if (Array.isArray(incoming)) {
          setData(incoming);
        } else {
          setData((prev) => {
            const updated = [...prev, incoming];
            if (updated.length > maxPoints) {
              return updated.slice(updated.length - maxPoints);
            }
            return updated;
          });
        }
      }
    }
  }, [latestSocketMessage, updateMode, maxPoints]);
  return <ComponentRegistry.Chart data={data} {...props} />;
};
const LogViewerWrapper = ({
  latestSocketMessage,
  lines: initialLines,
  ...props
}) => {
  const [lines, setLines] = useState(initialLines || []);
  useEffect(() => {
    if (latestSocketMessage && latestSocketMessage.data) {
      const newContent = latestSocketMessage.data;
      const newLines =
        typeof newContent === "string" ? newContent.split("\n") : [newContent];
      if (newLines.length > 0 && newLines[newLines.length - 1] === "") {
        newLines.pop();
      }
      setLines((prev) => [...prev, ...newLines].slice(-1000));
    }
  }, [latestSocketMessage]);
  return <ComponentRegistry.LogViewer lines={lines} {...props} />;
};
const StatCardWrapper = ({
  latestSocketMessage,
  value: initialValue,
  dataKey,
  ...props
}) => {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (latestSocketMessage && latestSocketMessage.data && dataKey) {
      const keys = dataKey.split(".");
      let current = latestSocketMessage.data;
      for (const key of keys) {
        if (current && current[key] !== undefined) {
          current = current[key];
        } else {
          current = undefined;
          break;
        }
      }
      if (current !== undefined) {
        setValue(current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestSocketMessage]);
  return <ComponentRegistry.StatCard value={value} {...props} />;
};
export default DynamicPage;
