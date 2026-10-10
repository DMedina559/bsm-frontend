import { it, expect } from "vitest";
import { readHistory } from "./notificationHistory";
it("caps notification storage and rejects expired or malformed records", () => {
  const timestamp = Date.now();
  const entries = Array.from({ length: 110 }, (_, i) => ({
    id: String(i),
    message: "Notice",
    type: "info",
    timestamp,
    read: false,
  }));
  localStorage.setItem(
    "history-test",
    JSON.stringify([
      {
        id: "old",
        message: "old",
        type: "info",
        timestamp: Date.now() - 8 * 86400000,
      },
      { id: "bad", message: null },
      ...entries,
    ]),
  );
  expect(readHistory("history-test")).toHaveLength(100);
  expect(readHistory("history-test")[0].id).toBe("0");
  localStorage.setItem("history-test", "invalid");
  expect(readHistory("history-test")).toEqual([]);
});
it("preserves messages written independently by two tabs and caps persisted entries", async () => {
  const { writeHistoryEntry, clearStoredHistory } =
    await import("./notificationHistory");
  localStorage.clear();
  for (let i = 0; i < 105; i++)
    writeHistoryEntry("shared", {
      id: String(i),
      message: `notice ${i}`,
      type: "info",
      timestamp: Date.now() + i,
      read: false,
    });
  expect(readHistory("shared")).toHaveLength(100);
  expect(localStorage.length).toBe(100);
  expect(readHistory("shared").some((entry) => entry.id === "104")).toBe(true);
  expect(readHistory("shared").some((entry) => entry.id === "103")).toBe(true);
  clearStoredHistory("shared");
  expect(readHistory("shared")).toEqual([]);
});
