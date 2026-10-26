import { describe, it, expect } from "vitest";
import {
  formatTimestamp,
  parseInstant,
  resolveDisplayTimezone,
  timestampDetails,
} from "../../../src/utils/time";

describe("UTC instants and display timezones", () => {
  it("interprets historical offset-free API values as UTC", () => {
    expect(parseInstant("2026-10-26T21:42:00").toISOString()).toBe(
      "2026-10-26T21:42:00.000Z",
    );
    expect(parseInstant("2026-10-26 21:42:00").toISOString()).toBe(
      "2026-10-26T21:42:00.000Z",
    );
    expect(parseInstant(null)).toBeNull();
    expect(formatTimestamp("invalid")).toBe("—");
  });
  it("requires explicit units for numeric timestamps", () => {
    expect(parseInstant(1000).getTime()).toBe(1000);
    expect(parseInstant(1, "seconds").getTime()).toBe(1000);
  });
  it("follows Pacific daylight saving and includes the offset name", () => {
    expect(
      formatTimestamp("2026-01-15T22:00:00Z", {
        timezone: "America/Los_Angeles",
      }),
    ).toMatch(/2:00.*PM.*PST/);
    expect(
      formatTimestamp("2026-07-15T21:00:00Z", {
        timezone: "America/Los_Angeles",
      }),
    ).toMatch(/2:00.*PM.*PDT/);
  });
  it("groups instants by the selected local date", () => {
    const instant = "2026-10-27T01:00:00Z";
    expect(
      formatTimestamp(instant, {
        timezone: "America/Los_Angeles",
        kind: "date",
      }),
    ).toContain("26");
    expect(
      formatTimestamp(instant, { timezone: "UTC", kind: "date" }),
    ).toContain("27");
    expect(timestampDetails(instant)).toContain("2026-10-27T01:00:00.000Z");
  });
  it("uses the application setting and safely handles older backends", () => {
    expect(resolveDisplayTimezone("application", "America/Los_Angeles")).toBe(
      "America/Los_Angeles",
    );
    expect(resolveDisplayTimezone("application", undefined)).toBe("UTC");
    expect(resolveDisplayTimezone("utc", "America/Los_Angeles")).toBe("UTC");
  });
});
