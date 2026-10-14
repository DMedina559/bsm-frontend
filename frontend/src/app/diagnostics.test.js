import { expect, it } from "vitest";
import {
  validateDiagnosticSnapshot,
  validateDiagnosticHistory,
  validateDiagnosticRuns,
  validateDiagnosticTrace,
} from "./diagnostics";
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
