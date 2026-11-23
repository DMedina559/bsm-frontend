import Timestamp from "./Timestamp";
export default function DraftConflictNotice({ draft }) {
  return (
    <>
      {draft.persistenceStatus && draft.persistenceStatus !== "cleared" && (
        <p role="status" className="form-help-text">
          {
            {
              pending: "Saving safe edits in this browser…",
              saved: "Safe edits saved in this browser.",
              excluded:
                "These edits contain no fields supported by browser recovery.",
              unavailable:
                "Browser recovery could not save these edits. Keep this page open until you save them to the server.",
            }[draft.persistenceStatus]
          }
        </p>
      )}
      {draft.recoverable && (
        <div role="status" className="message warning">
          <p>
            Unsaved edits from {<Timestamp value={draft.recoverable.savedAt} />}{" "}
            are available. Sensitive and unrecognized fields were excluded.
          </p>
          <button
            type="button"
            className="action-button secondary"
            disabled={!draft.canRestore}
            onClick={draft.restoreRecovery}
          >
            Restore edits
          </button>{" "}
          <button
            type="button"
            className="action-button secondary"
            onClick={draft.discardRecovery}
          >
            Discard saved edits
          </button>
        </div>
      )}
      {draft.conflicted && (
        <p role="status" className="message warning">
          The saved settings changed while you were editing. Your edits are
          preserved. Saving is blocked until you reload the latest settings and
          reapply your changes.
        </p>
      )}
    </>
  );
}
