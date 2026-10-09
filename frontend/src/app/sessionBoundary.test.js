import { beforeEach, describe, expect, it } from "vitest";
import { queryClient } from "./queryClient";
import { getSessionStorageKey, resetApplicationSession } from "./sessionBoundary";

describe("application session boundary", () => {
  beforeEach(() => queryClient.clear());

  it("removes cached data when a session ends", async () => {
    queryClient.setQueryData(["servers", "old-user"], { servers: [{ name: "private" }] });
    await resetApplicationSession();
    expect(queryClient.getQueryData(["servers", "old-user"])).toBeUndefined();
  });

  it("namespaces persisted preferences by identity", () => {
    expect(getSessionStorageKey("user-1", "selectedServer")).not.toBe(
      getSessionStorageKey("user-2", "selectedServer"),
    );
    expect(getSessionStorageKey(null, "selectedServer")).toBeNull();
  });
});
