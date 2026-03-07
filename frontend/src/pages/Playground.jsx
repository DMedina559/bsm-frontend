import React, { useState } from "react";
import DynamicPage from "../components/DynamicPage";
import { useToast } from "../ToastContext";
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

        // Use Function to safely evaluate the object (handles single quotes and trailing commas)
        // Since this is a developer tool and the input is purely local to the dev's browser,
        // new Function is an acceptable way to parse lenient JSON/JS objects.

        const parsed = new Function("return (" + sanitized + ")")();
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
        gap: "20px",
        padding: "20px",
      }}
    >
      <div className="header">
        <h1>Developer Playground</h1>
      </div>

      <div className="card">
        <h3>JSON Input</h3>
        <textarea
          style={{
            width: "100%",
            height: "300px",
            fontFamily: "monospace",
            padding: "10px",
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
            marginTop: "10px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button className="action-button primary" onClick={handleRender}>
            <Play size={16} style={{ marginRight: "5px" }} />
            Render Page
          </button>
        </div>
      </div>

      {schemaJson && (
        <div
          style={{
            borderTop: "2px dashed var(--border-color, #444)",
            paddingTop: "20px",
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
