import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useWebSocket } from "../../contexts/WebSocketContext";
import { ComponentRegistry } from "./componentRegistry";

// Append streams consume every frame, independently of React's render batching.
function usePluginStream(topic, receive) {
  const { addMessageListener } = useWebSocket();
  const receiver = useRef(receive);
  useLayoutEffect(() => {
    receiver.current = receive;
  });
  useEffect(() => {
    if (!topic) return;
    return addMessageListener((message) => {
      if (message.topic === topic) receiver.current(message);
    });
  }, [topic, addMessageListener]);
}
const EMPTY = [];
export const ChartWrapper = ({
  socketTopic,
  data: initialData = EMPTY,
  updateMode = "append",
  maxPoints = 20,
  ...props
}) => {
  const limit =
    Number.isSafeInteger(maxPoints) && maxPoints > 0 ? maxPoints : 20;
  const [data, setData] = useState(() => initialData.slice(-limit));
  useEffect(() => {
    setData(initialData.slice(-limit));
  }, [initialData, limit]);
  usePluginStream(socketTopic, (message) => {
    if (message.data === undefined) return;
    const incoming = message.data;
    setData((previous) => {
      const next = Array.isArray(incoming)
        ? incoming
        : updateMode === "replace"
          ? [incoming]
          : [...previous, incoming];
      return next.slice(-limit);
    });
  });
  return <ComponentRegistry.Chart data={data} {...props} />;
};
export const LogViewerWrapper = ({
  socketTopic,
  lines: initialLines = EMPTY,
  ...props
}) => {
  const [lines, setLines] = useState(() => initialLines.slice(-1000));
  useEffect(() => {
    setLines(initialLines.slice(-1000));
  }, [initialLines]);
  usePluginStream(socketTopic, (message) => {
    if (message.data === undefined) return;
    const incoming =
      typeof message.data === "string"
        ? message.data.split("\n")
        : [message.data];
    if (incoming.at(-1) === "") incoming.pop();
    setLines((previous) => [...previous, ...incoming].slice(-1000));
  });
  return <ComponentRegistry.LogViewer lines={lines} {...props} />;
};
export const StatCardWrapper = ({
  socketTopic,
  value: initialValue,
  dataKey,
  ...props
}) => {
  const [value, setValue] = useState(initialValue);
  useEffect(() => setValue(initialValue), [initialValue, dataKey]);
  usePluginStream(socketTopic, (message) => {
    if (!dataKey) return;
    let next = message.data;
    for (const key of dataKey.split(".")) next = next?.[key];
    if (next !== undefined) setValue(next);
  });
  return <ComponentRegistry.StatCard value={value} {...props} />;
};
