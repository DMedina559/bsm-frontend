import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";

import { stateReconciler } from "./stateReconciler";
import { operationCoordinator } from "./operationCoordinator";
import { resourceInvalidation } from "./queryKeys";

stateReconciler.onEpochChange(() => {
  operationCoordinator.clear();
  // Reset cached data as well as watermarks; mounted queries refetch immediately.
  void queryClient.resetQueries();
});

export const captureStateRequest = (signal) => stateReconciler.capture(signal);
const validProcessInfo = (info) =>
  info === null ||
  (info &&
    typeof info === "object" &&
    !Array.isArray(info) &&
    Number.isInteger(info.pid) &&
    Number.isFinite(info.cpu_percent) &&
    Number.isFinite(info.memory_mb) &&
    typeof info.uptime === "string");
export function reconcileMonitorSnapshot(data, name, ticket) {
  if (!validProcessInfo(data?.process_info))
    throw new Error("Invalid monitor response");
  return stateReconciler.accept(["monitor", name], data, {
    source: "http",
    ticket,
  }).value;
}
export function reconcileServerSnapshot(data, ticket) {
  const selected = stateReconciler.accept(["fleet"], data, {
    source: "http",
    ticket,
  });
  if (selected.accepted)
    for (const server of data.servers) {
      const options = {
        source: "http",
        ticket,
        revision: server.revision ?? data.revision,
        epoch: server.epoch ?? data.epoch,
      };
      stateReconciler.accept(["membership", server.name], true, options);
      if (typeof server.status === "string")
        stateReconciler.accept(
          ["status", server.name],
          { status: server.status },
          options,
        );
      if (
        Array.isArray(server.players) &&
        Number.isInteger(server.player_count) &&
        server.players.length === server.player_count
      )
        stateReconciler.accept(
          ["players", server.name],
          { players: server.players, player_count: server.player_count },
          options,
        );
    }
  return rebaseFleet(selected.value, selected.requestClock);
}
function rebaseFleet(data, requestClock) {
  return {
    ...data,
    servers: data.servers
      .filter((server) => {
        const membership = stateReconciler.read(["membership", server.name]);
        return !(
          membership?.clock > requestClock && membership.value === false
        );
      })
      .map((server) => {
        let next = server;
        for (const field of ["players", "status"]) {
          const update = stateReconciler.read([field, server.name]);
          if (update && update.clock > requestClock)
            next = { ...next, ...update.value };
        }
        return next;
      }),
  };
}
/** All shared resource reads enter here before React Query publishes a result. */
export function reconcileResourceSnapshot(resource, target, key, data, ticket) {
  if (resource === "monitor")
    return reconcileMonitorSnapshot(data, target, ticket);
  const selected = stateReconciler.accept(["query", key], data, {
    source: "http",
    ticket,
  }).value;
  if (resource === "tasks" && Array.isArray(selected)) {
    const tasks = selected.map(
      (task) =>
        stateReconciler.task(task, { source: "http", ticket }).value ?? task,
    );
    const known = new Set(tasks.map((task) => task.id ?? task.task_id));
    for (const record of stateReconciler.entries("task"))
      if (
        record.source === "event" &&
        record.clock > ticket.clock &&
        !known.has(record.value.id ?? record.value.task_id)
      )
        tasks.push(record.value);
    return tasks;
  }
  return selected;
}
const updateFleet = (name, patch, remove = false) => {
  queryClient.setQueriesData(
    resourceInvalidation(queryKeys.servers()),
    (current) =>
      !Array.isArray(current?.servers)
        ? current
        : {
            ...current,
            servers: current.servers
              .filter((server) => !remove || server.name !== name)
              .map((server) =>
                server.name === name ? { ...server, ...patch } : server,
              ),
          },
  );
};
const refreshFleet = () => {
  const ticket = captureStateRequest();
  void queryClient
    .cancelQueries(resourceInvalidation(queryKeys.servers()))
    .then(() => {
      if (!stateReconciler.current(ticket)) return;
      // Cancellation reverts React Query to its pre-request snapshot. Restore
      // accepted socket patches before asking for a fresh authoritative read.
      queryClient.setQueriesData(
        resourceInvalidation(queryKeys.servers()),
        (data) =>
          Array.isArray(data?.servers)
            ? rebaseFleet(
                data,
                stateReconciler.read(["fleet"])?.requestClock ?? 0,
              )
            : data,
      );
      return queryClient.invalidateQueries(
        resourceInvalidation(queryKeys.servers()),
      );
    });
};

