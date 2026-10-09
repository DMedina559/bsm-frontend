import { describe, expect, it } from "vitest";
import { getSessionStorageKey } from "./sessionBoundary";

describe("account preference keys", () => {
  it("namespaces persisted preferences by identity", () => {
    expect(getSessionStorageKey("user-1", "selectedServer")).not.toBe(
      getSessionStorageKey("user-2", "selectedServer"),
    );
    expect(getSessionStorageKey(null, "selectedServer")).toBeNull();
  });
});
