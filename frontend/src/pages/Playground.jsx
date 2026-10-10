import React, { useState } from "react";
import JSON5 from "json5";
import DynamicPage from "./DynamicPage";
import { useToast } from "../contexts/ToastContext";
import { Play } from "lucide-react";
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
            "content": "Type or paste your JSON schema here to see it rendered below."
          }
        }
      ]
    }
  ]
}`;
const Playground = () => {
  const [jsonInput, setJsonInput] = useState(DEFAULT_JSON);
  const [schemaJson, setSchemaJson] = useState(null);
  const { addToast } = useToast();
  const handleRender = () => {
    try {
      // First try standard JSON parsing
      const parsed = JSON.parse(jsonInput);
      setSchemaJson(parsed);
      addToast("Schema rendered successfully", "success");
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
        addToast("Schema (Python/JS format) rendered successfully", "success");
      } catch (fallbackErr) {
        addToast("Invalid JSON or Object: " + fallbackErr.message, "error");
      }
    }
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(20px * var(--bsm-spacing-scale))",
        padding: "calc(20px * var(--bsm-spacing-scale))",
      }}
    >
      <div className="header">
        <h1>Developer Playground</h1>
      </div>

      <div className="card">
        <h3>JSON Input</h3>
        <textarea
          aria-label="JSON schema"
          className="form-input"
          style={{
            width: "100%",
            height: "300px",
            fontFamily: "monospace",
            padding: "calc(10px * var(--bsm-spacing-scale))",
            background: "var(--input-bg, #222)",
            color: "var(--text-color, #eee)",
            border: "1px solid var(--border-color, #444)",
            borderRadius: "4px",
            resize: "vertical",
          }}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="Paste your JSON schema here..."
        />
        <div
          style={{
            marginTop: "calc(10px * var(--bsm-spacing-scale))",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            className="action-button primary"
            onClick={handleRender}
            type="button"
          >
            <Play
              size={16}
              style={{
                marginRight: "calc(5px * var(--bsm-spacing-scale))",
              }}
            />
            Render Page
          </button>
        </div>
      </div>

      {schemaJson && (
        <div
          style={{
            borderTop: "2px dashed var(--border-color, #444)",
            paddingTop: "calc(20px * var(--bsm-spacing-scale))",
          }}
        >
          <h3>Preview</h3>
          <div
            style={{
              background: "var(--bg-color, #1a1a1a)",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <DynamicPage schemaJson={schemaJson} />
          </div>
        </div>
      )}
    </div>
  );
};
export default Playground;
