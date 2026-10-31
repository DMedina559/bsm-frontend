import React, { useEffect, useRef, useState } from "react";
import { probeInstance } from "./probe";

export default function ConnectionProbe({ url }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function test() {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setResult(null);
    try {
      const value = await probeInstance(url, { signal: current.signal });
      if (!current.signal.aborted)
        setResult({
          success: true,
          message: `BSM responded${value.version ? ` · ${value.version}` : ""}. ${value.needsSetup ? "Initial setup is required." : value.authenticationRequired ? "Sign in to verify backend version and access." : "Connection test passed; account access is checked at sign-in."}`,
        });
    } catch (error) {
      if (!current.signal.aborted)
        setResult({ success: false, message: error.message });
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  let address;
  try {
    const value = new URL(url);
    if (
      ["http:", "https:"].includes(value.protocol) &&
      !value.username &&
      !value.password
    )
      address = value.href;
  } catch {
    /* Invalid input stays editable. */
  }
  return (
    <div className="instance-probe">
      <button
        type="button"
        className="instance-button"
        onClick={test}
        disabled={busy || !url.trim()}
      >
        {busy ? "Testing…" : "Test connection"}
      </button>
      {address && (
        <a href={address} target="_blank" rel="noopener noreferrer">
          Open backend ↗
        </a>
      )}
      {result && (
        <p role={result.success ? "status" : "alert"}>{result.message}</p>
      )}
      <small>
        Read-only test. Certificate trust is managed by your browser; no saved
        credentials are sent.
      </small>
    </div>
  );
}
