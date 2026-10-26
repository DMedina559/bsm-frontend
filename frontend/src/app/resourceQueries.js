import { application } from "./application";
import {
  validateDiagnosticSnapshot,
  validateDiagnosticHistory,
  validateDiagnosticRuns,
  validateDiagnosticTrace,
} from "./diagnostics";
import { getPreferenceIdentity, getBackendIdentity } from "./backendIdentity";
import { sessionRuntime } from "./sessionRuntime";
import { callOperation } from "../api/operations";
import {
  captureStateRequest,
  reconcileResourceSnapshot,
} from "./applicationState";
import {
  useQuery,
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
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
const diagnosticResources = new Set([
  "diagnostics",
  "diagnosticHistory",
  "diagnosticRuns",
  "diagnosticTrace",
]);
const resources = {
  diagnostics: {
    key: queryKeys.diagnostics,
    load: (_target, options) =>
      callOperation("get_application_diagnostics", options),
    select: validateDiagnosticSnapshot,
  },
  diagnosticHistory: {
    key: queryKeys.diagnosticHistory,
    load: (filters, options) =>
      callOperation("get_diagnostic_history", { query: filters, ...options }),
    select: validateDiagnosticHistory,
  },
  diagnosticRuns: {
    key: queryKeys.diagnosticRuns,
    load: (_target, options) => callOperation("get_diagnostic_runs", options),
    select: validateDiagnosticRuns,
  },
  diagnosticTrace: {
    key: queryKeys.diagnosticTrace,
    load: (correlation, options) =>
      callOperation("get_diagnostic_trace", {
        path: { correlation_id: correlation },
        ...options,
      }),
    select: validateDiagnosticTrace,
  },
  applicationHealth: {
    key: queryKeys.applicationHealth,
    load: (_target, options) =>
      callOperation("get_application_health", options),
    select: (data) => {
      const health = object(data, "application health");
      const checks = object(health.checks, "health checks");
      if (
        !["healthy", "degraded"].includes(health.health) ||
        !["starting", "ready", "stopping", "stopped", "failed"].includes(
          health.lifecycle,
        ) ||
        !Number.isFinite(health.checked_at) ||
        health.checked_at <= 0 ||
        !Object.values(checks).every(
          (check) =>
            typeof check?.healthy === "boolean" &&
            typeof check.message === "string",
        )
      )
        throw new Error("Invalid application health response");
      return health;
    },
  },
  applicationMetrics: {
    key: queryKeys.applicationMetrics,
    load: (_target, options) =>
      callOperation("get_application_metrics", options),
    select: (data) => object(data, "application metrics"),
  },
  applicationInfo: {
    key: queryKeys.applicationInfo,
    load: (_target, options) => callOperation("get_system_info", options),
    select: (data) => object(data?.info, "application info"),
  },
  themes: {
    key: queryKeys.themes,
    load: (_target, options) => callOperation("list_themes", options),
    select: (data) => array(data?.themes, "themes"),
  },
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
  pluginSettings: {
    key: queryKeys.pluginSettings,
    load: (name, options) =>
      callOperation("get_plugin_settings", {
        path: { plugin_name: name },
        ...options,
      }),
    select: (data) => ({
      settings: object(data?.settings, "plugin settings"),
      settings_schema: data?.settings_schema ?? null,
    }),
  },
  pluginPages: {
    key: queryKeys.pluginPages,
    load: (_target, options) => callOperation("get_plugin_pages", options),
    select: (data) => array(data?.pages, "plugin pages"),
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
  backupHealth: {
    key: (name) => [...queryKeys.serverBackups(name), "health"],
    load: (name, options) =>
      callOperation("get_backup_health", {
        path: { server_name: name },
        ...options,
      }),
    select: (data) => object(data?.health, "backup health"),
  },
  backupRecovery: {
    key: (name) => [...queryKeys.serverBackups(name), "recovery"],
    load: (name, options) =>
      callOperation("get_restore_recovery", {
        path: { server_name: name },
        ...options,
      }),
    select: (data) => object(data?.recovery, "restore recovery"),
  },
  snapshots: {
    key: (name) => [...queryKeys.serverBackups(name), "snapshots"],
    load: (name, options) =>
      callOperation("list_server_snapshots", {
        path: { server_name: name },
        ...options,
      }),
    select: (data) => array(data?.backups, "server snapshots"),
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
  rawProperties: {
    key: queryKeys.serverRawProperties,
    load: (name, options) =>
      callOperation("get_raw_properties", {
        path: { server_name: name },
        ...options,
      }),
    select: (data) => {
      if (typeof data?.raw_content !== "string")
        throw new Error("Invalid raw properties response");
      return data;
    },
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
      const startedAt = captureStateRequest(signal);
      const data = await definition.load(target, { signal });
      try {
        definition.select(data);
      } catch (cause) {
        const error = new Error(cause.message, { cause });
        error.name = "InvalidResponseError";
        throw error;
      }
      return reconcileResourceSnapshot(
        resource,
        target,
        [
          ...definition.key(target),
          { identity, generation: sessionGeneration ?? 0 },
        ],
        data,
        startedAt,
      );
    },
    select: definition.select,
    enabled:
      enabled &&
      (!diagnosticResources.has(resource) || user?.role === "admin") &&
      identity !== null &&
      (!(
        resource === "backups" ||
        resource === "snapshots" ||
        resource === "backupRecovery" ||
        resource === "backupHealth" ||
        resource === "properties" ||
        resource === "rawProperties" ||
        resource === "monitor" ||
        resource === "serverSettings" ||
        resource === "installedAddons" ||
        resource === "pluginSettings"
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
      if (navigator.onLine === false)
        throw new Error(
          "Reconnect before making changes. Requests are not queued.",
        );
      const result = await job.run(job.variables, {
        session: job.session,
        signal: job.session.signal,
        assertCurrent,
      });
      assertCurrent();
      return result;
    },
    onSettled: async (_result, error, job) => {
      if (error && error.code !== "operation_incomplete") return;
      if (
        !sessionRuntime.isCurrent(job.session) ||
        job.session.backend !== getBackendIdentity()
      )
        return;
      if (job.keys.length)
        application.diagnostics.record("refresh-request", {
          reason: "command-settled",
          count: job.keys.length,
        });
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
  const callbacks = (options, pending) =>
    Object.fromEntries(
      Object.entries(options ?? {}).map(([name, callback]) => [
        name,
        typeof callback !== "function"
          ? callback
          : (...args) => {
              if (
                !pending.session.signal.aborted &&
                sessionRuntime.isCurrent(pending.session) &&
                pending.session.backend === getBackendIdentity()
              )
                return callback(...args);
            },
      ]),
    );
  return {
    ...mutation,
    isPending: pendingVariables.length > 0,
    pendingVariables,
    data: mutation.variables?.scope === scope ? mutation.data : undefined,
    error: mutation.variables?.scope === scope ? mutation.error : null,
    mutate: (variables, options) => {
      const pending = job(variables);
      return mutation.mutate(pending, callbacks(options, pending));
    },
    mutateAsync: (variables, options) => {
      const pending = job(variables);
      return mutation.mutateAsync(pending, callbacks(options, pending));
    },
  };
}
