import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { callOperation } from "../api/operations";
import { getPreferenceIdentity } from "./backendIdentity";
import { queryClient } from "./queryClient";
import { ACTIONS, ACTION_PERMISSIONS, PERMISSIONS } from "./permissions";

/** UI hints only; each backend operation remains authoritative. */
export function useAccess() {
  const { user, sessionGeneration } = useAuth() ?? {};
  const assigned = user?.server_access === "assigned";
  const identity = getPreferenceIdentity(user);

  const policy = useQuery(
    {
      queryKey: ["access-policy", identity, sessionGeneration],
      queryFn: ({ signal }) => callOperation("get_access_policy", { signal }),
      enabled: Boolean(user),
      staleTime: 60000,
    },
    queryClient,
  );

  const resources = useQuery(
    {
      queryKey: ["access-servers", identity, sessionGeneration],
      queryFn: ({ signal }) => callOperation("list_access_servers", { signal }),
      enabled:
        assigned &&
        Array.isArray(user?.permissions) &&
        user.permissions.includes(PERMISSIONS.SERVERS_READ),
    },
    queryClient,
  );

  function resolveScope(target) {
    return ACTION_PERMISSIONS[target] ?? target;
  }

  function hasPermission(list, target) {
    if (!Array.isArray(list)) return false;
    const resolved = resolveScope(target);
    return list.includes(resolved);
  }

  function can(permissionOrAction, serverName) {
    if (!Array.isArray(user?.permissions)) return true;
    if (!hasPermission(user.permissions, permissionOrAction)) return false;
    if (serverName && assigned) {
      const server = resources.data?.find((item) => item.name === serverName);
      if (!server || !Array.isArray(server.permissions)) return false;
      return hasPermission(server.permissions, permissionOrAction);
    }
    return true;
  }

  return {
    can,
    canAction: can,
    policy: policy.data,
    resources: resources.data,
    assigned,
  };
}

/**
 * Semantic per-server access helper hook.
 * @param {string} [serverName]
 */
export function useServerAccess(serverName) {
  const access = useAccess();
  const { can } = access;

  const canLifecycle = can(ACTIONS.SERVER_LIFECYCLE, serverName);
  const canCommand = can(ACTIONS.SERVER_COMMAND, serverName);
  const canUpdate = can(ACTIONS.SERVER_INSTALL, serverName);
  const canDelete = can(ACTIONS.SERVER_DELETE, serverName);
  const canConfigure = can(ACTIONS.SERVER_CONFIGURE, serverName);
  const canManageProperties = can(ACTIONS.PROPERTIES_MANAGE, serverName);
  const canReadProperties =
    can(ACTIONS.PROPERTIES_READ, serverName) || canManageProperties;

  return {
    ...access,
    canLifecycle,
    canCommand,
    canUpdate,
    canDelete,
    canConfigure,
    canProperties: canManageProperties,
    canManageProperties,
    canReadProperties,
    canBackups: can(ACTIONS.BACKUPS_READ, serverName),
    canAllowlist: can(ACTIONS.ALLOWLIST_READ, serverName),
    canLogs: can(ACTIONS.LOGS_READ, serverName),
  };
}
