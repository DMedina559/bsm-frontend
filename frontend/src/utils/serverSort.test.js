import { it, expect } from "vitest";
import { sortServers } from "./serverSort";
const servers = [
  { name: "Server 10", status: "stopped", version: "1.9.0", player_count: 0 },
  { name: "Server 2", status: "running", version: "1.21.0", player_count: 8 },
  { name: "Alpha", status: null, version: null, player_count: null },
];
it("sorts names naturally without mutating fleet data", () => {
  expect(sortServers(servers).map((s) => s.name)).toEqual([
    "Alpha",
    "Server 2",
    "Server 10",
  ]);
  expect(servers[0].name).toBe("Server 10");
});
it("sorts versions numerically and leaves unknown versions last", () => {
  expect(sortServers(servers, "version", "desc").map((s) => s.name)).toEqual([
    "Server 2",
    "Server 10",
    "Alpha",
  ]);
  expect(sortServers(servers, "version", "asc")[0].name).toBe("Server 10");
});
it("sorts player counts numerically and leaves unknown counts last", () => {
  expect(sortServers(servers, "players", "desc").map((s) => s.name)).toEqual([
    "Server 2",
    "Server 10",
    "Alpha",
  ]);
});
it("sorts known statuses before unknown statuses", () => {
  expect(sortServers(servers, "status").map((s) => s.name)).toEqual([
    "Server 2",
    "Server 10",
    "Alpha",
  ]);
});
