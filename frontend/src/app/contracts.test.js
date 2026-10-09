import { expect, it } from "vitest";
import contract from "../api/generated/openapi.json";
it("has unique operation IDs and the resource endpoints consumed by shared queries", () => {
  const ids = Object.values(contract.paths).flatMap((path) =>
    Object.values(path)
      .filter((operation) => operation.operationId)
      .map((operation) => operation.operationId),
  );
  expect(new Set(ids).size).toBe(ids.length);
  for (const endpoint of [
    "/api/servers",
    "/api/plugins",
    "/api/users/list",
    "/api/settings/get",
    "/api/downloads/list",
  ])
    expect(contract.paths[endpoint]?.get).toBeDefined();
});
