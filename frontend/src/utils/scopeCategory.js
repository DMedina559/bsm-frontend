/**
 * Maps a permission/scope string or role name to its color category.
 *
 * @param {string} scope - The permission scope (e.g. "servers:lifecycle", "tokens:manage") or role ("admin")
 * @returns {string} The category identifier used for color coordination
 */
export function getScopeCategory(scope) {
  if (!scope || typeof scope !== "string") return "default";
  const trimmed = scope.trim();

  // Role badges
  if (trimmed === "admin" || trimmed === "moderator" || trimmed === "user") {
    return trimmed;
  }

  // Non-permission check strings (e.g., "credential-owner")
  if (!trimmed.includes(":")) {
    return "check";
  }

  const prefix = trimmed.split(":")[0];
  switch (prefix) {
    case "servers":
      return "servers";
    case "properties":
      return "properties";
    case "content":
    case "worlds":
    case "addons":
    case "downloads":
      return "content";
    case "backups":
      return "backups";
    case "players":
    case "allowlist":
    case "bans":
    case "permissions":
      return "players";
    case "account":
    case "users":
    case "access":
    case "tokens":
    case "sessions":
      return "access";
    case "health":
    case "runtime":
    case "diagnostics":
    case "audit":
    case "tasks":
    case "application":
      return "system";
    case "plugins":
    case "plugin":
      return "plugins";
    case "scheduler":
    case "settings":
      return "settings";
    default:
      return "default";
  }
}
