import React, { useState } from "react";
import JSON5 from "json5";
import DynamicPage from "./DynamicPage";
import { useToast } from "../contexts/ToastContext";
import { Play, Code, Eye } from "lucide-react";
import "../styles/playground.css";
const DEFAULT_JSON = `{
  "type": "Container",
  "children": [
    {
      "type": "Card",
      "props": {
        "title": "Welcome to the Playground"
      },
      "children": [
        {
          "type": "Text",
          "props": {
            "content": "Type or paste your JSON schema here to see it rendered in the preview."
          }
        }
      ]
    }
  ]
}`;
const Playground = () => {
  const [jsonInput, setJsonInput] = useState(DEFAULT_JSON);
  const [schemaJson, setSchemaJson] = useState(null);
  const [activeTab, setActiveTab] = useState("raw");
  const [renderedSource, setRenderedSource] = useState(null);
  const { addToast } = useToast();
  const handleRender = () => {
    try {
      // First try standard JSON parsing
      const parsed = JSON.parse(jsonInput);
      setSchemaJson(parsed);
      setRenderedSource(jsonInput);
      setActiveTab("rendered");
      addToast("Schema rendered successfully", "success");
      return true;
    } catch {
      try {
        // If standard JSON fails, attempt to parse Python-like dictionaries
        // This replaces True/False/None with true/false/null
        let sanitized = jsonInput
          .replace(/\bTrue\b/g, "true")
          .replace(/\bFalse\b/g, "false")
          .replace(/\bNone\b/g, "null");

        // Use JSON5 to safely evaluate the object (handles single quotes and trailing commas)
        // This avoids Cross-Site Scripting (XSS) vulnerabilities associated with new Function

        const parsed = JSON5.parse(sanitized);
        setSchemaJson(parsed);
        setRenderedSource(jsonInput);
        setActiveTab("rendered");
        addToast("Schema (Python/JS format) rendered successfully", "success");
        return true;
      } catch (fallbackErr) {
        addToast("Invalid JSON or Object: " + fallbackErr.message, "error");
        return false;
      }
    }
  };
  const selectTab = (tab) => {
    if (tab === "rendered" && renderedSource !== jsonInput)
      return handleRender();
    setActiveTab(tab);
    return true;
  };
  const handleTabKeys = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "raw"
        : event.key === "End"
          ? "rendered"
          : activeTab === "raw"
            ? "rendered"
            : "raw";
    if (selectTab(next))
      event.currentTarget.parentElement
        .querySelector(`#playground-tab-${next}`)
        ?.focus();
  };
  return (
    <div className="playground-page">
      <div className="playground-header">
        <div>
          <span className="playground-eyebrow">Developer tools</span>
          <h1>Developer Playground</h1>
          <p>Edit a native plugin page and preview its components.</p>
        </div>
        <button
          className="action-button primary"
          onClick={handleRender}
          type="button"
        >
          <Play size={15} />
          Render Page
        </button>
      </div>
      <section className="playground-workspace">
        <div className="playground-toolbar">
          <div
            role="tablist"
            aria-label="Playground views"
            className="playground-tabs"
          >
            {[
              { id: "raw", label: "Raw", icon: Code },
              { id: "rendered", label: "Rendered", icon: Eye },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`playground-tab-${id}`}
                role="tab"
                type="button"
                aria-selected={activeTab === id}
                aria-controls={`playground-panel-${id}`}
                tabIndex={activeTab === id ? 0 : -1}
                onClick={() => selectTab(id)}
                onKeyDown={handleTabKeys}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          <span className="playground-document-status">
            {renderedSource === jsonInput
              ? "Preview up to date"
              : renderedSource === null
                ? "Ready to render"
                : "Preview has pending changes"}
          </span>
        </div>
        <div
          id="playground-panel-raw"
          role="tabpanel"
          aria-labelledby="playground-tab-raw"
          hidden={activeTab !== "raw"}
          className="playground-panel"
        >
          <label htmlFor="playground-json">
            Page schema<span>JSON / JSON5</span>
          </label>
          <textarea
            id="playground-json"
            aria-label="JSON schema"
            spellCheck={false}
            value={jsonInput}
            onChange={(event) => setJsonInput(event.target.value)}
            placeholder="Paste your JSON schema here…"
          />
          <p>
            Switch to Rendered to preview your latest changes. Invalid input
            stays here so you can correct it.
          </p>
        </div>
        <div
          id="playground-panel-rendered"
          role="tabpanel"
          aria-labelledby="playground-tab-rendered"
          hidden={activeTab !== "rendered"}
          className="playground-panel playground-preview"
        >
          {schemaJson !== null && activeTab === "rendered" && (
            <DynamicPage schemaJson={schemaJson} />
          )}
        </div>
      </section>
    </div>
  );
};
export default Playground;
