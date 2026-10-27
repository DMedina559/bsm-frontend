import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import "../styles/action-menu.css";

/** Compact actions in the top layer of the app, outside scrolling tables. */
export default function ActionMenu({ label, items, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef(null);
  const panel = useRef(null);
  const id = useId();
  const close = (focus = false) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!open) return;
    const rect = trigger.current.getBoundingClientRect();
    const menu = panel.current.getBoundingClientRect();
    setPosition({
      left: Math.max(
        8,
        Math.min(rect.right - menu.width, window.innerWidth - menu.width - 8),
      ),
      top:
        rect.bottom + menu.height + 8 <= window.innerHeight
          ? rect.bottom + 4
          : Math.max(8, rect.top - menu.height - 4),
    });
    panel.current.querySelector("button:not(:disabled)")?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (
        !trigger.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    const dismiss = (event) => {
      if (!panel.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);
  const blur = (event) => {
    if (
      !panel.current?.contains(event.relatedTarget) &&
      !trigger.current?.contains(event.relatedTarget)
    )
      setOpen(false);
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="icon-button action-menu-trigger"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onBlur={blur}
      >
        <MoreVertical size={20} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="menu"
            aria-label={label}
            className="action-menu-panel"
            style={position}
            onBlur={blur}
            onKeyDown={(event) => {
              const buttons = [
                ...panel.current.querySelectorAll("button:not(:disabled)"),
              ];
              const index = buttons.indexOf(document.activeElement);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : event.key === "ArrowDown"
                      ? (index + 1) % buttons.length
                      : event.key === "ArrowUp"
                        ? (index - 1 + buttons.length) % buttons.length
                        : null;
              if (next !== null) {
                event.preventDefault();
                buttons[next]?.focus();
              }
              if (event.key === "Tab") close(true);
            }}
          >
            {items.map(
              ({ label: text, Icon, disabled: unavailable, onClick }) => (
                <button
                  key={text}
                  type="button"
                  role="menuitem"
                  disabled={unavailable || disabled}
                  onClick={() => {
                    close(true);
                    onClick();
                  }}
                >
                  {Icon && <Icon size={16} aria-hidden="true" />}
                  {text}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
