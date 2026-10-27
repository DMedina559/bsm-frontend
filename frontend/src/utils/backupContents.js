export const backupComponents = {
  world: "Active world (includes world packs)",
  "server.properties": "Server properties",
  "allowlist.json": "Allowlist",
  "permissions.json": "Player permissions",
  script_config: "Script configuration",
  bsm_settings: "BSM server settings",
  behavior_packs: "Server behavior packs",
  resource_packs: "Server resource packs",
  development_behavior_packs: "Development behavior packs",
  development_resource_packs: "Development resource packs",
};
export const defaultBackupComponents = Object.keys(backupComponents).slice(
  0,
  6,
);
