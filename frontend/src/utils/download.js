const DOWNLOAD_REVOKE_AFTER_FOCUS_MS = 60_000;
const DOWNLOAD_REVOKE_FALLBACK_MS = 5 * 60_000;

/**
 * Trigger a browser download for a Blob without revoking the backing object URL
 * while the native OS "Save As" dialog is still initializing or awaiting user
 * confirmation.
 */
export function triggerBlobDownload(blob, filename = "download") {
  const payload =
    blob instanceof Blob
      ? blob
      : new Blob([blob ?? ""], { type: "application/octet-stream" });
  const objectUrl = URL.createObjectURL(payload);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename || "download";
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } catch (error) {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
  anchor.remove();
  scheduleObjectUrlRevoke(objectUrl);
  return objectUrl;
}

function scheduleObjectUrlRevoke(objectUrl) {
  const revoke = URL.revokeObjectURL.bind(URL);
  let revoked = false;
  let focusTimer = null;
  let fallbackTimer = null;

  const cleanup = () => {
    if (revoked) return;
    revoked = true;
    if (focusTimer !== null) clearTimeout(focusTimer);
    if (fallbackTimer !== null) clearTimeout(fallbackTimer);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("pagehide", cleanup);
    revoke(objectUrl);
  };

  const armFocusTimer = () => {
    if (revoked) return;
    if (focusTimer !== null) clearTimeout(focusTimer);
    focusTimer = setTimeout(cleanup, DOWNLOAD_REVOKE_AFTER_FOCUS_MS);
    focusTimer?.unref?.();
  };

  const onFocus = () => {
    armFocusTimer();
  };

  window.addEventListener("focus", onFocus, { once: true });
  window.addEventListener("pagehide", cleanup, { once: true });
  armFocusTimer();
  fallbackTimer = setTimeout(cleanup, DOWNLOAD_REVOKE_FALLBACK_MS);
  fallbackTimer?.unref?.();
}
