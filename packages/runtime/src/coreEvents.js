import { queryKeys as q } from "./queryKeys.js";
// API trigger_event topics. Logs, monitor frames and task topics stay on demand.
export const lifecycleEvents = [
  "after_server_status_change",
  "after_server_start",
  "after_server_stop",
  "before_server_stop",
  "after_delete_server_data",
  "after_server_update",
  "after_server_install",
  "after_server_players_change",
];
const server = (name, key) => [key(name || null)];
export const mutationResources = {
  after_setting_update: () => [
    q.settings(),
    q.bootstrap(),
    q.pluginSettings(),
    q.plugins(),
  ],
  after_set_server_setting: (name) => [
    q.pluginSettings(),
    ...server(name, q.serverSettings),
    q.servers(),
  ],
  after_properties_change: (name) => [
    ...server(name, q.serverProperties),
    q.servers(),
  ],
  after_allowlist_change: (name) => [q.access([name || null, "allowlist"])],
  after_permission_change: (name) => [q.access([name || null, "permissions"])],
  after_add_server_ban: (name) => [q.access([name || null, "bans"])],
  after_remove_server_ban: (name) => [q.access([name || null, "bans"])],
  after_players_add: () => [q.globalPlayers()],
  after_player_db_scan: () => [q.globalPlayers()],
  backup_attention: (name) => server(name, q.serverBackups),
  backup_activity: (name) => server(name, q.serverBackups),
  after_backup: (name) => server(name, q.serverBackups),
  after_prune_backups: (name) => server(name, q.serverBackups),
  after_restore: (name) => [
    q.pluginSettings(),
    q.serverSettings(name || null),
    q.server(name || null),
    q.serverMonitor(name || null),
    q.servers(),
  ],
  after_world_export: () => [q.content()],
  after_world_import: (name) => [
    ...server(name, q.serverProperties),
    q.servers(),
  ],
  after_world_reset: (name) => [
    ...server(name, q.serverProperties),
    q.servers(),
  ],
  after_prune_download_cache: () => [q.downloads()],
  after_plugin_settings_update: (name) => [
    ...(name ? [q.serverSettings(name)] : []),
    q.pluginSettings(),
    q.settings(),
    q.plugins(),
  ],
  after_set_plugin_status: () => [q.plugins()],
  after_command_send: () => [],
};
for (const action of [
  "import",
  "enable",
  "disable",
  "subpack_update",
  "uninstall",
  "reorder",
])
  mutationResources[`after_addon_${action}`] = (name) => [
    ...server(name, q.serverAddons),
    q.content(),
  ];
export const coreEventTopics = [
  ...lifecycleEvents,
  ...Object.keys(mutationResources),
].map((event) => `event:${event}`);
