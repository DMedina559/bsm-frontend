import React from "react";
import { useTimeFormat } from "../../app/useTimeFormat";

export default function TokenAccessNotice({ account }) {
  const time = useTimeFormat();
  if (!account?.credential_id) return null;
  const knownExpiry = Object.hasOwn(account, "credential_expires_at");
  const expiry = !knownExpiry
    ? "Expiry unavailable"
    : account.credential_expires_at == null
      ? "Never expires"
      : `Expires ${time.format(account.credential_expires_at, { unit: "seconds" })}`;
  return (
    <aside
      className="token-access-notice"
      aria-label="Integration token access"
    >
      <strong>
        Integration token
        {account.credential_name ? ` · ${account.credential_name}` : ""}
      </strong>
      <span>{expiry}</span>
      <p>
        This connection uses the token’s permissions, not the account’s full
        role. Account security management is unavailable. Signing out forgets
        this credential without revoking it.
      </p>
      <details>
        <summary>
          Token permissions ({account.permissions?.length ?? 0})
          {account.server_access === "assigned"
            ? " · Assigned servers only"
            : ""}
        </summary>
        <div className="token-permission-list">
          {account.permissions?.map((permission) => (
            <code key={permission}>{permission}</code>
          ))}
        </div>
      </details>
    </aside>
  );
}
