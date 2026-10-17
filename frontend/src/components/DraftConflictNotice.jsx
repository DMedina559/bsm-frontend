export default function DraftConflictNotice({ draft }) {
  return (
    <>
      {draft.recoverable && (
        <div role="status" className="message warning">
          <p>
            Unsaved edits from{" "}
            {new Date(draft.recoverable.savedAt).toLocaleString()} are
            available. Sensitive and unrecognized fields were excluded.
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
          preserved. Reload the latest settings before saving to avoid
          overwriting those changes.
        </p>
      )}
    </>
  );
}
