import { it, expect } from "vitest";
import { readHistory } from "./notificationHistory";
it("caps notification storage and rejects expired or malformed records", () => {
  const entries = Array.from({ length: 110 }, (_, i) => ({
    id: String(i),
    message: "Notice",
    type: "info",
    timestamp: Date.now(),
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
