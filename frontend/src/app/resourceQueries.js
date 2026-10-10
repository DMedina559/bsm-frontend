import { getPreferenceIdentity, getBackendIdentity } from "./backendIdentity";
import { sessionRuntime } from "./sessionRuntime";
import { callOperation } from "../api/operations";
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
    load: (name, options) =>
      callOperation("list_server_addons", {
        path: { server_name: name },
        ...options,
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
    load: (_target, options) => callOperation("list_players", { ...options }),
    select: (data) => array(data?.players, "players"),
  },
  audit: {
    key: queryKeys.audit,
    load: (_target, options) =>
      callOperation("list_audit_logs", { ...options }),
    select: (data) => array(data, "list"),
  },
  tasks: {
    key: queryKeys.tasks,
    load: (_target, options) => callOperation("list_tasks", { ...options }),
    select: (data) => array(data, "list"),
  },
  serverSettings: {
    key: queryKeys.serverSettings,
    load: (name, options) =>
      callOperation("get_server_settings", {
        path: { server_name: name },
        ...options,
      }),
    select: (data) => object(data?.settings, "settings"),
  },
  access: {
    key: queryKeys.access,
    load: ([name, kind], options) =>
      callOperation(
        {
          allowlist: "get_allowlist",
          permissions: "get_permissions",
          bans: "get_server_bans",
        }[kind],
        { path: { server_name: name }, ...options },
      ),
    select: (data) =>
      array(data?.players ?? data?.permissions ?? data?.bans, "access"),
  },
  content: {
    key: queryKeys.content,
    load: (kind, options) =>
      callOperation(
        kind === "worlds" ? "list_available_worlds" : "list_available_addons",
        { ...options },
      ),
    select: (data) => array(data?.files, "content").map((name) => ({ name })),
  },
  downloads: {
    key: queryKeys.downloads,
    load: (_target, options) => callOperation("list_downloads", { ...options }),
    select: (data) => array(data?.custom_zips, "downloads"),
  },
  monitor: {
    key: queryKeys.serverMonitor,
    load: (name, options) =>
      callOperation("get_server_process_info", {
        path: { server_name: name },
        ...options,
      }),
    select: (data) =>
      data?.process_info === null
        ? null
        : object(data?.process_info, "monitor"),
  },
  plugins: {
    key: queryKeys.plugins,
    load: (_target, options) => callOperation("list_plugins", { ...options }),
    select: (data) =>
      Object.entries(object(data?.plugins, "plugins"))
        .map(([name, details]) => ({ name, ...details }))
        .sort((a, b) => a.name.localeCompare(b.name)),
  },
  users: {
    key: queryKeys.users,
    load: (_target, options) => callOperation("list_users", { ...options }),
    select: (data) => {
      if (!Array.isArray(data)) throw new Error("Invalid users response");
      return data;
    },
  },
  backups: {
    key: queryKeys.serverBackups,
    load: (name, options) =>
      callOperation("list_server_backups", {
        path: { server_name: name, backup_type: "all" },
        ...options,
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
    load: (_target, options) => callOperation("get_settings", { ...options }),
    select: (data) => object(data?.settings, "settings"),
  },
  properties: {
    key: queryKeys.serverProperties,
    load: (name, options) =>
      callOperation("get_properties", {
        path: { server_name: name },
        ...options,
      }),
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
      const data = await definition.load(target, { signal });
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
