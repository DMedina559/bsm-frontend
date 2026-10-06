import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { X, Info, CircleCheck, TriangleAlert } from "lucide-react";
import { getApiProxyBasePath } from "./utils/basePath";
import { useAuth } from "./AuthContext";
import { readHistory, HISTORY_LIMIT } from "./utils/notificationHistory";
const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);
export const ToastProvider = ({ children }) => {
  const { user } = useAuth() || {};
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
  const removeToast = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);
  const addToast = useCallback(
    (message, type = "info") => {
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
      setRecord((previous) => ({
        scope,
        entries: [
          entry,
          ...(previous.scope === scope ? previous.entries : readHistory(scope)),
        ].slice(0, HISTORY_LIMIT),
      }));
      setToasts((previous) => [...previous, { id, message, type }]);
      timers.current.set(
        id,
        setTimeout(() => removeToast(id), type === "error" ? 10000 : 6000),
      );
    },
    [removeToast, scope],
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
      setToasts([]);
      previousScope.current = scope;
    }
  }, [scope]);
  useEffect(() => {
    if (scope && record.scope === scope) {
      try {
        localStorage.setItem(scope, JSON.stringify(record.entries));
      } catch {
        /* History remains available in memory. */
      }
    }
  }, [record, scope]);
  const clearHistory = () => setRecord({ scope, entries: [] });
  const markHistoryRead = () =>
    setRecord((previous) => ({
      scope,
      entries: (previous.scope === scope
        ? previous.entries
        : readHistory(scope)
      ).map((entry) => ({ ...entry, read: true })),
    }));
  const pause = (id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  };
  const resume = (id) => {
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
