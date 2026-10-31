import React, { useState } from "react";
import { Check, ShieldCheck, Search, Minus } from "lucide-react";

const labels = {
  public: "Public endpoint",
  authenticated: "Sign-in required",
  permission: "Permission required",
  "legacy-role": "Role restriction",
  custom: "Contextual access",
  unknown: "Access unknown",
};
const strings = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === "string"))].sort()
    : [];

function Chips({ values, permissions }) {
  return (
    <ul className="ae-access-chips">
      {values.map((value) => {
        const present = permissions?.includes(value);
        const Icon = present ? Check : Minus;
        return (
          <li
            key={value}
            className={present === false ? "ae-capability-missing" : ""}
          >
            {permissions && <Icon size={12} aria-hidden="true" />}
            <code>{value}</code>
            {permissions && (
              <span className="ae-sr-only">
                {present ? "Present" : "Missing"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function AccessPolicy({ policy = {}, permissions, connected }) {
  const [search, setSearch] = useState("");
  const required = strings(policy.required_permissions);
  const roles = strings(policy.allowed_roles);
  const checks = strings(policy.additional_checks);
  const account = Array.isArray(permissions) ? strings(permissions) : null;
  const missing = account
    ? required.filter((value) => !account.includes(value))
    : [];
  const groups = new Map();
  for (const value of account ?? []) {
    if (!value.toLowerCase().includes(search.trim().toLowerCase())) continue;
    const name = value.split(":")[0];
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(value);
  }
  const scope = {
    server: "One server",
    collection: "Filtered server collection",
    global: "Global or account",
  }[policy.resource_scope];
  return (
    <section className="ae-access" aria-label="Operation access">
      <div className="ae-access-heading">
        <span>
          <ShieldCheck size={15} aria-hidden="true" /> Access policy
        </span>
        <span className="ae-access-kind">
          {labels[policy.classification] ?? labels.unknown}
        </span>
      </div>
      <dl className="ae-access-facts">
        <div>
          <dt>Required capabilities</dt>
          <dd>
            {required.length ? (
              <Chips
                values={required}
                permissions={connected ? account : null}
              />
            ) : (
              <span className="ae-muted">
                {policy.classification === "public" ? "None" : "Not declared"}
              </span>
            )}
          </dd>
        </div>
        {roles.length > 0 && (
          <div>
            <dt>Allowed roles</dt>
            <dd>
              <Chips values={roles} />
            </dd>
          </div>
        )}
        {scope && (
          <div>
            <dt>Resource scope</dt>
            <dd>{scope}</dd>
          </div>
        )}
        {policy.integration_tokens && (
          <div>
            <dt>Integration credentials</dt>
            <dd>
              {policy.integration_tokens === "supported"
                ? "Supported within their granted access"
                : "Not supported"}
            </dd>
          </div>
        )}
      </dl>
      {required.length > 0 && connected && account && (
        <p
          className={`ae-access-note ${missing.length ? "ae-access-warning" : ""}`}
        >
          {missing.length
            ? `${missing.length} required ${missing.length === 1 ? "capability is" : "capabilities are"} missing from your account.`
            : "Your account has the required capabilities."}{" "}
          Server assignments and operation checks still apply.
        </p>
      )}
      {(policy.classification === "unknown" || !connected) && (
        <p className="ae-access-note">
          {!connected
            ? "Imported contract. Access is checked by the connected backend when a request runs."
            : "This backend does not declare a complete access policy for this operation."}
        </p>
      )}
      {checks.length > 0 && (
        <div className="ae-access-checks">
          <span>Additional checks</span>
          <Chips values={checks} />
        </div>
      )}
      <details className="ae-account-capabilities">
        <summary>
          Current account capabilities{" "}
          <span className="ae-access-count">
            {account?.length ?? "Unknown"}
          </span>
        </summary>
        {account ? (
          <div className="ae-account-capabilities-body">
            <label className="ae-search">
              <Search size={14} aria-hidden="true" />
              <input
                aria-label="Search account capabilities"
                placeholder="Filter capabilities…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="ae-capability-groups">
              {[...groups].map(([name, values]) => (
                <div key={name}>
                  <h4>
                    {name}
                    <span>{values.length}</span>
                  </h4>
                  <Chips values={values} />
                </div>
              ))}
              {!groups.size && (
                <p className="ae-muted">
                  {account.length
                    ? "No capabilities match your search."
                    : "This account has no declared capabilities."}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="ae-access-note">Unavailable from this backend.</p>
        )}
      </details>
    </section>
  );
}
