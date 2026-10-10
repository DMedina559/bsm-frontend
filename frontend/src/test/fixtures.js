export const servers = [
  {
    name: "Survival",
    status: "running",
    version: "1.21.100",
    player_count: 2,
    players: [
      { name: "Steve", xuid: "1234567890123456" },
      { name: "Alex", xuid: "1234567890123457" },
    ],
  },
  { name: "Creative", status: "stopped", version: "1.21.100", player_count: 0 },
  {
    name: "Community",
    status: "running",
    version: "1.21.100",
    player_count: 0,
  },
];
export const user = {
  username: "admin",
  id: 1,
  role: "admin",
  theme: "default",
  is_active: true,
};
export function fixtureResponse(url) {
  const p = url.pathname;
  if (p === "/api/setup/status") return { needs_setup: false };
  if (p === "/api/account") return user;
  if (p === "/auth/reauth")
    return { access_token: "fixture-only", token_type: "bearer" };
  if (p === "/api/servers") return { status: "success", servers };
  if (p === "/api/info")
    return {
      status: "success",
      info: {
        app_version: "4.0.0",
        splash_text: "Your worlds. Your infrastructure.",
      },
    };
  if (p === "/api/info/themes")
    return { status: "success", themes: ["default", "light", "blue"] };
  if (p === "/api/account/theme") {
    return { status: "success" };
  }
  if (p === "/api/plugins/pages") return { status: "success", pages: [] };
  if (p === "/api/plugins")
    return {
      status: "success",
      plugins: {
        backup_scheduler: {
          enabled: true,
          version: "1.0",
          description: "Scheduled backups for every world.",
        },
        content_uploader_plugin: {
          enabled: true,
          version: "1.0",
          description: "Upload your worlds and packs.",
        },
      },
    };
  if (p === "/api/settings/get")
    return {
      status: "success",
      settings: {
        web: { host: "0.0.0.0", port: 11325 },
        backups: { retention_count: 7, enabled: true },
        custom: {},
      },
    };
  if (p.endsWith("/settings/get"))
    return {
      status: "success",
      settings: {
        server_info: { status: "running", installed_version: "1.21.100" },
        automation: { auto_start: true, backup_interval: 60 },
        custom: {},
      },
    };
  if (p.endsWith("/properties/get"))
    return {
      status: "success",
      properties: {
        "server-name": "Survival",
        gamemode: "survival",
        difficulty: "normal",
        "max-players": "20",
        "server-port": "19132",
        "allow-cheats": "false",
        "online-mode": "true",
        "allow-list": "true",
        "level-name": "Bedrock level",
      },
      raw_content: "server-name=Survival\ngamemode=survival\nmax-players=20",
    };
  if (p.endsWith("/allowlist/get"))
    return {
      status: "success",
      players: [
        { name: "Steve", xuid: "1234567890123456", ignoresPlayerLimit: false },
      ],
    };
  if (p.endsWith("/permissions/get"))
    return {
      status: "success",
      permissions: [
        { name: "Steve", xuid: "1234567890123456", permission_level: "member" },
      ],
    };
  if (p.endsWith("/bans/get")) return { status: "success", bans: [] };
  if (p.endsWith("/backup/list/all"))
    return {
      status: "success",
      backups: {
        world_backups: ["2026-10-05-world.zip"],
        properties_backups: ["2026-10-05-properties.json"],
        permissions_backups: [],
        allowlist_backups: [],
      },
    };
  if (p === "/api/content/worlds")
    return {
      status: "success",
      files: ["Survival.mcworld", "Creative.mcworld"],
    };
  if (p === "/api/content/addons")
    return { status: "success", files: ["Resources.mcpack"] };
  if (p.endsWith("/addons"))
    return {
      status: "success",
      addons: { behavior_packs: [], resource_packs: [] },
    };
  if (p === "/api/players/get")
    return {
      status: "success",
      players: [
        { name: "Steve", xuid: "1234567890123456" },
        { name: "Alex", xuid: "1234567890123457" },
      ],
    };
  if (p === "/api/users/list")
    return [
      { id: 1, username: "admin", role: "admin", is_active: true },
      { id: 2, username: "moderator", role: "moderator", is_active: true },
    ];
  if (p === "/audit-log/list")
    return [
      {
        id: 1,
        timestamp: "2026-10-06T02:00:00Z",
        user_id: 1,
        action: "server.start",
        details: { server: "Survival" },
      },
    ];
  if (p === "/api/logs/history")
    return {
      data: "",
      start: 0,
      end: 0,
      file_id: "fixture-log",
      has_more: false,
    };
  if (p === "/api/tasks/list") return [];
  if (p === "/api/downloads/list")
    return { status: "success", custom_zips: [] };
  if (p.includes("process"))
    return {
      status: "success",
      process_info: {
        pid: 123,
        cpu_percent: 12,
        memory_mb: 420,
        uptime: "1 day",
      },
    };
  return { status: "success" };
}
