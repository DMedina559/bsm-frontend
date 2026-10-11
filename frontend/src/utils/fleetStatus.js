export function summarizeFleet(servers) {
  const running = servers.filter(
    (server) => server.status?.toLowerCase() === "running",
  ).length;
  const stopped = servers.filter(
    (server) => server.status?.toLowerCase() === "stopped",
  ).length;
  const playersKnown = servers.every(
    (server) =>
      Number.isFinite(server.player_count) && server.player_count >= 0,
  );
  const players = playersKnown
    ? servers.reduce((total, server) => total + server.player_count, 0)
    : null;
  return { running, stopped, playersKnown, players };
}
