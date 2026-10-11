const number = (description, min = 0, max, step = 1, unit) => ({
  type: "number",
  description,
  min,
  max,
  step,
  unit,
});
export const settingGroups = {
  paths: "Storage locations",
  retention: "Retention",
  monitoring: "Monitoring",
  web: "Web server",
  lifecycle: "Startup and shutdown",
  server_info: "Server information",
  settings: "Server behavior",
  custom: "Custom settings",
  plugin_settings: "Plugin settings",
};
export const settingGroupHelp = {
  paths: "Directories used for servers, backups, downloads, and extensions.",
  retention: "Previous files to keep. Zero disables automatic cleanup.",
  monitoring: "Metrics interval changes apply on the next monitoring cycle.",
  web: "Listener and authentication settings. Listener changes require a restart.",
  lifecycle:
    "Limits for startup and cleanup. Request draining changes require a web server restart.",
  server_info:
    "Installed state is reported by the server. Choose a target version for updates.",
  settings: "Automatic actions for this server.",
  custom: "Additional settings used by your extensions.",
};
const fields = {
  "monitoring.app_metrics_interval_sec": {
    ...number(
      "Application and system metrics sampling.",
      1,
      3600,
      1,
      "seconds",
    ),
    label: "Application metrics interval",
  },
  "monitoring.bedrock_metrics_interval_sec": {
    ...number(
      "Resource updates on Bedrock monitor pages.",
      1,
      3600,
      1,
      "seconds",
    ),
    label: "Bedrock metrics interval",
  },
  "monitoring.process_interval_sec": number(
    "Checks server process state.",
    1,
    undefined,
    1,
    "seconds",
  ),
  "monitoring.player_interval_sec": number(
    "Checks connected players.",
    1,
    undefined,
    1,
    "seconds",
  ),
  "monitoring.max_retries": number(
    "Retries before a failed process check is reported.",
  ),
  "retention.backups": number("Backups retained per server."),
  "retention.downloads": number("Downloaded versions retained."),
  "web.port": number("TCP port for the web server.", 1, 65535),
  "web.token_expires_weeks": number(
    "Lifetime of authentication tokens.",
    1,
    undefined,
    1,
    "weeks",
  ),
  "web.jwt_secret_key": {
    type: "password",
    description: "Signing secret. Changing it invalidates existing tokens.",
  },
  "server_info.status": { readOnly: true },
  "server_info.installed_version": { readOnly: true },
  "server_info.server_name": { readOnly: true },
  "settings.target_version": {
    description: "Use LATEST, PREVIEW, or a specific Bedrock version.",
  },
  "settings.autostart": {
    type: "boolean",
    description: "Start this server when the application starts.",
  },
  "settings.autoupdate": {
    type: "boolean",
    description: "Update this server automatically on startup.",
  },
};
for (const [key, description] of Object.entries({
  startup_timeout_seconds: "Deadline for each startup stage.",
  shutdown_timeout_seconds: "Deadline for each shutdown stage.",
  task_drain_timeout_seconds:
    "Time for operations to finish before cancellation.",
  plugin_timeout_seconds: "Time allowed for plugin unload and router cleanup.",
  cancellation_grace_seconds: "Extra time to handle cancellation.",
  request_drain_timeout_seconds: "Time to drain HTTP requests before cleanup.",
}))
  fields[`lifecycle.${key}`] = number(
    description,
    0.000001,
    key === "cancellation_grace_seconds" ? 30 : 600,
    "any",
    "seconds",
  );
export function settingField(path) {
  return fields[path] ?? {};
}
