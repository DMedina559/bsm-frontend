import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { callOperation } from "../api/operations";
import { useAuth } from "../AuthContext";
import { useWebSocket } from "../WebSocketContext";

const EMPTY = { data: "", start: 0, end: 0, file_id: null, has_more: false };

export default function LogViewer({
  topic,
  label = "Log output",
  emptyMessage = "Waiting for logs...",
  style,
  refreshKey = 0,
}) {
  const { user, sessionGeneration } = useAuth();
  const identity = user?.id ?? user?.username ?? null;
  const { isConnected, subscribe, unsubscribe, addMessageListener } =
    useWebSocket();
  const [page, setPage] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(true);
  const container = useRef(null);
  const current = useRef(EMPTY);
  const busy = useRef(false);
  const follow = useRef(true);
  const anchor = useRef(null);
  const loadOlder = useRef(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let initialized = false;
    const pending = [];
    current.current = EMPTY;
    follow.current = true;
    anchor.current = null;
    setPage(EMPTY);
    setLoading(false);
    setFollowing(true);
    setError("");
    const commit = (value) => {
      current.current = value;
      setPage(value);
    };
    const append = (message) => {
      if (
        !active ||
        identity === null ||
        message.topic !== topic ||
        message.type !== "log_update"
      )
        return;
      const previous = current.current;
      if (
        !initialized ||
        (busy.current &&
          message.file_id &&
          (message.file_id !== previous.file_id ||
            message.end < previous.end ||
            message.start > previous.end))
      ) {
        pending.push(message);
        return;
      }
      if (
        message.file_id &&
        (message.file_id !== previous.file_id || message.end < previous.end)
      ) {
        void fetchPage();
        return;
      }
      // Older backends still supply live text but have no history metadata.
      if (message.start === undefined) {
        commit({ ...previous, data: previous.data + (message.data || "") });
        return;
      }
      if (message.end <= previous.end) return;
      if (message.start > previous.end) {
        void fetchPage();
        return;
      }
      const bytes = new TextEncoder().encode(message.data);
      const suffix = new TextDecoder().decode(
        bytes.slice(Math.max(0, previous.end - message.start)),
      );
      commit({ ...previous, data: previous.data + suffix, end: message.end });
    };
    const fetchPage = async (older = false) => {
      if (!active || busy.current || (older && !current.current.has_more))
        return;
      busy.current = true;
      setLoading(true);
      setError("");
      const previous = current.current;
      try {
        const result = await callOperation("get_log_history", {
          query: {
            topic,
            ...(older
              ? { before: previous.start, file_id: previous.file_id }
              : {}),
          },
          signal: controller.signal,
        });
        if (!active) return;
        if (
          typeof result?.data !== "string" ||
          typeof result.start !== "number"
        )
          throw new Error("Invalid log history response");
        if (older) {
          const element = container.current;
          if (element)
            anchor.current = {
              top: element.scrollTop,
              height: element.scrollHeight,
            };
          commit({
            ...current.current,
            data: result.data + current.current.data,
            start: result.start,
            has_more: result.has_more,
          });
        } else {
          commit(result);
          initialized = true;
        }
      } catch (failure) {
        if (!active) return;
        if (failure.status === 409) {
          initialized = false;
          setError("The log file changed. Reload to view the current file.");
        } else if (failure.status !== 404) {
          setError("Could not load log history. Try again.");
        }
        initialized = true;
      } finally {
        if (active) {
          busy.current = false;
          setLoading(false);
          if (initialized) pending.splice(0).forEach(append);
        }
      }
    };
    busy.current = false;
    loadOlder.current = fetchPage;
    const removeListener = addMessageListener(append);
    if (isConnected && identity !== null) subscribe(topic);
    if (identity !== null) void fetchPage();
    return () => {
      active = false;
      controller.abort();
      removeListener();
      if (isConnected && identity !== null) unsubscribe(topic);
    };
  }, [
    identity,
    sessionGeneration,
    topic,
    refreshKey,
    isConnected,
    subscribe,
    unsubscribe,
    addMessageListener,
  ]);

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    if (anchor.current) {
      element.scrollTop =
        anchor.current.top + element.scrollHeight - anchor.current.height;
      anchor.current = null;
    } else if (follow.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [page]);

  const onScroll = () => {
    const element = container.current;
    const atBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 40;
    follow.current = atBottom;
    setFollowing(atBottom);
    if (element.scrollTop < 40 && current.current.has_more)
      void loadOlder.current?.(true);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        {page.has_more && (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              follow.current = false;
              setFollowing(false);
              void loadOlder.current?.(true);
            }}
          >
            Load older entries
          </button>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            follow.current = true;
            setFollowing(true);
            void loadOlder.current?.();
          }}
        >
          Reload log
        </button>
        {!following && (
          <button
            type="button"
            onClick={() => {
              follow.current = true;
              setFollowing(true);
              if (container.current)
                container.current.scrollTop = container.current.scrollHeight;
            }}
          >
            Follow live
          </button>
        )}
        {loading && <span role="status">Loading logs...</span>}
        {error && <span role="alert">{error}</span>}
      </div>
      <div
        ref={container}
        role="region"
        aria-label={label}
        onScroll={onScroll}
        style={{
          background: "var(--bsm-console)",
          color: "var(--text-color)",
          padding: "15px",
          fontFamily: "monospace",
          overflowY: "auto",
          height: "400px",
          ...style,
        }}
      >
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            font: "inherit",
          }}
        >
          {page.data || emptyMessage}
        </pre>
      </div>
    </div>
  );
}
