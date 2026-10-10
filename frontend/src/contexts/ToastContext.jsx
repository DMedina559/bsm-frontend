import { sessionRuntime } from "../app/sessionRuntime";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { X, Info, CircleCheck, TriangleAlert } from "lucide-react";
import { getApiProxyBasePath } from "../utils/basePath";
import { useAuth } from "./AuthContext";
import {
  readHistory,
  writeHistoryEntry,
  clearStoredHistory,
  HISTORY_LIMIT,
} from "../utils/notificationHistory";
const VISIBLE_LIMIT = 8;
const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);
export const ToastProvider = ({ children }) => {
  const { user } = useAuth() || {};
  const generation = sessionRuntime.capture().generation;
  let backend = "";
  try {
    backend =
      localStorage.getItem("api_base_url") ||
      window.location.origin + getApiProxyBasePath();
  } catch {
    /* Memory history still works. */
  }
  const scope = user?.username
    ? `bsm.notifications.v4:${JSON.stringify([backend, user.username])}`
    : null;
  const [record, setRecord] = useState(() => ({
    scope,
    entries: readHistory(scope),
  }));
  const history = record.scope === scope ? record.entries : [];
  const previousScope = useRef(scope);
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);
  const timers = useRef(new Map());
  const visible = useRef([]);
  const removeToast = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    visible.current = visible.current.filter((toast) => toast.id !== id);
    setToasts(visible.current);
  }, []);
  const addToast = useCallback(
    (message, type = "info") => {
      if (sessionRuntime.capture().generation !== generation) return;
      const id = ++counter.current;
      const entry = {
        id:
          globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        message: String(message),
        type: ["info", "success", "warning", "error"].includes(type)
          ? type
          : "info",
        timestamp: Date.now(),
        read: false,
      };
      writeHistoryEntry(scope, entry);
      setRecord((previous) => ({
        scope,
        entries: [
          entry,
          ...readHistory(scope),
          ...(previous.scope === scope ? previous.entries : []),
        ]
          .filter(
            (item, index, all) =>
              all.findIndex((other) => other.id === item.id) === index,
          )
          .slice(0, HISTORY_LIMIT),
      }));
      visible.current.push({ id, message, type });
      while (visible.current.length > VISIBLE_LIMIT) {
        const evicted = visible.current.shift();
        clearTimeout(timers.current.get(evicted.id));
        timers.current.delete(evicted.id);
      }
      setToasts([...visible.current]);
      timers.current.set(
        id,
        setTimeout(() => removeToast(id), type === "error" ? 10000 : 6000),
      );
    },
    [removeToast, scope, generation],
  );
  useEffect(() => {
    const current = timers.current;
    return () => {
      current.forEach(clearTimeout);
      current.clear();
    };
  }, []);
  useEffect(() => {
    setRecord((previous) =>
      previous.scope === scope
        ? previous
        : { scope, entries: readHistory(scope) },
    );
    if (previousScope.current !== scope) {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
      visible.current = [];
      setToasts([]);
      previousScope.current = scope;
    }
  }, [scope]);
  useEffect(() => {
    const synchronize = (event) => {
      if (
        event.key === null ||
        event.key === scope ||
        event.key?.startsWith(`${scope}:entry:`)
      )
        setRecord({ scope, entries: readHistory(scope) });
    };
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, [scope]);
  const clearHistory = () => {
    clearStoredHistory(scope);
    setRecord({ scope, entries: [] });
  };
  const markHistoryRead = () => {
    const entries = [...readHistory(scope), ...history]
      .filter(
        (entry, index, all) =>
          all.findIndex((item) => item.id === entry.id) === index,
      )
      .map((entry) => ({ ...entry, read: true }));
    entries.forEach((entry) => writeHistoryEntry(scope, entry));
    setRecord({ scope, entries: entries.slice(0, HISTORY_LIMIT) });
  };
  const pause = (id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  };
  const resume = (id) => {
    if (!visible.current.some((toast) => toast.id === id)) return;
    if (!timers.current.has(id))
      timers.current.set(
        id,
        setTimeout(() => removeToast(id), 6000),
      );
  };
  return (
    <ToastContext.Provider
      value={{
        addToast,
        history,
        clearHistory,
        markHistoryRead,
        unreadCount: history.filter((entry) => !entry.read).length,
      }}
    >
      {children}
      <div className="toast-container" role="region" aria-label="Notifications">
        {toasts.map((toast) => {
          const Icon =
            toast.type === "success"
              ? CircleCheck
              : ["error", "warning"].includes(toast.type)
                ? TriangleAlert
                : Info;
          return (
            <div
              key={toast.id}
              role={toast.type === "error" ? "alert" : "status"}
              className={`toast message-${toast.type}`}
              onMouseEnter={() => pause(toast.id)}
              onMouseLeave={() => resume(toast.id)}
              onFocus={() => pause(toast.id)}
              onBlur={() => resume(toast.id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{toast.message}</span>
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => removeToast(toast.id)}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
