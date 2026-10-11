import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "../utils/useFocusTrap";
export default function Modal({
  isOpen = true,
  onClose,
  title,
  children,
  className = "",
  closeDisabled = false,
}) {
  const ref = useRef(null);
  const id = useId();
  useFocusTrap(ref, isOpen, () => {
    if (!closeDisabled) onClose?.();
  });
  if (!isOpen) return null;
  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose?.();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={`dialog-panel ${className}`}
      >
        <header className="dialog-header">
          <h2 id={id}>{title}</h2>
          {onClose && (
            <button
              type="button"
              className="icon-button"
              disabled={closeDisabled}
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          )}
        </header>
        <div className="dialog-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
