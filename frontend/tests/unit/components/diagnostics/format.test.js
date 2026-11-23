import { describe, expect, it } from "vitest";
import {
  fieldValue,
  isPidKey,
  labelFor,
  pluginStatusLabel,
} from "../../../../src/components/diagnostics/format";

describe("diagnostics format utilities", () => {
  it("recognizes pid keys correctly", () => {
    expect(isPidKey("pid")).toBe(true);
    expect(isPidKey("process_id")).toBe(true);
    expect(isPidKey("server_pid")).toBe(true);
    expect(isPidKey("child_pid")).toBe(true);
    expect(isPidKey("worker_process_id")).toBe(true);
    expect(isPidKey("rapid")).toBe(false);
    expect(isPidKey("upid")).toBe(false);
    expect(isPidKey("uptime_seconds")).toBe(false);
  });

  it("formats process IDs as plain strings without thousands separators", () => {
    expect(fieldValue("pid", 21904)).toBe("21904");
    expect(fieldValue("process_id", 123456)).toBe("123456");
    expect(fieldValue("server_pid", 1000)).toBe("1000");
    expect(fieldValue("pid", 0)).toBe("0");
    expect(fieldValue("pid", "21904")).toBe("21904");
    expect(fieldValue("pid", null)).toBe("Not reported");
    expect(fieldValue("pid", undefined)).toBe("Not reported");
  });

  it("formats labels correctly", () => {
    expect(labelFor("pid")).toBe("Process ID");
    expect(labelFor("process_id")).toBe("Process ID");
    expect(labelFor("uptime_seconds")).toBe("Uptime");
    expect(labelFor("server_name")).toBe("Server name");
  });

  it("formats counts and metrics with appropriate localization and units", () => {
    expect(fieldValue("queued", 1000)).toBe("1,000");
    expect(fieldValue("interval_seconds", 30)).toBe("30 seconds");
    expect(fieldValue("cpu_percent", 1.5)).toBe("1.5%");
    expect(fieldValue("loop_lag_ms", 12)).toBe("12 ms");
  });

  it("handles null and unknown fallbacks", () => {
    expect(fieldValue("last_error_type", null)).toBe("No error reported");
    expect(fieldValue("stage", null)).toBe("No stage reported");
    expect(fieldValue("shutdown_reason", null)).toBe("No reason reported");
    expect(fieldValue("correlation_id", null)).toBe("No correlation ID");
    expect(fieldValue("status", "unknown")).toBe("Status not reported");
    expect(pluginStatusLabel("UNKNOWN")).toBe("Status not reported");
  });
});
