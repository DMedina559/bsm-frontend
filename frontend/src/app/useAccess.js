import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { callOperation } from "../api/operations";
import { getPreferenceIdentity } from "./backendIdentity";
import { queryClient } from "./queryClient";

/** UI hints only; each backend operation remains authoritative. */
export function useAccess() {
  const { user, sessionGeneration } = useAuth() ?? {};
  const assigned = user?.server_access === "assigned";
  const resources = useQuery(
    {
      queryKey: [
        "access-servers",
        getPreferenceIdentity(user),
        sessionGeneration,
      ],
      queryFn: ({ signal }) => callOperation("list_access_servers", { signal }),
      enabled: assigned && user?.permissions?.includes("servers:read") === true,
    },
    queryClient,
  );
  function can(permission, serverName) {
    if (!Array.isArray(user?.permissions)) return true;
    if (!user.permissions.includes(permission)) return false;
    if (serverName && assigned)
      return (
        resources.data
          ?.find((server) => server.name === serverName)
          ?.permissions.includes(permission) === true
      );
    return true;
  }
  return { can, resources: resources.data, assigned };
}
