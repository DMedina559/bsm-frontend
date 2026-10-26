import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { application } from "../../app/application";
export default function RuntimeRecordingIndicator() {
  const snapshot = useSyncExternalStore(
    application.diagnostics.subscribe,
    application.diagnostics.getSnapshot,
  );
  if (!snapshot.enabled) return null;
  return (
    <Link
      className="runtime-recording-indicator"
      to="/application-monitor?view=diagnostics&category=frontend"
      title="Frontend diagnostics recording is enabled"
    >
      Recording diagnostics
    </Link>
  );
}
