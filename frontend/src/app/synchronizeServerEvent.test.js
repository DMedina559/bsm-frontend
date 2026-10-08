import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";
import { synchronizeServerEvent } from "./synchronizeServerEvent";

describe("server WebSocket query synchronization", () => {
  beforeEach(() => queryClient.clear());

  it("updates the matching user-scoped server without touching others", () => {
    const key = [...queryKeys.servers(), "user-1"];
    queryClient.setQueryData(key, {
      status: "success",
      servers: [
        { name: "alpha", player_count: 0, players: [] },
        { name: "beta", player_count: 2, players: [] },
      ],
    });
    expect(synchronizeServerEvent({
      type: "event",
      topic: "event:after_server_players_change",
      data: {
        server_name: "alpha",
        player_count: 1,
        players: [{ name: "Steve", xuid: "123" }],
      },
    })).toBe(true);
    expect(queryClient.getQueryData(key).servers).toEqual([
      { name: "alpha", player_count: 1, players: [{ name: "Steve", xuid: "123" }] },
      { name: "beta", player_count: 2, players: [] },
    ]);
  });

  it("rejects malformed player updates without poisoning cache", () => {
    const key = [...queryKeys.servers(), "user-1"];
    const original = { status: "success", servers: [{ name: "alpha", player_count: 0 }] };
    queryClient.setQueryData(key, original);
    synchronizeServerEvent({
      type: "event",
      topic: "event:after_server_players_change",
      data: { server_name: "alpha", player_count: 1, players: [] },
    });
    expect(queryClient.getQueryData(key)).toEqual(original);
  });

  it("ignores unknown topics", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    expect(synchronizeServerEvent({ type: "event", topic: "plugin:unknown" })).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
    invalidate.mockRestore();
  });
});
