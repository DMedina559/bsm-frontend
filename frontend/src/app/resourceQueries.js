import { sessionRuntime } from "./sessionRuntime";
import { resolveOperationUrl } from "../api/operations";
import {
  captureServerRevision,
  reconcileMonitorSnapshot,
} from "./synchronizeServerEvent";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { get } from "../api";
import { queryKeys, resourceInvalidation } from "./queryKeys";

const array = (value, resource) => {
  if (!Array.isArray(value))
    throw new Error(`Invalid ${resource} response: expected a list`);
  return value;
};
const object = (value, resource) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid ${resource} response: expected an object`);
  return value;
};
const resources = {
  globalPlayers: {
    key: queryKeys.globalPlayers,
    url: () => "/api/players/get",
    select: (data) => array(data?.players, "players"),
  },
  audit: {
    key: queryKeys.audit,
    url: () => "/audit-log/list",
    select: (data) => array(data, "list"),
  },
  tasks: {
    key: queryKeys.tasks,
    url: () => "/api/tasks/list",
    select: (data) => array(data, "list"),
  },
  serverSettings: {
    key: queryKeys.serverSettings,
    url: (name) =>
      resolveOperationUrl("get_server_settings", {
        path: { server_name: name },
      }),
    select: (data) => object(data?.settings, "settings"),
  },
  access: {
    key: queryKeys.access,
    url: ([name, kind]) =>
      `/api/server/${encodeURIComponent(name)}/${kind}/get`,
    select: (data) =>
      array(data?.players ?? data?.permissions ?? data?.bans, "access"),
  },
  content: {
    key: queryKeys.content,
    url: (kind) =>
      resolveOperationUrl(
        kind === "worlds" ? "list_available_worlds" : "list_available_addons",
      ),
    select: (data) => array(data?.files, "content").map((name) => ({ name })),
  },
  downloads: {
    key: queryKeys.downloads,
    url: () => resolveOperationUrl("list_downloads"),
    select: (data) => array(data?.custom_zips, "downloads"),
  },
  monitor: {
    key: queryKeys.serverMonitor,
    url: (name) =>
      resolveOperationUrl("get_server_process_info", {
        path: { server_name: name },
      }),
    select: (data) =>
      data?.process_info === null
        ? null
        : object(data?.process_info, "monitor"),
  },
  plugins: {
    key: queryKeys.plugins,
    url: () => resolveOperationUrl("list_plugins"),
    select: (data) =>
      Object.entries(object(data?.plugins, "plugins"))
        .map(([name, details]) => ({ name, ...details }))
        .sort((a, b) => a.name.localeCompare(b.name)),
  },
  users: {
    key: queryKeys.users,
    url: () => resolveOperationUrl("list_users"),
    select: (data) => {
      if (!Array.isArray(data)) throw new Error("Invalid users response");
      return data;
    },
  },
  backups: {
    key: queryKeys.serverBackups,
    url: (name) => `/api/server/${encodeURIComponent(name)}/backup/list/all`,
    select: (data) => {
      const backups = data.details?.all_backups;
      if (!backups) throw new Error("Invalid backups response");
      return {
        world: array(backups.world_backups, "world backups"),
        properties: array(backups.properties_backups, "properties backups"),
        allowlist: array(backups.allowlist_backups, "allowlist backups"),
        permissions: array(backups.permissions_backups, "permissions backups"),
      };
    },
  },
  settings: {
    key: queryKeys.settings,
    url: () => resolveOperationUrl("get_settings"),
    select: (data) => object(data?.settings, "settings"),
  },
  properties: {
    key: queryKeys.serverProperties,
    url: (name) =>
      resolveOperationUrl("get_properties", { path: { server_name: name } }),
    select: (data) => {
      object(data?.properties, "properties");
      return data;
    },
  },
};
export function useResourceQuery(resource, target, options = {}) {
  const { user, sessionGeneration } = useAuth();
  const definition = resources[resource];
  const identity = user?.id ?? user?.username ?? null;
  const { enabled = true, ...queryOptions } = options;
  return useQuery({
    ...queryOptions,
    queryKey: [
      ...definition.key(target),
      { identity, generation: sessionGeneration ?? 0 },
    ],
    queryFn: async ({ signal }) => {
      const startedAt = captureServerRevision();
      const data = await get(definition.url(target), { signal });
      return resource === "monitor"
        ? reconcileMonitorSnapshot(data, target, startedAt)
        : data;
    },
    select: definition.select,
    enabled:
      enabled &&
      identity !== null &&
      (!(
        resource === "backups" ||
        resource === "properties" ||
        resource === "monitor" ||
        resource === "serverSettings"
      ) ||
        Boolean(target)),
  });
}
/** A shared mutation policy: no retries of writes, invalidate only affected resources. */
export function useResourceMutation(mutationFn, affectedKeys) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (variables) => {
      const session = sessionRuntime.capture();
      const result = await mutationFn(variables);
      if (!sessionRuntime.isCurrent(session))
        throw new DOMException("Session changed", "AbortError");
      return result;
    },
    onSuccess: async () => {
      await Promise.all(
        affectedKeys.map((queryKey) =>
          client.invalidateQueries(resourceInvalidation(queryKey)),
        ),
      );
    },
  });
}
