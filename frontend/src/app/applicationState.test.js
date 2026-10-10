import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "./queryClient";
import { stateReconciler } from "./stateReconciler";
import { queryKeys } from "./queryKeys";
import { synchronizeServerEvent } from "./applicationState";

beforeEach(() => {
  queryClient.clear();
  stateReconciler.clear();
});
describe("server WebSocket query synchronization", () => {
  it("updates the matching user-scoped server without touching others", () => {
    const key = [...queryKeys.servers(), { identity: "user-1", generation: 0 }];
    queryClient.setQueryData(key, {
      status: "success",
      servers: [
        { name: "alpha", player_count: 0, players: [] },
        { name: "beta", player_count: 2, players: [] },
      ],
    });
    expect(
      synchronizeServerEvent({
        type: "event",
        topic: "event:after_server_players_change",
        data: {
          server_name: "alpha",
          player_count: 1,
          players: [{ name: "Steve", xuid: "123" }],
        },
      }),
    ).toBe(true);
    expect(queryClient.getQueryData(key).servers).toEqual([
      {
        name: "alpha",
        player_count: 1,
        players: [{ name: "Steve", xuid: "123" }],
      },
      { name: "beta", player_count: 2, players: [] },
    ]);
  });

  it("rejects malformed player updates without poisoning cache", () => {
    const key = [...queryKeys.servers(), { identity: "user-1", generation: 0 }];
    const original = {
      status: "success",
      servers: [{ name: "alpha", player_count: 0 }],
    };
    queryClient.setQueryData(key, original);
    synchronizeServerEvent({
      type: "event",
      topic: "event:after_server_players_change",
      data: { server_name: "alpha", player_count: 1, players: [] },
    });
    expect(queryClient.getQueryData(key)).toEqual(original);
  });

  it("invalidates server queries after lifecycle changes", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    expect(
      synchronizeServerEvent({
        type: "event",
        topic: "event:after_server_stop",
        data: { server_name: "alpha" },
      }),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.servers() }),
      ),
    );
    invalidate.mockRestore();
  });

  it("ignores unknown topics", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    expect(
      synchronizeServerEvent({ type: "event", topic: "plugin:unknown" }),
    ).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
    invalidate.mockRestore();
  });
});

it("uses backend revisions to reject reordered player snapshots", () => {
  queryClient.setQueryData(
    ["servers", { identity: "ordered", generation: 0 }],
    {
      servers: [{ name: "Ordered", players: [] }],
    },
  );
  const frame = (revision, name) => ({
    type: "event",
    topic: "event:after_server_players_change",
    revision,
    data: {
      server_name: "Ordered",
      players: [{ name, xuid: "1" }],
      player_count: 1,
    },
  });
  expect(synchronizeServerEvent(frame(2, "New"))).toBe(true);
  expect(synchronizeServerEvent(frame(1, "Old"))).toBe(false);
  expect(
    queryClient.getQueryData([
      "servers",
      { identity: "ordered", generation: 0 },
    ]).servers[0].players[0].name,
  ).toBe("New");
});

it("rebases a delayed fleet response on newer player and lifecycle events", async () => {
  const { captureStateRequest, reconcileServerSnapshot } =
    await import("./applicationState");
  const ticket = captureStateRequest();
  synchronizeServerEvent({
    type: "event",
    topic: "event:after_server_players_change",
    data: {
      server_name: "alpha",
      player_count: 1,
      players: [{ name: "Steve", xuid: "1" }],
    },
  });
  synchronizeServerEvent({
    type: "event",
    topic: "event:after_server_start",
    data: { server_name: "alpha", status: "success", outcome: "started" },
  });
  const result = reconcileServerSnapshot(
    {
      servers: [
        { name: "alpha", status: "STOPPED", player_count: 0 },
        { name: "beta", status: "STOPPED" },
      ],
    },
    ticket,
  );
  expect(result.servers[0]).toMatchObject({
    status: "RUNNING",
    player_count: 1,
  });
  expect(result.servers[1].status).toBe("STOPPED");
});

