export default function DraftConflictNotice({ draft }) {
  if (!draft.conflicted) return null;
  return (
    <p role="status" className="message warning">
      The saved settings changed while you were editing. Your edits are
      preserved. Reload the latest settings before saving to avoid overwriting
      those changes.
    </p>
  );
}
