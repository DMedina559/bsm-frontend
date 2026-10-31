import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, X } from "lucide-react";

/** Keep the one-time credential and clipboard result local to this view. */
export default function CredentialSecret({ value, onDismiss }) {
  const [state, setState] = useState("idle");
  const field = useRef(null);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function copy() {
    setState("copying");
    try {
      await navigator.clipboard.writeText(value);
      if (active.current) setState("copied");
    } catch {
      if (!active.current) return;
      setState("failed");
      field.current?.focus();
      field.current?.select();
    }
  }
  return (
    <section className="credential-secret" aria-label="Your new credential">
      <div className="credential-secret-heading">
        <KeyRound size={20} aria-hidden="true" />
        <div>
          <h3>Credential ready</h3>
          <p>Copy this credential now. It will not be shown again.</p>
        </div>
      </div>
      <textarea
        ref={field}
        aria-label="New integration credential"
        readOnly
        value={value}
        rows={2}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        onFocus={(event) => event.target.select()}
      />
      <div className="credential-secret-actions">
        <button
          type="button"
          className="action-button primary-button"
          onClick={copy}
          disabled={state === "copying"}
        >
          {state === "copied" ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          {state === "copied"
            ? "Copied"
            : state === "copying"
              ? "Copying…"
              : "Copy credential"}
        </button>
        <button
          type="button"
          className="action-button secondary"
          onClick={onDismiss}
        >
          <X size={16} aria-hidden="true" />
          Dismiss credential
        </button>
      </div>
      <p
        className={`credential-copy-status ${state === "failed" ? "failed" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {state === "copied"
          ? "Credential copied to clipboard."
          : state === "failed"
            ? "Could not copy automatically. The credential is selected; copy it manually."
            : "Store it somewhere secure before dismissing."}
      </p>
    </section>
  );
}