it("rejects older monitor revisions and rebases in-flight HTTP before consumers see them", async () => {
  const {
    captureStateRequest,
    reconcileMonitorSnapshot,
    reconcileSocketMessage,
  } = await import("./applicationState");
  const key = [
    ...queryKeys.serverMonitor("alpha"),
    { identity: "user", generation: 0 },
  ];
  queryClient.setQueryData(key, {
    process_info: { pid: 1, cpu_percent: 0, memory_mb: 100, uptime: "1s" },
  });
  const ticket = captureStateRequest();
  const frame = (revision, cpu) => ({
    type: "resource_update",
    topic: "resource-monitor:alpha",
    revision,
    data: {
      process_info: { pid: 1, cpu_percent: cpu, memory_mb: 100, uptime: "1s" },
    },
  });
  expect(reconcileSocketMessage(frame(4, 40))).toBe(true);
  expect(reconcileSocketMessage(frame(3, 10))).toBe(false);
  expect(queryClient.getQueryData(key).process_info.cpu_percent).toBe(40);
  expect(
    reconcileMonitorSnapshot(
      {
        process_info: { pid: 1, cpu_percent: 5, memory_mb: 100, uptime: "1s" },
      },
      "alpha",
      ticket,
    ).process_info.cpu_percent,
  ).toBe(40);
  // A new HTTP request after the last event is a fresh observation.
  expect(
    reconcileMonitorSnapshot(
      { process_info: null },
      "alpha",
      captureStateRequest(),
    ).process_info,
  ).toBeNull();
});

it("keeps completion authoritative across task lists, polls and operation tracking", async () => {
  const {
    captureStateRequest,
    reconcileSocketMessage,
    reconcileTaskResponse,
    reconcileResourceSnapshot,
  } = await import("./applicationState");
  const { operationCoordinator } = await import("./operationCoordinator");
  operationCoordinator.clear();
  const key = [...queryKeys.tasks(), { identity: "user", generation: 0 }];
  queryClient.setQueryData(key, [{ id: "work", status: "running" }]);
  operationCoordinator.register({
    id: "work",
    kind: "backup",
    serverName: "alpha",
  });
  const ticket = captureStateRequest();
  expect(
    reconcileSocketMessage({
      type: "task_update",
      data: { id: "work", status: "completed" },
    }),
  ).toBe(true);
  expect(reconcileTaskResponse({ id: "work", status: "running" }, ticket)).toBe(
    false,
  );
  expect(operationCoordinator.get("work").status).toBe("completed");
  expect(queryClient.getQueryData(key)[0].status).toBe("completed");
  const list = reconcileResourceSnapshot(
    "tasks",
    null,
    key,
    [{ id: "work", status: "running" }],
    ticket,
  );
  expect(list[0].status).toBe("completed");
  expect(
    reconcileSocketMessage({
      type: "task_update",
      data: { id: "work", status: "failed" },
    }),
  ).toBe(false);
  operationCoordinator.clear();
});

it("preserves new socket tasks missing from an in-flight list", async () => {
  const {
    captureStateRequest,
    reconcileSocketMessage,
    reconcileResourceSnapshot,
  } = await import("./applicationState");
  const ticket = captureStateRequest();
  reconcileSocketMessage({
    type: "task_update",
    data: { id: "new", status: "running" },
  });
  expect(
    reconcileResourceSnapshot("tasks", null, queryKeys.tasks(), [], ticket),
  ).toEqual([{ id: "new", status: "running" }]);
});

it("does not resurrect a deleted server from an in-flight fleet response", async () => {
  const { captureStateRequest, reconcileServerSnapshot } =
    await import("./applicationState");
  const ticket = captureStateRequest();
  synchronizeServerEvent({
    type: "event",
    topic: "event:after_delete_server_data",
    data: { server_name: "alpha", status: "success" },
  });
  expect(
    reconcileServerSnapshot(
      { servers: [{ name: "alpha" }, { name: "beta" }] },
      ticket,
    ).servers,
  ).toEqual([{ name: "beta" }]);
});

