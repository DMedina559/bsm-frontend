import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { X, Info, CircleCheck, TriangleAlert } from "lucide-react";
const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);
export const ToastProvider = ({ children }) => {
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
      setToasts((previous) => [...previous, { id, message, type }]);
      timers.current.set(
        id,
        setTimeout(() => removeToast(id), type === "error" ? 10000 : 6000),
      );
    },
    [removeToast],
  );
  useEffect(() => {
    const current = timers.current;
    return () => {
      current.forEach(clearTimeout);
      current.clear();
    };
  }, []);
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
    <ToastContext.Provider value={{ addToast }}>
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
