import { buildOperationRegistry } from "@bedrock-server-manager/api-client/operationRegistry";

/** Interpret only the connected backend's advertised access policy. */
export function runtimeOperations(schema) {
  if (
    typeof schema?.openapi !== "string" ||
    !schema.openapi.startsWith("3.") ||
    !schema.paths ||
    typeof schema.paths !== "object" ||
    Array.isArray(schema.paths)
  )
    throw new Error("The backend did not return a valid OpenAPI contract.");
  return buildOperationRegistry(schema);
}

function alternativeMatches(condition, query) {
  // Contextual log policies advertise the topic boundary, not a single scope.
  if (condition === "topic=server_log:<server>")
    return (
      typeof query?.topic === "string" && query.topic.startsWith("server_log:")
    );
  if (condition === "topic=app_log or app_logs")
    return ["app_log", "app_logs"].includes(query?.topic);
  return false;
}

export function operationPermissions(operations, id, { query } = {}) {
  const access = operations?.[id]?.access;
  if (access?.version !== 1 || !Array.isArray(access.required_permissions))
    return null;
  if (access.credential_alternatives?.length) {
    const alternative = access.credential_alternatives.find((item) =>
      alternativeMatches(item.condition, query),
    );
    if (!alternative || !Array.isArray(alternative.permissions)) return null;
    return [
      ...new Set([...access.required_permissions, ...alternative.permissions]),
    ];
  }
  return access.required_permissions;
}

/** UI availability is advisory: contextual checks are still enforced by BSM. */
export function operationAccess(
  operations,
  id,
  { user, policy, resources, serverName, query } = {},
) {
  const unknown = { state: "unknown", permissions: [] };
  if (!operations) return unknown;
  if (!Object.hasOwn(operations, id))
    return { ...unknown, state: "unsupported" };
  const access = operations[id].access;
  if (access?.version !== 1) return unknown;
  const required = operationPermissions(operations, id, { query });
  if (!required) return unknown;
  if (access.classification === "public" && access.authentication === "none")
    return { state: "allowed", permissions: required };
  if (!user) return { state: "denied", permissions: required };
  if (user.credential_id && access.integration_tokens === "unsupported")
    return { state: "denied", permissions: required };
  if (!Array.isArray(user.permissions)) return unknown;
  if (required.some((permission) => !user.permissions.includes(permission)))
    return { state: "denied", permissions: required };
  if (access.classification === "legacy-role") {
    if (!Array.isArray(access.allowed_roles)) return unknown;
    if (!access.allowed_roles.includes(user.role))
      return { state: "denied", permissions: required };
  } else if (
    !["permission", "authenticated", "contextual"].includes(
      access.classification,
    ) &&
    !(
      access.classification === "custom" &&
      access.credential_alternatives?.length
    )
  )
    return unknown;
  if (
    access.resource_scope === "server" ||
    query?.topic?.startsWith("server_log:")
  ) {
    if (!serverName) return { state: "conditional", permissions: required };
    if (user.server_access === "assigned") {
      if (
        !Array.isArray(resources) ||
        !Array.isArray(policy?.server_permissions)
      )
        return unknown;
      const server = resources.find((item) => item.name === serverName);
      if (
        !server ||
        required.some(
          (permission) =>
            policy.server_permissions.includes(permission) &&
            !server.permissions?.includes(permission),
        )
      )
        return { state: "denied", permissions: required };
    }
  }
  return {
    state:
      access.additional_checks?.length ||
      ["contextual", "custom"].includes(access.classification)
        ? "conditional"
        : "allowed",
    permissions: required,
  };
}

// Presets describe intended operations; scope names always come from live metadata.
export const TOKEN_PRESETS = {
  monitoring: [
    "get_account",
    "get_application_health",
    "list_servers",
    "list_tasks",
  ],
  operator: [
    "get_account",
    "get_application_health",
    "list_servers",
    "get_server_process_info",
    "start_server",
    "stop_server",
    "restart_server",
    "send_command",
    "get_log_history",
    "list_tasks",
  ],
  backups: [
    "get_account",
    "get_application_health",
    "list_servers",
    "list_server_snapshots",
    "create_server_snapshot",
    "list_tasks",
  ],
};
export function tokenPresetPermissions(operations, allowed = [], preset) {
  if (preset === "full") return allowed;
  const required = (TOKEN_PRESETS[preset] ?? []).flatMap(
    (id) =>
      operationPermissions(operations, id, {
        query: { topic: "server_log:<server>" },
      }) ?? [],
  );
  return [...new Set(required)].filter((permission) =>
    allowed.includes(permission),
  );
}
