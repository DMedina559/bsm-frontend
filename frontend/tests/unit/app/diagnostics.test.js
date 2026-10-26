import { expect, it } from "vitest";
import {
  validateDiagnosticSnapshot,
  validateDiagnosticHistory,
  validateDiagnosticRuns,
  validateDiagnosticTrace,
} from "../../../src/app/diagnostics";
it("rejects invalid diagnostic payloads before storing observations", () => {
  expect(() =>
    validateDiagnosticSnapshot({
      instance_id: "instance",
      snapshot_id: "snapshot",
      collected_at: 100,
      summary: { status: "ok", ready: null },
      sections: [{ name: null }],
    }),
  ).toThrow("Invalid diagnostic snapshot");
  expect(() =>
    validateDiagnosticHistory({ available: true, records: [{}] }),
  ).toThrow("Invalid diagnostic history");
  expect(() =>
    validateDiagnosticRuns({ available: true, runs: [{ instance_id: null }] }),
  ).toThrow("Invalid diagnostic run");
  expect(() =>
    validateDiagnosticTrace({
      events_available: false,
      tasks_available: true,
      tasks: [],
      history: { available: false, records: [] },
    }),
  ).not.toThrow();
});

it("validates global activity and preserves unavailable sources", async () => {
  const { validateDiagnosticActivity } =
    await import("../../../src/app/diagnostics");
  const value = {
    scope: "application",
    events: null,
    operations: {
      active: [],
      recent: [
        {
          operation_id: "op",
          name: "server.start",
          status: "finished",
          correlation_id: "trace",
        },
      ],
    },
    subscriptions: { items: [], total: 0 },
    truncated: true,
  };
  expect(validateDiagnosticActivity(value)).toBe(value);
  expect(() =>
    validateDiagnosticActivity({
      ...value,
      events: { active: [null], recent: [] },
    }),
  ).toThrow("Invalid diagnostic activity");
  expect(() =>
    validateDiagnosticActivity({
      ...value,
      operations: { active: [], recent: ["bad"] },
    }),
  ).toThrow("Invalid diagnostic activity");
});
