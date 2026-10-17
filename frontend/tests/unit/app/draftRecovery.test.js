import { expect, it } from "vitest";
import {
  createDraftPatch,
  restoreDraftPatch,
  validDraftPatch,
} from "../../../src/app/draftRecovery";
it("persists only recognized safe edits, excluding secrets and custom/plugin fields", () => {
  const before = {
    monitoring: { app_metrics_interval_sec: 3 },
    web: { jwt_secret_key: "old" },
    custom: { innocuous: "secret" },
  };
  const after = {
    monitoring: { app_metrics_interval_sec: 10 },
    web: { jwt_secret_key: "new" },
    custom: { innocuous: "new secret" },
  };
  const patch = createDraftPatch("settings", before, after);
  expect(patch).toEqual([
    { path: "monitoring.app_metrics_interval_sec", baseline: 3, value: 10 },
  ]);
  expect(createDraftPatch("plugin-settings:example", before, after)).toEqual(
    [],
  );
  expect(
    validDraftPatch("settings", [
      { path: "web.jwt_secret_key", baseline: "old", value: "secret" },
    ]),
  ).toBe(false);
  expect(
    validDraftPatch("settings", [
      { path: "__proto__.x", baseline: 1, value: 2 },
    ]),
  ).toBe(false);
});
it("rebases recovered fields on fresh settings and flags baseline conflicts", () => {
  const patch = [
    { path: "monitoring.app_metrics_interval_sec", baseline: 3, value: 10 },
  ];
  const fresh = {
    monitoring: { app_metrics_interval_sec: 5 },
    web: { jwt_secret_key: "current secret" },
  };
  const restored = restoreDraftPatch("settings", fresh, patch);
  expect(restored.conflicted).toBe(true);
  expect(restored.value.web.jwt_secret_key).toBe("current secret");
  expect(restored.value.monitoring.app_metrics_interval_sec).toBe(10);
  expect(fresh.monitoring.app_metrics_interval_sec).toBe(5);
});
it("recovers recognized properties without including unknown properties", () => {
  const before = [
    { key: "max-players", value: "10" },
    { key: "password", value: "secret" },
  ];
  const after = [
    { key: "max-players", value: "30" },
    { key: "password", value: "newsecret" },
  ];
  const patch = createDraftPatch("server-properties:one", before, after);
  expect(patch).toEqual([{ path: "max-players", baseline: "10", value: "30" }]);
  expect(
    restoreDraftPatch("server-properties:one", before, patch).value[0].value,
  ).toBe("30");
});
