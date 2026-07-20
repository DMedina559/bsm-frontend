import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useServer } from "../ServerContext";
import { useToast } from "../ToastContext";
import { get, post } from "../api";
import {
  Save,
  RefreshCw,
  ArrowRight,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import propertiesLang from "react-syntax-highlighter/dist/esm/languages/hljs/properties";
import atomOneDark from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";

SyntaxHighlighter.registerLanguage("properties", propertiesLang);

// Categorize common properties for better organization
const PROPERTY_GROUPS = {
  Basic: [
    "server-name",
    "gamemode",
    "difficulty",
    "allow-cheats",
    "max-players",
    "online-mode",
    "allow-list",
    "level-name",
  ],
  World: [
    "level-seed",
    "default-player-permission-level",
    "texturepack-required",
    "view-distance",
    "tick-distance",
    "client-side-chunk-generation-enabled",
    "server-build-radius-ratio",
    "disable-player-interaction",
  ],
  Network: [
    "server-port",
    "server-portv6",
    "transport",
    "enable-lan-visibility",
    "compression-threshold",
    "compression-algorithm",
    "block-network-ids-are-hashes",
  ],
  "Anti-Cheat & Authority": [
    "server-authoritative-movement-strict",
    "server-authoritative-dismount-strict",
    "server-authoritative-entity-interactions-strict",
    "player-position-acceptance-threshold",
    "player-movement-action-direction-threshold",
    "server-authoritative-block-breaking-pick-range-scalar",
  ],
  Advanced: [
    "content-log-file-enabled",
    "content-log-console-output-enabled",
    "content-log-level",
    "max-threads",
    "player-idle-timeout",
    "force-gamemode",
    "chat-restriction",
    "disable-persona",
    "disable-custom-skins",
    "allow-outbound-script-debugging",
    "allow-inbound-script-debugging",
    "script-debugger-auto-attach",
    "enable-profiler",
  ],
};

const ServerProperties = () => {
  const { selectedServer } = useServer();
  const [properties, setProperties] = useState([]);
  const [rawContent, setRawContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showRawModal, setShowRawModal] = useState(false);
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const setupFlow = location.state?.setupFlow;

  // Custom Property State
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropValue, setNewPropValue] = useState("");

  // Collapsible state for sections
  const [collapsedSections, setCollapsedSections] = useState({});

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get(`/api/server/${selectedServer}/properties/get`);
      if (data && data.status === "success" && data.properties) {
        // Convert object to array for mapping
        const propsArray = Object.entries(data.properties).map(
          ([key, value]) => ({
            key,
            value: String(value), // Ensure string for inputs
          }),
        );
        propsArray.sort((a, b) => a.key.localeCompare(b.key));
        setProperties(propsArray);
        if (data.raw_content !== undefined) {
          setRawContent(data.raw_content);
        }
        return true;
      } else {
        addToast("Failed to load server properties", "error");
        setProperties([]);
        return false;
      }
    } catch (error) {
      addToast(error.message || "Error fetching properties", "error");
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedServer, addToast]);

  useEffect(() => {
    if (selectedServer) {
      // Initial fetch
      fetchProperties();
    }
  }, [selectedServer, fetchProperties]);

  const handleRefresh = async () => {
    const success = await fetchProperties();
    if (success) {
      addToast("Properties refreshed", "success");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedServer) return;

    setLoading(true);
    const propsObj = properties.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    try {
      await post(`/api/server/${selectedServer}/properties/set`, {
        properties: propsObj,
      });
      addToast("Server properties saved successfully.", "success");

      if (setupFlow) {
        navigate("/access-control", {
          state: { setupFlow: true, tab: "allowlist" },
        });
      }
    } catch (error) {
      addToast(error.message || "Failed to save properties.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, newValue) => {
    setProperties((prev) =>
      prev.map((p) => (p.key === key ? { ...p, value: newValue } : p)),
    );
  };

  const toggleSection = (section) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleAddCustomProperty = (e) => {
    e.preventDefault();
    if (!newPropKey.trim()) {
      addToast("Property key cannot be empty.", "error");
      return;
    }

    const exists = properties.some((p) => p.key === newPropKey.trim());
    if (exists) {
      addToast(`Property '${newPropKey}' already exists.`, "warning");
      return;
    }

    setProperties((prev) => [
      ...prev,
      { key: newPropKey.trim(), value: newPropValue },
    ]);
    setNewPropKey("");
    setNewPropValue("");
    addToast(`Added property '${newPropKey}'. Click Save to apply.`, "info");
  };

  // Group properties based on PROPERTY_GROUPS and filter by searchTerm
  const groupedProperties = useMemo(() => {
    // Initialize groups defensively
    const groups = { Other: [] };
    Object.keys(PROPERTY_GROUPS).forEach((key) => {
      groups[key] = [];
    });

    const lowerSearch = searchTerm.toLowerCase();

    properties.forEach((prop) => {
      if (!prop.key.toLowerCase().includes(lowerSearch)) return;

      let placed = false;
      for (const [groupName, keys] of Object.entries(PROPERTY_GROUPS)) {
        if (keys.includes(prop.key)) {
          if (!groups[groupName]) groups[groupName] = []; // Defensive init
          groups[groupName].push(prop);
          placed = true;
          break;
        }
      }
      if (!placed) {
        groups.Other.push(prop);
      }
    });

    return groups;
  }, [properties, searchTerm]);

  const renderInput = (prop) => {
    const key = prop.key;
    const value = prop.value;

    // Determine field type based on key or value
    const isBoolean =
      [
        "allow-cheats",
        "online-mode",
        "allow-list",
        "texturepack-required",
        "content-log-file-enabled",
        "content-log-console-output-enabled",
        "force-gamemode",
        "enable-lan-visibility",
        "server-authoritative-movement-strict",
        "server-authoritative-dismount-strict",
        "server-authoritative-entity-interactions-strict",
        "disable-player-interaction",
        "client-side-chunk-generation-enabled",
        "block-network-ids-are-hashes",
        "disable-persona",
        "disable-custom-skins",
        "allow-outbound-script-debugging",
        "allow-inbound-script-debugging",
        "enable-profiler",
      ].includes(key) ||
      value === "true" ||
      value === "false";

    if (isBoolean) {
      const isChecked = value === "true";
      return (
        <div className="switch-wrapper" style={{ marginTop: "5px" }}>
          <label className="switch" htmlFor={key}>
            <input
              type="checkbox"
              id={key}
              checked={isChecked}
              onChange={(e) =>
                handleChange(key, e.target.checked ? "true" : "false")
              }
            />
            <span className="slider round"></span>
          </label>
          <label className="switch-label-text" htmlFor={key}>
            {value}
          </label>
        </div>
      );
    }

    if (key === "transport") {
      return (
        <select
          id={key}
          className="form-input"
          value={value}
          onChange={(e) => handleChange(key, e.target.value)}
        >
          <option value="raknet">raknet</option>
          <option value="nethernet">nethernet</option>
        </select>
      );
    }

    if (key === "content-log-level") {
      return (
        <select
          id={key}
          className="form-input"
          value={value}
          onChange={(e) => handleChange(key, e.target.value)}
        >
          <option value="error">error</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
          <option value="verbose">verbose</option>
        </select>
      );
    }

    if (key === "compression-algorithm") {
      return (
        <select
          id={key}
          className="form-input"
          value={value}
          onChange={(e) => handleChange(key, e.target.value)}
        >
          <option value="zlib">zlib</option>
          <option value="snappy">snappy</option>
        </select>
      );
    }

    if (key === "chat-restriction") {
      return (
        <select
          id={key}
          className="form-input"
          value={value}
          onChange={(e) => handleChange(key, e.target.value)}
        >
          <option value="None">None</option>
          <option value="Dropped">Dropped</option>
          <option value="Disabled">Disabled</option>
        </select>
      );
    }

    if (key === "script-debugger-auto-attach") {
      return (
        <select
          id={key}
          className="form-input"
          value={value}
          onChange={(e) => handleChange(key, e.target.value)}
        >
          <option value="disabled">disabled</option>
          <option value="connect">connect</option>
          <option value="listen">listen</option>
        </select>
      );
    }

    // specific enums
    if (key === "gamemode") {
      return (
        <select
          id={key}
          className="form-input"
          value={value}
          onChange={(e) => handleChange(key, e.target.value)}
        >
          <option value="survival">survival</option>
          <option value="creative">creative</option>
          <option value="adventure">adventure</option>
        </select>
      );
    }

    if (key === "difficulty") {
      return (
        <select
          id={key}
          className="form-input"
          value={value}
          onChange={(e) => handleChange(key, e.target.value)}
        >
          <option value="peaceful">peaceful</option>
          <option value="easy">easy</option>
          <option value="normal">normal</option>
          <option value="hard">hard</option>
        </select>
      );
    }

    if (key === "default-player-permission-level") {
      return (
        <select
          id={key}
          className="form-input"
          value={value}
          onChange={(e) => handleChange(key, e.target.value)}
        >
          <option value="visitor">visitor</option>
          <option value="member">member</option>
          <option value="operator">operator</option>
        </select>
      );
    }

    // Default text input
    return (
      <input
        type="text"
        id={key}
        className="form-input"
        value={value}
        onChange={(e) => handleChange(key, e.target.value)}
      />
    );
  };

  if (!selectedServer) {
    return (
      <div className="container">
        <div
          className="message-box message-warning"
          style={{
            textAlign: "center",
            marginTop: "50px",
            padding: "20px",
            border: "1px solid orange",
            color: "orange",
          }}
        >
          Please select a server to configure properties.
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div
        className="header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1>Server Properties: {selectedServer}</h1>
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {!setupFlow && (
            <button
              className="action-button secondary"
              onClick={handleRefresh}
              disabled={loading}
              title="Reload properties"
            >
              <RefreshCw
                size={16}
                style={{ marginRight: "5px" }}
                className={loading ? "spin" : ""}
              />{" "}
              Refresh
            </button>
          )}
          <button
            className="action-button secondary"
            onClick={() => setShowRawModal(true)}
            title="View Properties File"
          >
            <FileText size={16} style={{ marginRight: "5px" }} /> View File
          </button>
          <button
            className="action-button"
            onClick={handleSave}
            disabled={loading}
          >
            {setupFlow ? (
              <>
                Save & Continue{" "}
                <ArrowRight size={16} style={{ marginLeft: "5px" }} />
              </>
            ) : (
              <>
                <Save size={16} style={{ marginRight: "5px" }} /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {setupFlow && (
        <div
          className="message-box message-info"
          style={{ marginBottom: "20px" }}
        >
          <strong>Setup Wizard (Step 1/5):</strong> Configure your server
          properties below.
        </div>
      )}

      {/* Search Bar */}
      <div style={{ marginBottom: "20px", position: "relative" }}>
        <Search
          size={18}
          style={{
            position: "absolute",
            left: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#888",
          }}
        />
        <input
          type="text"
          placeholder="Filter properties..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-input"
          style={{ paddingLeft: "35px", width: "100%", maxWidth: "400px" }}
        />
      </div>

      {loading && properties.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <div className="spinner"></div> Loading properties...
        </div>
      ) : (
        <form onSubmit={handleSave} className="form-group">
          {Object.entries(groupedProperties).map(([groupName, groupProps]) => {
            if (groupProps.length === 0) return null;
            const isCollapsed = collapsedSections[groupName];

            return (
              <div
                key={groupName}
                style={{
                  marginBottom: "20px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "5px",
                  background: "var(--container-background-color)",
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => toggleSection(groupName)}
                  style={{
                    padding: "10px 15px",
                    background: "rgba(0,0,0,0.2)",
                    borderBottom: isCollapsed
                      ? "none"
                      : "1px solid var(--border-color)",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontWeight: "bold",
                  }}
                >
                  <span>
                    {groupName} Properties ({groupProps.length})
                  </span>
                  {isCollapsed ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronUp size={18} />
                  )}
                </div>

                {!isCollapsed && (
                  <div
                    style={{
                      padding: "20px",
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: "20px",
                    }}
                  >
                    {groupProps.map((prop) => (
                      <div
                        key={prop.key}
                        style={{ display: "flex", flexDirection: "column" }}
                      >
                        <label
                          htmlFor={prop.key}
                          className="form-label"
                          style={{
                            marginBottom: "5px",
                            fontSize: "0.9em",
                            color: "#ccc",
                          }}
                          title={prop.key}
                        >
                          {prop.key.replace(/-/g, " ")}
                        </label>
                        {renderInput(prop)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Custom Property Section */}
          <div
            style={{
              marginBottom: "20px",
              border: "1px solid var(--border-color)",
              borderRadius: "5px",
              background: "var(--container-background-color)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 15px",
                background: "rgba(0,0,0,0.2)",
                borderBottom: "1px solid var(--border-color)",
                fontWeight: "bold",
              }}
            >
              Add Custom Property
            </div>
            <div
              style={{
                padding: "20px",
                display: "flex",
                gap: "10px",
                alignItems: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label
                  className="form-label"
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "0.9em",
                  }}
                >
                  Property Key
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. max-threads"
                  value={newPropKey}
                  onChange={(e) => setNewPropKey(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label
                  className="form-label"
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "0.9em",
                  }}
                >
                  Value
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Value"
                  value={newPropValue}
                  onChange={(e) => setNewPropValue(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <button
                className="action-button secondary"
                onClick={handleAddCustomProperty}
                style={{ marginBottom: "1px" }}
              >
                Add Property
              </button>
            </div>
          </div>

          {/* Bottom Save Button for convenience */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "20px",
              gap: "10px",
            }}
          >
            <button
              type="button"
              className="action-button secondary"
              onClick={() => setShowRawModal(true)}
              title="View Properties File"
            >
              <FileText size={16} style={{ marginRight: "5px" }} /> View File
            </button>
            <button type="submit" className="action-button" disabled={loading}>
              {setupFlow ? (
                <>
                  Save & Continue{" "}
                  <ArrowRight size={16} style={{ marginLeft: "5px" }} />
                </>
              ) : (
                <>
                  <Save size={16} style={{ marginRight: "5px" }} /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Raw Content Modal */}
      {showRawModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowRawModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--container-background-color, #333)",
              border: "1px solid var(--border-color, #555)",
              borderRadius: "8px",
              width: "90%",
              maxWidth: "800px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                padding: "15px 20px",
                borderBottom: "1px solid var(--border-color, #555)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, display: "flex", alignItems: "center" }}>
                <FileText size={20} style={{ marginRight: "10px" }} />
                Raw server.properties
              </h3>
              <button
                onClick={() => setShowRawModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-color, #fff)",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                }}
              >
                &times;
              </button>
            </div>
            <div
              style={{
                padding: "20px",
                overflowY: "auto",
                flex: 1,
                textAlign: "left",
              }}
            >
              {rawContent ? (
                <SyntaxHighlighter
                  language="properties"
                  style={atomOneDark}
                  customStyle={{
                    background: "rgba(0, 0, 0, 0.3)",
                    padding: "15px",
                    borderRadius: "5px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    margin: 0,
                    fontSize: "0.95em",
                    lineHeight: "1.5",
                  }}
                  wrapLines={true}
                  wrapLongLines={true}
                >
                  {rawContent}
                </SyntaxHighlighter>
              ) : (
                <div style={{ textAlign: "center", color: "#888" }}>
                  No raw content available.
                </div>
              )}
            </div>
            <div
              style={{
                padding: "15px 20px",
                borderTop: "1px solid var(--border-color, #555)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="action-button secondary"
                onClick={() => setShowRawModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerProperties;
