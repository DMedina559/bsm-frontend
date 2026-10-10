import { useEffect, useId, useRef, useState } from "react";
import { MoreVertical, Wrench, Settings, Shield, Database } from "lucide-react";

const shortcuts = [
  { label: "Settings", path: "/server-config", Icon: Wrench },
  { label: "Properties", path: "/server-properties", Icon: Settings },
  { label: "Access Control", path: "/access-control", Icon: Shield },
  { label: "Backups", path: "/backups", Icon: Database },
];

export default function ServerCardMenu({ serverName, onNavigate }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const container = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      className="server-card-menu"
      ref={container}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="icon-button server-card-menu-trigger"
        aria-label={`More options for ${serverName}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((previous) => !previous)}
      >
        <MoreVertical size={20} aria-hidden="true" />
      </button>
      {open && (
        <nav
          id={panelId}
          className="server-card-menu-panel"
          aria-label={`${serverName} shortcuts`}
        >
          {shortcuts.map(({ label, path, Icon }) => (
            <button
              key={path}
              type="button"
              onClick={() => {
                setOpen(false);
                onNavigate(serverName, path);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
