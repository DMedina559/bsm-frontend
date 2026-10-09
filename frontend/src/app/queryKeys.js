/** Central query keys for the BSM application data layer. */
export const queryKeys = Object.freeze({
  bootstrap: () => ["bootstrap"],
  servers: () => ["servers"],
  server: (name) => ["servers", name],
  serverPlayers: (name) => ["servers", name, "players"],
  serverBackups: (name) => ["servers", name, "backups"],
  serverProperties: (name) => ["servers", name, "properties"],
  serverMonitor: (name) => ["monitor", name],
  content: (kind) => (kind === undefined ? ["content"] : ["content", kind]),
  downloads: () => ["downloads"],
  plugins: () => ["plugins"],
  plugin: (name) => ["plugins", name],
  tasks: () => ["tasks"],
  task: (id) => ["tasks", id],
  globalPlayers: () => ["players"],
  audit: () => ["audit"],
  serverSettings: (name) => ["servers", name, "settings"],
  access: ([name, kind]) => ["servers", name, kind],
  users: () => ["users"],
  settings: () => ["settings"],
});
/** Fleet invalidation must not refetch every server's settings and backups. */
export function resourceInvalidation(queryKey) {
  return queryKey.length === 1 && queryKey[0] === "servers"
    ? {
        queryKey,
        predicate: (query) =>
          query.queryKey.length === 1 ||
          (query.queryKey.length === 2 &&
            typeof query.queryKey[1] === "object"),
      }
    : { queryKey };
}
