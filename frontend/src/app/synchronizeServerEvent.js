import { sessionRuntime } from "./sessionRuntime";
import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";

let revision = 0;
const updates = new Map();
const monitorUpdates = new Map();
const seenEvents = new Set();
const backendRevisions = new Map();
export function reconcileMonitorSnapshot(data, name, startedAt) {
  const update = monitorUpdates.get(name);
  return update && update.revision > startedAt
    ? { ...data, process_info: update.info }
    : data;
}
sessionRuntime.onReset(() => {
  revision = 0;
  updates.clear();
  monitorUpdates.clear();
  seenEvents.clear();
  backendRevisions.clear();
});
export const captureServerRevision = () => revision;
export function reconcileServerSnapshot(data, startedAt) {
  return {
    ...data,
    servers: data.servers.map((server) => {
      const update = updates.get(server.name);
      return update && update.revision > startedAt
        ? { ...server, ...update.patch }
        : server;
    }),
  };
}

/**
 * Synchronize validated backend event payloads with the shared server cache.
 * Unknown/incomplete events invalidate instead of overwriting authoritative data.
 */
export function synchronizeServerEvent(message) {
  if (
    message?.type === "resource_update" &&
    typeof message.topic === "string" &&
    message.topic.startsWith("resource-monitor:")
  ) {
    const name = message.topic.slice("resource-monitor:".length);
    const info = message.data?.process_info;
    if (
      !name ||
      (info !== null && (typeof info !== "object" || Array.isArray(info)))
    )
      return false;
    if (info === undefined) return false;
    monitorUpdates.set(name, { revision: ++revision, info });
    queryClient.setQueriesData(
      { queryKey: queryKeys.serverMonitor(name) },
      (current) => (current ? { ...current, process_info: info } : current),
    );
    return true;
  }
  if (!message || message.type !== "event" || typeof message.topic !== "string")
    return false;
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
  const eventId = message.event_id;
  if (typeof eventId === "string" && seenEvents.has(eventId)) return false;
  const revisionKey = `${message.topic}:${data?.server_name ?? ""}`;
  if (Number.isFinite(message.revision)) {
    const previous = backendRevisions.get(revisionKey);
    if (previous !== undefined && message.revision <= previous) return false;
    backendRevisions.set(revisionKey, message.revision);
  }
  if (typeof eventId === "string") {
    seenEvents.add(eventId);
    if (seenEvents.size > 1000)
      seenEvents.delete(seenEvents.values().next().value);
  }
  if (
    message.topic === "event:after_server_players_change" &&
    typeof data?.server_name === "string" &&
    Array.isArray(data.players) &&
    Number.isInteger(data.player_count) &&
    data.player_count === data.players.length &&
    data.players.every(
      (player) =>
        typeof player?.name === "string" && typeof player?.xuid === "string",
    )
  ) {
    updates.set(data.server_name, {
      revision: ++revision,
      patch: { players: data.players, player_count: data.player_count },
    });
    queryClient.setQueriesData({ queryKey: queryKeys.servers() }, (current) => {
      if (!current || !Array.isArray(current.servers)) return current;
      return {
        ...current,
        servers: current.servers.map((server) =>
          server.name === data.server_name
            ? {
                ...server,
                players: data.players,
                player_count: data.player_count,
              }
            : server,
        ),
      };
    });
    queryClient.setQueryData(
      queryKeys.serverPlayers(data.server_name),
      (current) =>
        current && typeof current === "object" && !Array.isArray(current)
          ? {
              ...current,
              players: data.players,
              player_count: data.player_count,
            }
          : current,
    );
    return true;
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.servers() });
  return true;
}
