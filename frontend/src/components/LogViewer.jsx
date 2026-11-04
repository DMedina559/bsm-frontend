import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { callOperation } from "../api/operations";
import { useAuth } from "../contexts/AuthContext";
import { useWebSocket } from "../contexts/WebSocketContext";
import { logWindow, MAX_LOG_BYTES } from "../utils/logWindow";

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
  const containerRef = useRef(null);
  const currentRef = useRef(EMPTY);
  const busyRef = useRef(false);
  const followRef = useRef(true);
  const anchorRef = useRef(null);
  const loadOlderRef = useRef(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let initialized = false;
    const pending = [];
    let pendingBytes = 0;
    let resyncPending = false;
    currentRef.current = EMPTY;
    followRef.current = true;
    anchorRef.current = null;
    setPage(EMPTY);
    setLoading(false);
    setFollowing(true);
    setError("");
    const commit = (value, older = false) => {
      const window = logWindow(value, older);
      currentRef.current = window;
      setPage(window);
    };
    const append = (message) => {
      if (
        !active ||
        identity === null ||
        message.topic !== topic ||
        message.type !== "log_update"
      )
        return;
      const previous = currentRef.current;
      // An older window stays in place until the user asks to follow live.
      if (previous.tailOmitted) return;
      if (
        !initialized ||
        (busyRef.current &&
          message.file_id &&
          (message.file_id !== previous.file_id ||
            message.end < previous.end ||
            message.start > previous.end))
      ) {
        const size = new TextEncoder().encode(message.data || "").length;
        if (pendingBytes + size > MAX_LOG_BYTES) {
          pending.length = 0;
          pendingBytes = 0;
          resyncPending = true;
        } else {
          pending.push(message);
          pendingBytes += size;
        }
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
        const data = message.data || "";
        commit({
          ...previous,
          data: previous.data + data,
          end: previous.end + new TextEncoder().encode(data).length,
        });
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
      if (!active || busyRef.current || (older && !currentRef.current.has_more))
        return;
      busyRef.current = true;
      setLoading(true);
      setError("");
      const previous = currentRef.current;
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
          const element = containerRef.current;
          if (element)
            anchorRef.current = {
              top: element.scrollTop,
              height: element.scrollHeight,
            };
          commit(
            {
              ...currentRef.current,
              data: result.data + currentRef.current.data,
              start: result.start,
              has_more: result.has_more,
            },
            true,
          );
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
          busyRef.current = false;
          setLoading(false);
          if (initialized) {
            pendingBytes = 0;
            if (resyncPending) {
              resyncPending = false;
              pending.length = 0;
              void fetchPage();
            } else pending.splice(0).forEach(append);
          }
        }
      }
    };
    busyRef.current = false;
    loadOlderRef.current = fetchPage;
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
    const element = containerRef.current;
    if (!element) return;
    if (anchorRef.current) {
      element.scrollTop =
        anchorRef.current.top + element.scrollHeight - anchorRef.current.height;
      anchorRef.current = null;
    } else if (followRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [page]);

  const onScroll = () => {
    const element = containerRef.current;
    const atBottom =
      !currentRef.current.tailOmitted &&
      element.scrollHeight - element.scrollTop - element.clientHeight < 40;
    followRef.current = atBottom;
    setFollowing(atBottom);
    if (element.scrollTop < 40 && currentRef.current.has_more)
      void loadOlderRef.current?.(true);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "calc(8px * var(--bsm-spacing-scale))",
          marginBottom: "calc(8px * var(--bsm-spacing-scale))",
        }}
      >
        {page.has_more && (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              followRef.current = false;
              setFollowing(false);
              void loadOlderRef.current?.(true);
            }}
          >
            Load older entries
          </button>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            followRef.current = true;
            setFollowing(true);
            void loadOlderRef.current?.();
          }}
        >
          Reload log
        </button>
        {(!following || page.tailOmitted) && (
          <button
            type="button"
            onClick={() => {
              followRef.current = true;
              setFollowing(true);
              if (currentRef.current.tailOmitted) void loadOlderRef.current?.();
              else if (containerRef.current)
                containerRef.current.scrollTop =
                  containerRef.current.scrollHeight;
            }}
          >
            Follow live
          </button>
        )}
        {loading && <span role="status">Loading logs…</span>}
        {page.tailOmitted && (
          <span role="status">
            Viewing older entries. Follow live to return to current output.
          </span>
        )}
        {error && <span role="alert">{error}</span>}
      </div>
      <div
        ref={containerRef}
        role="region"
        aria-label={label}
        onScroll={onScroll}
        style={{
          background: "var(--bsm-console)",
          color: "var(--text-color)",
          padding: "calc(15px * var(--bsm-spacing-scale))",
          fontFamily: "var(--bsm-mono)",
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
