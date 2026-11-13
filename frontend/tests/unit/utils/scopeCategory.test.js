import { describe, expect, it } from "vitest";
import { getScopeCategory } from "../../../src/utils/scopeCategory";

describe("getScopeCategory", () => {
  it("categorizes server-scoped permissions", () => {
    expect(getScopeCategory("servers:lifecycle")).toBe("servers");
    expect(getScopeCategory("servers:command")).toBe("servers");
    expect(getScopeCategory("servers:read")).toBe("servers");
    expect(getScopeCategory("servers:logs")).toBe("servers");
  });

  it("categorizes properties permissions", () => {
    expect(getScopeCategory("properties:manage")).toBe("properties");
    expect(getScopeCategory("properties:read")).toBe("properties");
  });

  it("categorizes content, worlds, addons and downloads", () => {
    expect(getScopeCategory("worlds:manage")).toBe("content");
    expect(getScopeCategory("content:read")).toBe("content");
    expect(getScopeCategory("addons:manage")).toBe("content");
    expect(getScopeCategory("downloads:prune")).toBe("content");
  });

  it("categorizes backup permissions", () => {
    expect(getScopeCategory("backups:create")).toBe("backups");
    expect(getScopeCategory("backups:read")).toBe("backups");
    expect(getScopeCategory("backups:keys")).toBe("backups");
  });

  it("categorizes player and moderation permissions", () => {
    expect(getScopeCategory("players:read")).toBe("players");
    expect(getScopeCategory("allowlist:manage")).toBe("players");
    expect(getScopeCategory("bans:read")).toBe("players");
    expect(getScopeCategory("permissions:manage")).toBe("players");
  });

  it("categorizes security, account and identity permissions", () => {
    expect(getScopeCategory("tokens:manage")).toBe("access");
    expect(getScopeCategory("account:read")).toBe("access");
    expect(getScopeCategory("access:manage")).toBe("access");
    expect(getScopeCategory("sessions:admin")).toBe("access");
    expect(getScopeCategory("users:read")).toBe("access");
  });

  it("categorizes system, health and telemetry permissions", () => {
    expect(getScopeCategory("health:read")).toBe("system");
    expect(getScopeCategory("runtime:metrics")).toBe("system");
    expect(getScopeCategory("diagnostics:read")).toBe("system");
    expect(getScopeCategory("audit:read")).toBe("system");
    expect(getScopeCategory("application:logs")).toBe("system");
    expect(getScopeCategory("tasks:read")).toBe("system");
  });

  it("categorizes plugin scopes", () => {
    expect(getScopeCategory("plugins:read")).toBe("plugins");
    expect(getScopeCategory("plugin:config_editor:manage")).toBe("plugins");
  });

  it("categorizes scheduler and settings scopes", () => {
    expect(getScopeCategory("scheduler:manage")).toBe("settings");
    expect(getScopeCategory("settings:read")).toBe("settings");
  });

  it("categorizes roles and non-permission check names", () => {
    expect(getScopeCategory("admin")).toBe("admin");
    expect(getScopeCategory("moderator")).toBe("moderator");
    expect(getScopeCategory("user")).toBe("user");
    expect(getScopeCategory("credential-owner")).toBe("check");
  });

  it("returns default for unexpected or invalid inputs", () => {
    expect(getScopeCategory(null)).toBe("default");
    expect(getScopeCategory("")).toBe("default");
  });
});
