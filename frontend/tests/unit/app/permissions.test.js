import { describe, expect, it } from "vitest";
import {
  operationAccess,
  runtimeOperations,
  tokenPresetPermissions,
} from "../../../src/app/permissions";

const entry = (permissions, scope = "server", extra = {}) => ({
  access: {
    version: 1,
    classification: "permission",
    authentication: "required",
    required_permissions: permissions,
    resource_scope: scope,
    integration_tokens: "supported",
    ...extra,
  },
});
const user = {
  role: "admin",
  permissions: ["future:start", "plugin:extra:view"],
  server_access: "assigned",
};
const policy = { server_permissions: ["future:start"] };
const resources = [
  { name: "Alpha", permissions: ["future:start"] },
  { name: "Beta", permissions: [] },
];
const operations = {
  start_server: entry(["future:start", "plugin:extra:view"]),
};
const check = (patch = {}, ops = operations, id = "start_server") =>
  operationAccess(ops, id, {
    user,
    policy,
    resources,
    serverName: "Alpha",
    ...patch,
  });

describe("runtime operation access", () => {
  it("uses renamed scopes and requires every permission without requiring global grants in server assignments", () => {
    expect(check().state).toBe("allowed");
    expect(check({ serverName: "Beta" }).state).toBe("denied");
    expect(
      check({ user: { ...user, permissions: ["future:start"] } }).state,
    ).toBe("denied");
  });
  it("does not infer access from administrator roles or missing metadata", () => {
    expect(check({ user: { role: "admin", permissions: [] } }).state).toBe(
      "denied",
    );
    expect(check({}, null).state).toBe("unknown");
    expect(check({}, {}).state).toBe("unsupported");
    expect(
      check({}, { start_server: entry([], "global", { version: 2 }) }).state,
    ).toBe("unknown");
    expect(check({ user: { role: "admin" } }).state).toBe("unknown");
    expect(check({ resources: undefined }).state).toBe("unknown");
  });
  it("honors revoked grants and distinguishes contextual checks from permission denial", () => {
    expect(
      check({ resources: [{ name: "Alpha", permissions: [] }] }).state,
    ).toBe("denied");
    expect(
      check(
        {},
        {
          start_server: entry(["future:start"], "server", {
            additional_checks: ["recent-interactive-verification"],
          }),
        },
      ).state,
    ).toBe("conditional");
    expect(
      check(
        { user: { ...user, credential_id: "restricted" } },
        {
          start_server: entry([], "global", {
            integration_tokens: "unsupported",
          }),
        },
      ).state,
    ).toBe("denied");
  });
  it("selects the advertised log alternative using the requested topic", () => {
    const ops = {
      logs: entry([], "collection", {
        classification: "custom",
        credential_alternatives: [
          {
            condition: "topic=server_log:<server>",
            permissions: ["future:start"],
          },
          {
            condition: "topic=app_log or app_logs",
            permissions: ["future:app"],
          },
        ],
      }),
    };
    expect(
      check({ query: { topic: "server_log:Alpha" } }, ops, "logs").state,
    ).toBe("conditional");
    expect(
      check(
        { serverName: "Beta", query: { topic: "server_log:Beta" } },
        ops,
        "logs",
      ).state,
    ).toBe("denied");
    expect(check({ query: { topic: "app_log" } }, ops, "logs").state).toBe(
      "denied",
    );
    expect(check({ query: { topic: "unknown" } }, ops, "logs").state).toBe(
      "unknown",
    );
  });
  it("derives token presets from operation requirements and intersects delegatable permissions", () => {
    expect(
      tokenPresetPermissions(operations, ["future:start"], "operator"),
    ).toEqual(["future:start"]);
    expect(
      tokenPresetPermissions(
        { start_server: entry(["renamed:again"]) },
        ["future:start", "renamed:again"],
        "operator",
      ),
    ).toEqual(["renamed:again"]);
    expect(
      tokenPresetPermissions(undefined, ["future:start"], "monitoring"),
    ).toEqual([]);
  });
  it("rejects invalid discovery documents and preserves plugin metadata", () => {
    expect(() => runtimeOperations({ paths: [] })).toThrow();
    expect(
      runtimeOperations({
        openapi: "3.1.0",
        paths: {
          "/extra": {
            get: {
              operationId: "extra",
              "x-bsm-access": entry(["plugin:extra:view"]).access,
            },
          },
        },
      }).extra.access.required_permissions,
    ).toEqual(["plugin:extra:view"]);
  });
});