it("rejects old session snapshots before cache publication", async () => {
  const {
    captureStateRequest,
    reconcileServerSnapshot,
    reconcileSocketMessage,
  } = await import("./applicationState");
  const { sessionRuntime } = await import("./sessionRuntime");
  const ticket = captureStateRequest();
  sessionRuntime.reset();
  expect(() =>
    reconcileServerSnapshot({ servers: [{ name: "old" }] }, ticket),
  ).toThrow("Session changed");
  expect(
    reconcileSocketMessage(
      {
        type: "resource_update",
        topic: "resource-monitor:alpha",
        data: { process_info: null },
      },
      ticket,
    ),
  ).toBe(false);
});

it("keeps accepted lifecycle patches visible when cancelling an older fleet fetch", async () => {
  const key = [...queryKeys.servers(), { identity: "user", generation: 0 }];
  queryClient.setQueryData(key, {
    servers: [{ name: "alpha", status: "STOPPED" }],
  });
  const pending = queryClient
    .fetchQuery({
      queryKey: key,
      staleTime: 0,
      queryFn: () => new Promise(() => {}),
    })
    .catch(() => {});
  synchronizeServerEvent({
    type: "event",
    topic: "event:after_server_start",
    data: { server_name: "alpha", status: "success", outcome: "started" },
  });
  await pending;
  await vi.waitFor(() =>
    expect(queryClient.getQueryData(key).servers[0].status).toBe("RUNNING"),
  );
});

it("retains terminal task ordering after its operation notification is dismissed", async () => {
  const { reconcileSocketMessage } = await import("./applicationState");
  const { operationCoordinator } = await import("./operationCoordinator");
  operationCoordinator.register({ id: "dismissed", kind: "backup" });
  reconcileSocketMessage({
    type: "task_update",
    data: { id: "dismissed", status: "completed" },
  });
  operationCoordinator.remove("dismissed");
  expect(
    reconcileSocketMessage({
      type: "task_update",
      data: { id: "dismissed", status: "queued" },
    }),
  ).toBe(false);
});

it("compares shared backend revisions across fleet HTTP and lifecycle events", async () => {
  const {
    captureStateRequest,
    reconcileServerSnapshot,
    reconcileSocketMessage,
  } = await import("./applicationState");
  const key = [...queryKeys.servers(), { identity: "user", generation: 0 }];
  queryClient.setQueryData(
    key,
    reconcileServerSnapshot(
      { revision: 5, servers: [{ name: "alpha", status: "RUNNING" }] },
      captureStateRequest(),
    ),
  );
  expect(
    reconcileSocketMessage({
      type: "event",
      topic: "event:after_server_status_change",
      revision: 4,
      data: { server_name: "alpha", status: "success", new_status: "STOPPED" },
    }),
  ).toBe(false);
  expect(queryClient.getQueryData(key).servers[0].status).toBe("RUNNING");
  const ticket = captureStateRequest();
  synchronizeServerEvent({
    type: "event",
    topic: "event:after_server_status_change",
    revision: 6,
    data: { server_name: "alpha", status: "success", new_status: "STOPPED" },
  });
  expect(
    reconcileServerSnapshot(
      { revision: 7, servers: [{ name: "alpha", status: "RUNNING" }] },
      ticket,
    ).servers[0].status,
  ).toBe("RUNNING");
});

