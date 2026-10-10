import { useState, useEffect } from "react";
import { ComponentRegistry } from "./componentRegistry";
export const ChartWrapper = ({
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
export const LogViewerWrapper = ({
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
export const StatCardWrapper = ({
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
