import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";

/**
 * Synchronize validated backend event payloads with the shared server cache.
 * Unknown/incomplete events invalidate instead of overwriting authoritative data.
 */
export function synchronizeServerEvent(message) {
  if (!message || message.type !== "event" || typeof message.topic !== "string") return false;
  const watched = new Set([
    "event:after_server_status_change",
    "event:after_server_start",
    "event:after_server_stop",
    "event:before_server_stop",
    "event:after_delete_server_data",
    "event:after_server_update",
    "event:after_server_install",
    "event:after_server_players_change",
  ]);
  if (!watched.has(message.topic)) return false;

  const data = message.data?.result ?? message.data;
  if (
    message.topic === "event:after_server_players_change" &&
    typeof data?.server_name === "string" &&
    Array.isArray(data.players) &&
    Number.isInteger(data.player_count) &&
    data.player_count === data.players.length &&
    data.players.every((player) => typeof player?.name === "string" && typeof player?.xuid === "string")
  ) {
    queryClient.setQueryData(queryKeys.servers(), (current) => {
      if (!current || !Array.isArray(current.servers)) return current;
      return {
        ...current,
        servers: current.servers.map((server) =>
          server.name === data.server_name
            ? { ...server, players: data.players, player_count: data.player_count }
            : server,
        ),
      };
    });
    queryClient.setQueryData(queryKeys.serverPlayers(data.server_name), (current) =>
      current && typeof current === "object" && !Array.isArray(current)
        ? { ...current, players: data.players, player_count: data.player_count }
        : current,
    );
    return true;
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.servers() });
  return true;
}
