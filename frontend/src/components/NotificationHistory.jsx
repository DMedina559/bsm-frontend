import React, { useState } from "react";
import { Bell } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import Modal from "./Modal";
export default function NotificationHistory() {
  const {
    history = [],
    unreadCount = 0,
    clearHistory,
    markHistoryRead,
  } = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="icon-button notification-history-toggle"
        aria-label={`Notification history${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          markHistoryRead?.();
        }}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unreadCount}
          </span>
        )}
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Notification history"
      >
        <div className="notification-history-toolbar">
          <p className="form-help-text">
            Recent messages from this browser. Up to 100 messages are kept for
            seven days, separately for each account and backend.
          </p>
          <button
            type="button"
            className="action-button secondary"
            disabled={!history.length}
            onClick={() => clearHistory?.()}
          >
            Clear history
          </button>
        </div>
        {!history.length ? (
          <p>No notifications yet.</p>
        ) : (
          <ol className="notification-history-list">
            {history.map((entry) => (
              <li
                key={entry.id}
                className={`notification-history-entry message-${entry.type}`}
              >
                <div>
                  <strong>
                    {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                  </strong>
                  <time dateTime={new Date(entry.timestamp).toISOString()}>
                    {new Date(entry.timestamp).toLocaleString()}
                  </time>
                </div>
                <p>{entry.message}</p>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </>
  );
}
