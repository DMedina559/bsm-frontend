import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Modal from "./components/Modal";
const DialogContext = createContext();
export const useDialog = () => useContext(DialogContext);
export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState("");
  const resolver = useRef(null);
  const settle = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  }, []);
  const open = useCallback(
    (type, message) =>
      new Promise((resolve) => {
        // Only one interactive confirmation may be active at a time.
        resolver.current?.(false);
        resolver.current = resolve;
        setValue("");
        setDialog({ type, message });
      }),
    [],
  );
  useEffect(
    () => () => {
      resolver.current?.(false);
    },
    [],
  );
  const confirmAction = useCallback(
    (message) => open("confirm", message),
    [open],
  );
  const promptAction = useCallback(
    (message) => open("prompt", message),
    [open],
  );
  return (
    <DialogContext.Provider value={{ confirmAction, promptAction }}>
      {children}
      {dialog && (
        <Modal
          title={
            dialog.type === "prompt" ? "Send console command" : "Confirm action"
          }
          onClose={() => settle(dialog.type === "prompt" ? null : false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              settle(dialog.type === "prompt" ? value.trim() : true);
            }}
          >
            <p className="dialog-message" id="action-message">
              {dialog.message}
            </p>
            {dialog.type === "prompt" && (
              <div className="form-group">
                <label className="form-label" htmlFor="action-value">
                  Command
                </label>
                <input
                  id="action-value"
                  className="form-input"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  required
                  data-autofocus
                  autoComplete="off"
                  aria-describedby="action-message"
                />
              </div>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="action-button secondary"
                data-autofocus={dialog.type === "confirm" ? true : undefined}
                onClick={() => settle(dialog.type === "prompt" ? null : false)}
              >
                Cancel
              </button>
              <button type="submit" className="action-button primary-button">
                {dialog.type === "prompt" ? "Send command" : "Continue"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </DialogContext.Provider>
  );
}
