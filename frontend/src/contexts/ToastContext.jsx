import { getActiveInstance } from "../app/instanceProfiles";
import { sessionRuntime } from "../app/sessionRuntime";
import React, {
  createContext,
  useCallback,
  use,
  useEffect,
  useRef,
  useState,
} from "react";
import { X, Info, CircleCheck, TriangleAlert } from "lucide-react";
import { getConnectionIdentity } from "../app/connection";
import { useAuth } from "./AuthContext";
import {
  readHistory,
  writeHistoryEntry,
  clearStoredHistory,
  HISTORY_LIMIT,
} from "../utils/notificationHistory";
const SECURITY_MESSAGES = {
  trusted_device_remembered:
    "A device was remembered for second-factor verification.",
  trusted_devices_revoked: "Remembered-device access was removed.",
  login: "A new login was created for your account.",
  recovery_code_used: "A recovery code was used to verify your account.",
  mfa_enabled: "Two-factor authentication was enabled.",
  mfa_disabled: "Two-factor authentication was disabled.",
  recovery_codes_rotated: "Your recovery codes were replaced.",
  password_changed: "Your password was changed.",
  password_reset: "Your password was reset.",
  local_mfa_reset: "A local administrator reset your MFA.",
  integration_credential_created: "An integration credential was created.",
  integration_credential_rotated: "An integration credential was rotated.",
  integration_credential_revoked: "An integration credential was revoked.",
  all_integration_credentials_revoked:
    "All integration credentials were revoked.",
};
const VISIBLE_LIMIT = 8;
const ToastContext = createContext();
export const useToast = () => use(ToastContext);
export const ToastProvider = ({ children }) => {
  const { user } = useAuth() || {};
  const generation = sessionRuntime.capture().generation;
  const backend = getConnectionIdentity();
  const scope = user?.username
    ? `bsm.notifications.v4:${JSON.stringify([backend, user.username])}`
    : null;
  const [record, setRecord] = useState(() => ({
    scope,
    entries: readHistory(scope),
  }));
  const history = record.scope === scope ? record.entries : [];
  const previousScopeRef = useRef(scope);
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);
  const timersRef = useRef(new Map());
  const visibleRef = useRef([]);
  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current.get(id));
    timersRef.current.delete(id);
    visibleRef.current = visibleRef.current.filter((toast) => toast.id !== id);
    setToasts(visibleRef.current);
  }, []);
  const addToast = useCallback(
    (message, type = "info", eventId = null) => {
      if (sessionRuntime.capture().generation !== generation) return;
      const instance = getActiveInstance();
      if (instance) message = `${instance.name}: ${message}`;
      const id = ++counterRef.current;
      const entry = {
        id:
          eventId ||
          globalThis.crypto?.randomUUID?.() ||
          `${Date.now()}-${Math.random()}`,
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
      visibleRef.current.push({ id, message, type });
      while (visibleRef.current.length > VISIBLE_LIMIT) {
        const evicted = visibleRef.current.shift();
        clearTimeout(timersRef.current.get(evicted.id));
        timersRef.current.delete(evicted.id);
      }
      setToasts([...visibleRef.current]);
      timersRef.current.set(
        id,
        setTimeout(() => removeToast(id), type === "error" ? 10000 : 6000),
      );
    },
    [removeToast, scope, generation],
  );
  useEffect(() => {
    const notice = (event) => {
      const detail = event.detail;
      if (
        !scope ||
        detail?.backend !== backend ||
        detail.generation !== sessionRuntime.capture().generation ||
        !SECURITY_MESSAGES[detail.action]
      )
        return;
      addToast(
        SECURITY_MESSAGES[detail.action],
        "info",
        /^[a-f0-9]{32}$/.test(detail.eventId)
          ? `security:${detail.eventId}`
          : null,
      );
    };
    window.addEventListener("bsm:security-notice", notice);
    return () => window.removeEventListener("bsm:security-notice", notice);
  }, [scope, backend, addToast]);
  useEffect(() => {
    const current = timersRef.current;
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
    if (previousScopeRef.current !== scope) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
      visibleRef.current = [];
      setToasts([]);
      previousScopeRef.current = scope;
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
    clearTimeout(timersRef.current.get(id));
    timersRef.current.delete(id);
  };
  const resume = (id) => {
    if (!visibleRef.current.some((toast) => toast.id === id)) return;
    if (!timersRef.current.has(id))
      timersRef.current.set(
        id,
        setTimeout(() => removeToast(id), 6000),
      );
  };
  return (
    <ToastContext
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
    </ToastContext>
  );
};
