import { expect, it } from "vitest";
import { fixtureResponse } from "./fixtures";
import { assertApiRequest, assertApiResponse } from "./apiContract";

const reads = [
  "/api/account",
  "/api/servers",
  "/api/info",
  "/api/info/themes",
  "/api/plugins/pages",
  "/api/plugins",
  "/api/settings/get",
  "/api/players/get",
  "/api/users/list",
  "/audit-log/list",
  "/api/tasks/list",
  "/api/downloads/list",
  "/api/content/worlds",
  "/api/content/addons",
  "/api/logs/history?topic=app_log",
  ...[
    "settings/get",
    "properties/get",
    "allowlist/get",
    "permissions/get",
    "bans/get",
    "backup/list/all",
    "addons",
    "process_info",
  ].map((suffix) => `/api/server/Survival/${suffix}`),
];
it.each(reads)("uses a backend-valid fixture for GET %s", (url) => {
  assertApiResponse(
    "GET",
    url,
    fixtureResponse(new URL(url, "http://bsm.test")),
  );
});
it("uses a backend-valid reauthentication fixture", () => {
  assertApiResponse(
    "POST",
    "/auth/reauth",
    fixtureResponse(new URL("http://bsm.test/auth/reauth")),
  );
});
it("rejects stale request fields, response wrappers and property value types", () => {
  expect(() =>
    assertApiRequest("POST", "/api/server/Survival/addon/subpack", {
      pack_uuid: "pack",
      pack_type: "behavior",
      subpack_pack: "high",
    }),
  ).toThrow();
  expect(() =>
    assertApiResponse("GET", "/api/server/Survival/backup/list/all", {
      status: "success",
      details: { all_backups: {} },
    }),
  ).toThrow();
  expect(() =>
    assertApiResponse("GET", "/api/server/Survival/properties/get", {
      status: "success",
      properties: { "max-players": 20 },
      raw_content: "",
    }),
  ).toThrow();
});

it.each([400, 401, 403, 404, 409, 422, 500])(
  "uses the configured backend error model for HTTP %s",
  (status) => {
    assertApiResponse(
      "POST",
      "/api/server/Survival/addon/subpack",
      {
        error: {
          code: "validation_error",
          message: "Invalid request.",
          details: {
            errors: [{ location: ["body", "subpack_name"], code: "missing" }],
          },
        },
      },
      status,
    );
  },
);
