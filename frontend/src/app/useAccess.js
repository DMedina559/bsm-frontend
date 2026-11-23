import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { callOperation } from "../api/operations";
import { loadAccessSchema } from "../api/access";
import { getPreferenceIdentity } from "./backendIdentity";
import { queryClient } from "./queryClient";
import {
  operationAccess,
  operationPermissions,
  runtimeOperations,
} from "./permissions";

/** UI hints only; each backend operation remains authoritative. */
export function useAccess() {
  const { user, sessionGeneration } = useAuth() ?? {};
  const assigned = user?.server_access === "assigned";
  const identity = getPreferenceIdentity(user);
  const operations = useQuery(
    {
      queryKey: [
        "access-operations",
        identity,
        sessionGeneration,
        user?.policy_revision,
      ],
      queryFn: async ({ signal }) =>
        runtimeOperations(await loadAccessSchema({ signal })),
      enabled: Boolean(user) && !user.mfa_enrollment_required,
      staleTime: 60000,
      retry: false,
    },
    queryClient,
  );
  const policy = useQuery(
    {
      queryKey: [
        "access-policy",
        identity,
        sessionGeneration,
        user?.policy_revision,
      ],
      queryFn: ({ signal }) => callOperation("get_access_policy", { signal }),
      enabled: Boolean(user),
      staleTime: 60000,
      retry: false,
    },
    queryClient,
  );
  const currentOperations = operations.isError ? undefined : operations.data;
  const listAccess = operationAccess(currentOperations, "list_access_servers", {
    user,
  });
  const resources = useQuery(
    {
      queryKey: [
        "access-servers",
        identity,
        sessionGeneration,
        user?.policy_revision,
      ],
      queryFn: ({ signal }) => callOperation("list_access_servers", { signal }),
      enabled:
        assigned && ["allowed", "conditional"].includes(listAccess.state),
    },
    queryClient,
  );
  const access = (id, serverName, options = {}) =>
    operationAccess(currentOperations, id, {
      user,
      policy: policy.data,
      resources: resources.data,
      serverName,
      ...options,
    });
  const can = (id, serverName, options) =>
    ["allowed", "conditional"].includes(access(id, serverName, options).state);
  return {
    can,
    access,
    permissionsFor: (id, options) =>
      operationPermissions(currentOperations, id, options),
    operations: currentOperations,
    loading:
      Boolean(user) && !user.mfa_enrollment_required && operations.isPending,
    error: operations.error,
    policy: policy.data,
    policyQuery: policy,
    resources: resources.data,
    assigned,
  };
}

export function useServerAccess(serverName) {
  const access = useAccess();
  const can = (id) => access.can(id, serverName);
  return {
    ...access,
    canStart: can("start_server"),
    canStop: can("stop_server"),
    canRestart: can("restart_server"),
    canCommand: can("send_command"),
    canUpdate: can("update_server"),
    canDelete: can("delete_server"),
    canConfigure: can("set_server_setting"),
    canProperties: can("set_properties"),
    canManageProperties: can("set_properties"),
    canReadProperties: can("get_properties"),
    canBackups: can("list_server_snapshots"),
    canAllowlist: can("get_allowlist"),
    canLogs: access.can("get_log_history", serverName, {
      query: { topic: `server_log:${serverName}` },
    }),
  };
}
