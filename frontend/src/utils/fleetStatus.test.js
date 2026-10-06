import { test } from "vitest";
import assert from "node:assert/strict";
import { summarizeFleet } from "./fleetStatus.js";
test("counts case-insensitive statuses without treating transitional states as running", () => {
  assert.deepEqual(
    summarizeFleet([
      { status: "RUNNING", player_count: 5 },
      { status: "stopped", player_count: 0 },
      { status: "starting", player_count: 0 },
    ]),
    { running: 1, stopped: 1, playersKnown: true, players: 5 },
  );
});
test("missing or invalid counts remain unknown rather than claiming zero players", () => {
  for (const player_count of [undefined, null, "5", -1, NaN])
    assert.equal(
      summarizeFleet([{ status: "running", player_count }]).players,
      null,
    );
});
test("empty fleet has zero counts", () => {
  assert.deepEqual(summarizeFleet([]), {
    running: 0,
    stopped: 0,
    playersKnown: true,
    players: 0,
  });
});