it("does not let malformed lifecycle frames poison revision watermarks", async () => {
  const { reconcileSocketMessage } = await import("./applicationState");
  const frame = (revision, status) => ({
    type: "event",
    topic: "event:after_server_status_change",
    revision,
    data: { server_name: "alpha", status: "success", new_status: status },
  });
  expect(reconcileSocketMessage(frame(99, {}))).toBe(false);
  expect(reconcileSocketMessage(frame(1, "RUNNING"))).toBe(true);
});
it("rejects cancelled HTTP work before reconciliation can change its watermarks", async () => {
  const { captureStateRequest, reconcileServerSnapshot } =
    await import("./applicationState");
  const controller = new AbortController();
  const ticket = captureStateRequest(controller.signal);
  controller.abort();
  expect(() =>
    reconcileServerSnapshot({ servers: [{ name: "old" }] }, ticket),
  ).toThrow("Session changed");
  expect(stateReconciler.read(["fleet"])).toBeUndefined();
});
it("rejects malformed monitor data without advancing its revision", async () => {
  const { reconcileSocketMessage } = await import("./applicationState");
  const frame = (revision, process_info) => ({
    type: "resource_update",
    topic: "resource-monitor:alpha",
    revision,
    data: { process_info },
  });
  expect(reconcileSocketMessage(frame(99, { cpu_percent: "invalid" }))).toBe(
    false,
  );
  expect(reconcileSocketMessage(frame(1, null))).toBe(true);
});
it("evicts deleted server resources and rejects their late monitor frames", async () => {
  const { reconcileSocketMessage } = await import("./applicationState");
  const scope = { identity: "user", generation: 0 };
  queryClient.setQueryData([...queryKeys.serverProperties("alpha"), scope], {
    properties: { name: "old" },
  });
  queryClient.setQueryData([...queryKeys.serverMonitor("alpha"), scope], {
    process_info: null,
  });
  reconcileSocketMessage({
    type: "event",
    topic: "event:after_delete_server_data",
    data: { server_name: "alpha", status: "success" },
  });
  expect(
    queryClient.getQueryData([...queryKeys.serverProperties("alpha"), scope]),
  ).toBeUndefined();
  expect(
    queryClient.getQueryData([...queryKeys.serverMonitor("alpha"), scope]),
  ).toBeUndefined();
  expect(
    reconcileSocketMessage({
      type: "resource_update",
      topic: "resource-monitor:alpha",
      data: { process_info: null },
    }),
  ).toBe(false);
});
it("uses the latest admitted task when delayed bootstrap metadata is attached", async () => {
  const {
    captureStateRequest,
    reconcileSocketMessage,
    reconcileResourceSnapshot,
  } = await import("./applicationState");
  const { operationCoordinator } = await import("./operationCoordinator");
  const list = reconcileResourceSnapshot(
    "tasks",
    null,
    queryKeys.tasks(),
    [{ id: "bootstrap-race", status: "running" }],
    captureStateRequest(),
  );
  reconcileSocketMessage({
    type: "task_update",
    data: { id: "bootstrap-race", status: "completed" },
  });
  operationCoordinator.register({
    id: "bootstrap-race",
    kind: "background",
    status: list[0].status,
  });
  operationCoordinator.reconcileTask(
    { type: "task_update", data: list[0] },
    { synchronize: true },
  );
  expect(operationCoordinator.get("bootstrap-race").status).toBe("completed");
  operationCoordinator.clear();
});
it("reconciles a delayed process snapshot against a completed stop", async () => {
  const { captureStateRequest, reconcileMonitorSnapshot } =
    await import("./applicationState");
  const ticket = captureStateRequest();
  synchronizeServerEvent({
    type: "event",
    topic: "event:after_server_stop",
    data: { server_name: "alpha", status: "success", outcome: "stopped" },
  });
  expect(
    reconcileMonitorSnapshot(
      {
        process_info: { pid: 1, cpu_percent: 1, memory_mb: 100, uptime: "1s" },
      },
      "alpha",
      ticket,
    ).process_info,
  ).toBeNull();
});
it("resets caches and operation state before admitting a restarted backend", async () => {
  const {
    captureStateRequest,
    reconcileMonitorSnapshot,
    reconcileSocketMessage,
  } = await import("./applicationState");
  const { operationCoordinator } = await import("./operationCoordinator");
  const key = [...queryKeys.serverMonitor("alpha"), { identity: "user" }];
  reconcileMonitorSnapshot(
    { epoch: "first", revision: 100, process_info: null },
    "alpha",
    captureStateRequest(),
  );
  queryClient.setQueryData(key, {
    epoch: "first",
    revision: 100,
    process_info: null,
  });
  operationCoordinator.register({ id: "old-task", kind: "backup" });
  const stale = captureStateRequest();
  const next = captureStateRequest();
  expect(
    reconcileSocketMessage(
      {
        type: "resource_update",
        topic: "resource-monitor:alpha",
        data: { epoch: "next", revision: 1, process_info: null },
      },
      next,
    ),
  ).toBe(true);
  expect(queryClient.getQueryData(key)).toBeUndefined();
  expect(operationCoordinator.get("old-task")).toBeNull();
  expect(() =>
    reconcileMonitorSnapshot(
      { epoch: "first", revision: 101, process_info: null },
      "alpha",
      stale,
    ),
  ).toThrow("Session changed");
  expect(stateReconciler.read(["monitor", "alpha"]).epoch).toBe("next");
});
it("does not retain deleted-server tombstones across a restart", async () => {
  const { captureStateRequest, reconcileSocketMessage } =
    await import("./applicationState");
  reconcileSocketMessage(
    {
      type: "event",
      topic: "event:after_delete_server_data",
      epoch: "first",
      revision: 100,
      data: { server_name: "alpha", status: "success" },
    },
    captureStateRequest(),
  );
  expect(
    reconcileSocketMessage(
      {
        type: "resource_update",
        topic: "resource-monitor:alpha",
        data: { epoch: "next", revision: 1, process_info: null },
      },
      captureStateRequest(),
    ),
  ).toBe(true);
});
it("refetches mounted queries when the backend epoch changes", async () => {
  const { QueryObserver } = await import("@tanstack/react-query");
  const {
    captureStateRequest,
    reconcileMonitorSnapshot,
    reconcileSocketMessage,
  } = await import("./applicationState");
  let backend = { epoch: "first", revision: 100, process_info: null };
  const observer = new QueryObserver(queryClient, {
    queryKey: [...queryKeys.serverMonitor("alpha"), { identity: "user" }],
    queryFn: () =>
      reconcileMonitorSnapshot(backend, "alpha", captureStateRequest()),
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data?.epoch).toBe("first"),
    );
    backend = { epoch: "next", revision: 2, process_info: null };
    reconcileSocketMessage(
      {
        type: "resource_update",
        topic: "resource-monitor:alpha",
        data: { epoch: "next", revision: 1, process_info: null },
      },
      captureStateRequest(),
    );
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toMatchObject({
        epoch: "next",
        revision: 2,
      }),
    );
  } finally {
    unsubscribe();
    observer.destroy();
  }
});
it.each([
  ["after_setting_update", ["settings"]],
  ["after_set_server_setting", ["servers", "alpha", "settings"]],
  ["after_properties_change", ["servers", "alpha", "properties"]],
  ["after_addon_enable", ["servers", "alpha", "addons"]],
  ["after_allowlist_change", ["servers", "alpha", "allowlist"]],
  ["after_permission_change", ["servers", "alpha", "permissions"]],
  ["after_add_server_ban", ["servers", "alpha", "bans"]],
  ["after_backup", ["servers", "alpha", "backups"]],
  ["after_restore", ["servers", "alpha"]],
  ["after_world_export", ["content"]],
  ["after_set_plugin_status", ["plugins"]],
  ["after_players_add", ["players"]],
  ["after_prune_download_cache", ["downloads"]],
])("refreshes the resource affected by %s", async (event, key) => {
  const { reconcileSocketMessage } = await import("./applicationState");
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  reconcileSocketMessage({
    type: "event",
    topic: `event:${event}`,
    epoch: "backend",
    revision: 5,
    data: { server_name: "alpha", result: { status: "success" } },
  });
  await vi.waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: key }),
    ),
  );
  expect(
    reconcileSocketMessage({
      type: "event",
      topic: `event:${event}`,
      epoch: "backend",
      revision: 4,
      data: { server_name: "alpha", result: { status: "success" } },
    }),
  ).toBe(false);
  invalidate.mockRestore();
});
it("cancels an older settings read before refreshing after a mutation", async () => {
  const {
    captureStateRequest,
    reconcileResourceSnapshot,
    reconcileSocketMessage,
  } = await import("./applicationState");
  const key = ["settings", { identity: "admin", generation: 0 }];
  queryClient.setQueryData(key, { settings: { value: "cached" } });
  let finish;
  let requestSignal;
  const pending = queryClient
    .fetchQuery({
      queryKey: key,
      staleTime: 0,
      queryFn: async ({ signal }) => {
        requestSignal = signal;
        const ticket = captureStateRequest(signal);
        const response = await new Promise((resolve) => {
          finish = resolve;
        });
        return reconcileResourceSnapshot(
          "settings",
          null,
          key,
          response,
          ticket,
        );
      },
    })
    .catch(() => {});
  reconcileSocketMessage({
    type: "event",
    topic: "event:after_setting_update",
    epoch: "backend",
    revision: 1,
    data: { key: "value", result: { status: "success" } },
  });
  expect(requestSignal.aborted).toBe(true);
  finish({ settings: { value: "obsolete" } });
  await pending;
  await vi.waitFor(() =>
    expect(queryClient.getQueryState(key).isInvalidated).toBe(true),
  );
  expect(queryClient.getQueryData(key).settings.value).toBe("cached");
});
it("forwards plugin frames and skipped mutations without changing core caches", async () => {
  const { reconcileSocketMessage } = await import("./applicationState");
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  expect(
    reconcileSocketMessage({
      type: "broadcast",
      topic: "custom-plugin",
      data: { value: 1 },
    }),
  ).toBe(true);
  expect(
    reconcileSocketMessage({
      type: "event",
      topic: "event:after_backup",
      data: { server_name: "alpha", result: { status: "skipped" } },
    }),
  ).toBe(true);
  expect(invalidate).not.toHaveBeenCalled();
  invalidate.mockRestore();
});

