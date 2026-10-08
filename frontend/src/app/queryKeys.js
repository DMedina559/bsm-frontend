/** Central query keys for the BSM application data layer. */
export const queryKeys = Object.freeze({
  bootstrap: () => ["bootstrap"],
  servers: () => ["servers"],
  server: (name) => ["servers", name],
  serverPlayers: (name) => ["servers", name, "players"],
  serverBackups: (name) => ["servers", name, "backups"],
  serverProperties: (name) => ["servers", name, "properties"],
  plugins: () => ["plugins"],
  plugin: (name) => ["plugins", name],
  tasks: () => ["tasks"],
  task: (id) => ["tasks", id],
  users: () => ["users"],
  settings: () => ["settings"],
});