/**
 * Synchronize validated backend event payloads with the shared server cache.
 * Unknown/incomplete events invalidate instead of overwriting authoritative data.
 */
export function synchronizeServerEvent(message, ticket) {
  if (!stateReconciler.current(ticket)) return false;
  if (
    message?.type === "resource_update" &&
    typeof message.topic === "string" &&
    message.topic.startsWith("resource-monitor:")
  ) {
    const name = message.topic.slice("resource-monitor:".length);
    const info = message.data?.process_info;
    const membership = stateReconciler.read(["membership", name]);
    const incomingEpoch = message.epoch ?? message.data?.epoch;
    if (
      !name ||
      !validProcessInfo(info) ||
      (membership?.value === false &&
        (!incomingEpoch || membership.epoch === incomingEpoch))
    )
      return false;
    const accepted = stateReconciler.accept(["monitor", name], message.data, {
      ticket,
      revision: message.revision ?? message.data?.revision,
      epoch: message.epoch ?? message.data?.epoch,
      eventId: message.event_id,
    });
    if (!accepted.accepted) return false;
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
    const patch = { players: data.players, player_count: data.player_count };
    if (
      !stateReconciler.accept(["players", data.server_name], patch, {
        ticket,
        revision: message.revision ?? data.revision,
        epoch: message.epoch ?? data.epoch,
        eventId: message.event_id,
      }).accepted
    )
      return false;
    updateFleet(data.server_name, patch);
    queryClient.setQueriesData(
      { queryKey: queryKeys.serverPlayers(data.server_name) },
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
  if (message.topic === "event:after_server_players_change") {
    refreshFleet();
    return false;
  }
  if (
    typeof data?.server_name !== "string" ||
    !data.server_name ||
    (message.topic === "event:after_server_status_change" &&
      (data.status !== "success" ||
        typeof data.new_status !== "string" ||
        !data.new_status.trim())) ||
    (message.topic === "event:after_server_start" &&
      data.status === "success" &&
      !["started", "already_running"].includes(data.outcome)) ||
    (message.topic === "event:after_server_stop" &&
      data.status === "success" &&
      !["stopped", "already_stopped"].includes(data.outcome))
  ) {
    refreshFleet();
    return false;
  }
  if (
    !stateReconciler.accept(
      ["event", message.topic, data?.server_name ?? ""],
      data,
      {
        ticket,
        revision: message.revision ?? data?.revision,
        epoch: message.epoch ?? data?.epoch,
        eventId: message.event_id,
      },
    ).accepted
  )
    return false;
  const name = data?.server_name;
  if (typeof name === "string" && data.status === "success") {
    const status =
      message.topic === "event:after_server_status_change"
        ? data.new_status
        : message.topic === "event:after_server_start" &&
            ["started", "already_running"].includes(data.outcome)
          ? "RUNNING"
          : message.topic === "event:after_server_stop" &&
              ["stopped", "already_stopped"].includes(data.outcome)
            ? "STOPPED"
            : null;
    if (typeof status === "string") {
      const patch = { status };
      if (
        !stateReconciler.accept(["status", name], patch, {
          ticket,
          revision: message.revision ?? data.revision,
          epoch: message.epoch ?? data.epoch,
        }).accepted
      )
        return false;
      updateFleet(name, patch);
    }
    if (
      message.topic === "event:after_server_stop" &&
      ["stopped", "already_stopped"].includes(data.outcome)
    ) {
      const stopped = { status: "success", process_info: null };
      stateReconciler.accept(["monitor", name], stopped, {
        ticket,
        epoch: message.epoch ?? data.epoch,
        revision: message.revision ?? data.revision,
      });
      queryClient.setQueriesData(
        { queryKey: queryKeys.serverMonitor(name) },
        (current) => (current ? stopped : current),
      );
    }
    if (message.topic === "event:after_delete_server_data") {
      if (
        !stateReconciler.accept(["membership", name], false, {
          ticket,
          revision: message.revision ?? data.revision,
          epoch: message.epoch ?? data.epoch,
        }).accepted
      )
        return false;
      updateFleet(name, {}, true);
      queryClient.removeQueries({ queryKey: queryKeys.server(name) });
      queryClient.removeQueries({ queryKey: queryKeys.serverMonitor(name) });
      stateReconciler.forget(["monitor", name]);
    }
    if (message.topic === "event:after_server_install") {
      if (
        !stateReconciler.accept(["membership", name], true, {
          ticket,
          revision: message.revision ?? data.revision,
          epoch: message.epoch ?? data.epoch,
        }).accepted
      )
        return false;
      stateReconciler.forget(["players", name]);
      stateReconciler.forget(["status", name]);
    }
    if (
      ["event:after_server_install", "event:after_server_update"].includes(
        message.topic,
      )
    )
      void queryClient.invalidateQueries({ queryKey: queryKeys.server(name) });
    if (message.topic !== "event:after_delete_server_data")
      void queryClient.invalidateQueries({
        queryKey: queryKeys.serverMonitor(name),
      });
  }
  refreshFleet();
  return true;
}

/** Socket consumers only receive state frames accepted by the director. */
export function reconcileSocketMessage(message, ticket) {
  if (!stateReconciler.current(ticket)) return false;
  if (message?.type === "task_update") {
    const accepted = stateReconciler.task(message.data, {
      ticket,
      revision: message.data?.revision ?? message.revision,
      epoch: message.data?.epoch ?? message.epoch,
      eventId: message.event_id,
    });
    if (!accepted.accepted) return false;
    publishTaskSnapshot(message, accepted.value);
    return true;
  }
  if (
    message?.type === "resource_update" &&
    message.topic?.startsWith("resource-monitor:")
  )
    return synchronizeServerEvent(message, ticket);
  if (
    message?.type === "event" &&
    /^event:(after_server_|before_server_stop|after_delete_server_data)/.test(
      message.topic ?? "",
    )
  ) {
    // Plugin events outside the shared resource set still reach plugin listeners.
    const watched = [
      "after_server_status_change",
      "after_server_start",
      "after_server_stop",
      "before_server_stop",
      "after_delete_server_data",
      "after_server_update",
      "after_server_install",
      "after_server_players_change",
    ];
    if (watched.some((topic) => message.topic === `event:${topic}`))
      return synchronizeServerEvent(message, ticket);
  }
  return true;
}

function publishTaskSnapshot(message, snapshot) {
  operationCoordinator.reconcileTask(message, { synchronize: true });
  const id = snapshot.id ?? snapshot.task_id;
  queryClient.setQueriesData(
    {
      queryKey: queryKeys.tasks(),
      predicate: (query) =>
        query.queryKey.length <= 2 && Array.isArray(query.state.data),
    },
    (tasks) => {
      if (!tasks) return tasks;
      // "unknown" is frontend recovery state, not a backend TaskSnapshot.
      if (snapshot.status === "unknown")
        return tasks.filter((task) => task.id !== id);
      return tasks.some((task) => task.id === id)
        ? tasks.map((task) => (task.id === id ? snapshot : task))
        : [...tasks, snapshot];
    },
  );
}
export function reconcileTaskResponse(data, ticket) {
  const result = stateReconciler.task(data, { source: "http", ticket });
  if (result.value)
    publishTaskSnapshot(
      { type: "task_update", data: result.value },
      result.value,
    );
  return result.accepted;
}