it("retains untracked task outcomes across repeated list reads at the same revision", async () => {
  const { reconcileResourceSnapshot, captureStateRequest } =
    await import("./applicationState");
  const task = {
    id: "viewed-task",
    status: "completed",
    message: "Task completed.",
    result: { message: "Already up to date", updated: false },
    revision: 1,
    epoch: "backend",
  };
  const key = queryKeys.tasks();
  const first = reconcileResourceSnapshot(
    "tasks",
    null,
    key,
    [task],
    captureStateRequest(),
  );
  const second = reconcileResourceSnapshot(
    "tasks",
    null,
    key,
    [task],
    captureStateRequest(),
  );
  expect(first[0].result).toEqual(task.result);
  expect(second[0].result).toEqual(task.result);
  expect(stateReconciler.read(["task", task.id]).value.result).toEqual(
    task.result,
  );
});
it("retains an untracked socket outcome for a later task list read", async () => {
  const {
    reconcileSocketMessage,
    reconcileResourceSnapshot,
    captureStateRequest,
  } = await import("./applicationState");
  const task = {
    id: "socket-outcome",
    status: "completed",
    message: "Done",
    result: { path: "backup.zip" },
    revision: 1,
    epoch: "backend",
  };
  reconcileSocketMessage(
    { type: "task_update", data: task },
    captureStateRequest(),
  );
  const tasks = reconcileResourceSnapshot(
    "tasks",
    null,
    queryKeys.tasks(),
    [task],
    captureStateRequest(),
  );
  expect(tasks[0].result).toEqual(task.result);
});
