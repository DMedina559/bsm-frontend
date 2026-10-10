import { getPreferenceIdentity, getBackendIdentity } from "./backendIdentity";
import { sessionRuntime } from "./sessionRuntime";
import { resolveOperationUrl } from "../api/operations";
import {
  captureServerRevision,
  reconcileMonitorSnapshot,
} from "./synchronizeServerEvent";
import {
  useQuery,
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
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
  installedAddons: {
    key: queryKeys.serverAddons,
    url: (name) =>
      resolveOperationUrl("list_server_addons", {
        path: { server_name: name },
      }),
    select: (data) => {
      const addons = object(data?.addons, "installed addons");
      const packs = (kind) =>
        array(addons[kind], kind).map((pack) => {
          if (typeof pack?.uuid !== "string")
            throw new Error("Invalid addon UUID");
          return { ...pack, id: pack.uuid };
        });
      return {
        behavior_packs: packs("behavior_packs"),
        resource_packs: packs("resource_packs"),
      };
    },
  },
  globalPlayers: {
    key: queryKeys.globalPlayers,
    url: () => resolveOperationUrl("list_players"),
    select: (data) => array(data?.players, "players"),
  },
  audit: {
    key: queryKeys.audit,
    url: () => resolveOperationUrl("list_audit_logs"),
    select: (data) => array(data, "list"),
  },
  tasks: {
    key: queryKeys.tasks,
    url: () => resolveOperationUrl("list_tasks"),
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
      resolveOperationUrl(
        {
          allowlist: "get_allowlist",
          permissions: "get_permissions",
          bans: "get_server_bans",
        }[kind],
        { path: { server_name: name } },
      ),
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
    url: (name) =>
      resolveOperationUrl("list_server_backups", {
        path: { server_name: name, backup_type: "all" },
      }),
    select: (data) => {
      const backups = object(data?.backups, "backups");
      return Object.fromEntries(
        ["world", "properties", "allowlist", "permissions"].map((category) => {
          const files = backups[`${category}_backups`];
          return [
            category,
            array(files === undefined ? [] : files, `${category} backups`),
          ];
        }),
      );
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
  const identity = getPreferenceIdentity(user);
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
        resource === "serverSettings" ||
        resource === "installedAddons"
      ) ||
        Boolean(target)),
  });
}
/** A shared mutation policy: no retries of writes, invalidate only affected resources. */
export function useResourceMutation(mutationFn, affectedKeys) {
  const client = useQueryClient();
  const { user, sessionGeneration } = useAuth();
  const scope = JSON.stringify([
    getPreferenceIdentity(user),
    sessionGeneration,
    affectedKeys,
  ]);
  const mutationKey = ["resource-write", scope];
  const pendingVariables = useMutationState({
    filters: { mutationKey, status: "pending" },
    select: (entry) => entry.state.variables?.variables,
  });
  const mutation = useMutation({
    mutationKey,
    mutationFn: async (job) => {
      const assertCurrent = () => {
        job.session.signal.throwIfAborted();
        if (
          !sessionRuntime.isCurrent(job.session) ||
          job.session.backend !== getBackendIdentity()
        )
          throw new DOMException("Session changed", "AbortError");
      };
      assertCurrent();
      const result = await job.run(job.variables, {
        session: job.session,
        signal: job.session.signal,
        assertCurrent,
      });
      assertCurrent();
      return result;
    },
    onSuccess: async (_result, job) => {
      if (
        !sessionRuntime.isCurrent(job.session) ||
        job.session.backend !== getBackendIdentity()
      )
        return;
      await Promise.all(
        job.keys.map((queryKey) =>
          client.invalidateQueries(resourceInvalidation(queryKey)),
        ),
      );
    },
  });
  const job = (variables) => ({
    variables,
    scope,
    session: { ...sessionRuntime.capture(), backend: getBackendIdentity() },
    keys: affectedKeys,
    run: mutationFn,
  });
  return {
    ...mutation,
    isPending: pendingVariables.length > 0,
    pendingVariables,
    data: mutation.variables?.scope === scope ? mutation.data : undefined,
    error: mutation.variables?.scope === scope ? mutation.error : null,
    mutate: (variables, options) => mutation.mutate(job(variables), options),
    mutateAsync: (variables, options) =>
      mutation.mutateAsync(job(variables), options),
  };
}
