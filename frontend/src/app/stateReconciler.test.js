import { beforeEach, expect, it, vi } from "vitest";
import { createStateReconciler } from "./stateReconciler";
let state;
beforeEach(() => {
  state = createStateReconciler();
});
it("keeps the later HTTP request when overlapping responses arrive backwards", () => {
  const older = state.capture(),
    newer = state.capture();
  state.accept(
    ["settings"],
    { value: "new" },
    { source: "http", ticket: newer },
  );
  expect(
    state.accept(
      ["settings"],
      { value: "old" },
      { source: "http", ticket: older },
    ),
  ).toMatchObject({ accepted: false, value: { value: "new" } });
});
it("uses comparable backend revisions across transports and retains the watermark", () => {
  const ticket = state.capture();
  state.accept(["monitor"], { epoch: "instance", revision: 3, value: "event" });
  expect(
    state.accept(
      ["monitor"],
      { epoch: "instance", revision: 4, value: "http" },
      { source: "http", ticket },
    ).accepted,
  ).toBe(true);
  expect(
    state.accept(["monitor"], {
      epoch: "instance",
      revision: 3,
      value: "old event",
    }).accepted,
  ).toBe(false);
  state.accept(
    ["monitor"],
    { value: "fresh HTTP" },
    { source: "http", ticket: state.capture() },
  );
  expect(
    state.accept(["monitor"], {
      epoch: "instance",
      revision: 2,
      value: "replay",
    }).accepted,
  ).toBe(false);
});
it("deduplicates events per resource and keeps metadata bounded", () => {
  state.accept(["monitor", "a"], 1, { eventId: "one" });
  expect(state.accept(["monitor", "a"], 2, { eventId: "one" }).accepted).toBe(
    false,
  );
  expect(state.accept(["monitor", "b"], 2, { eventId: "one" }).accepted).toBe(
    true,
  );
  for (let i = 0; i < 1200; i++) state.accept(["query", String(i)], i);
  expect(state.entries("query")).toHaveLength(1000);
});
it("prevents task regression and malformed frames poisoning revisions", () => {
  state.task({ id: "task", status: "running", epoch: "instance", revision: 2 });
  expect(
    state.task({
      id: "task",
      status: "invalid",
      epoch: "instance",
      revision: 99,
    }).accepted,
  ).toBe(false);
  expect(
    state.task({ id: "task", status: "queued", epoch: "instance", revision: 3 })
      .accepted,
  ).toBe(false);
  expect(
    state.task({
      id: "task",
      status: "completed",
      epoch: "instance",
      revision: 3,
    }).accepted,
  ).toBe(true);
  expect(state.task({ id: "task", status: "failed" }).accepted).toBe(false);
});
it("rejects responses and socket frames after changing the configured backend", () => {
  const ticket = state.capture();
  const previous = localStorage.getItem("api_base_url");
  try {
    localStorage.setItem("api_base_url", "https://other.example/ingress");
    expect(() =>
      state.accept(["settings"], {}, { source: "http", ticket }),
    ).toThrow("Session changed");
    expect(state.accept(["settings"], {}, { ticket }).accepted).toBe(false);
  } finally {
    if (previous === null) localStorage.removeItem("api_base_url");
    else localStorage.setItem("api_base_url", previous);
  }
});
it("accepts lower revisions after a restart and rejects retired HTTP and socket work", () => {
  const firstSocket = state.capture();
  state.accept(
    ["monitor"],
    { epoch: "first", revision: 100 },
    { ticket: firstSocket },
  );
  const oldRequest = state.capture();
  const nextSocket = state.capture();
  expect(
    state.accept(
      ["monitor"],
      { epoch: "next", revision: 1 },
      { ticket: nextSocket },
    ).accepted,
  ).toBe(true);
  expect(state.current(firstSocket)).toBe(false);
  expect(
    state.accept(
      ["monitor"],
      { epoch: "first", revision: 101 },
      { ticket: firstSocket },
    ).accepted,
  ).toBe(false);
  expect(() =>
    state.accept(
      ["monitor"],
      { epoch: "first", revision: 102 },
      { source: "http", ticket: oldRequest },
    ),
  ).toThrow("Session changed");
  expect(
    state.accept(
      ["monitor"],
      { epoch: "next", revision: 2 },
      { ticket: nextSocket },
    ).accepted,
  ).toBe(true);
  expect(
    state.accept(
      ["monitor"],
      { epoch: "first", revision: 999 },
      { ticket: state.capture() },
    ).accepted,
  ).toBe(false);
});
it("does not let an established socket switch to an unseen epoch", () => {
  const socket = state.capture();
  state.accept(
    ["monitor"],
    { epoch: "first", revision: 1 },
    { ticket: socket },
  );
  expect(
    state.accept(
      ["monitor"],
      { epoch: "other", revision: 2 },
      { ticket: socket },
    ).accepted,
  ).toBe(false);
  expect(state.read(["monitor"]).epoch).toBe("first");
});
it("clears task transitions and event deduplication across epochs", () => {
  state.task(
    { id: "task", status: "completed", epoch: "first", revision: 100 },
    { eventId: "reused" },
  );
  expect(
    state.task(
      { id: "task", status: "running", epoch: "next", revision: 1 },
      { eventId: "reused" },
    ).accepted,
  ).toBe(true);
});
it("ignores malformed epoch metadata without clearing accepted state", () => {
  state.accept(["monitor"], { epoch: "first", revision: 2 });
  expect(
    state.accept(["monitor"], { epoch: "next", revision: -1 }).accepted,
  ).toBe(false);
  expect(state.read(["monitor"]).epoch).toBe("first");
});
it("preserves resource watermarks and terminal tasks through query cache churn", () => {
  state.accept(["monitor", "alpha"], { epoch: "instance", revision: 100 });
  state.task({
    id: "finished",
    status: "completed",
    epoch: "instance",
    revision: 100,
  });
  for (let i = 0; i < 1500; i++) state.accept(["query", i], i);
  expect(
    state.accept(["monitor", "alpha"], { epoch: "instance", revision: 1 })
      .accepted,
  ).toBe(false);
  expect(
    state.task({
      id: "finished",
      status: "running",
      epoch: "instance",
      revision: 1,
    }).accepted,
  ).toBe(false);
});
it("continues epoch cleanup after a listener throws", async () => {
  const engine = createStateReconciler();
  const error = vi
    .spyOn((await import("../utils/logger")).logger, "error")
    .mockImplementation(() => {});
  const cleanup = vi.fn();
  engine.onEpochChange(() => {
    throw new Error("broken cleanup");
  });
  engine.onEpochChange(cleanup);
  engine.accept(["test"], { epoch: "first", revision: 1 });
  expect(
    engine.accept(["test"], { epoch: "second", revision: 1 }).accepted,
  ).toBe(true);
  expect(cleanup).toHaveBeenCalledOnce();
  error.mockRestore();
});
it("releases terminal payloads while preserving ordering safeguards", () => {
  const engine = createStateReconciler();
  engine.task({
    id: "large",
    status: "completed",
    epoch: "instance",
    revision: 10,
    result: { huge: "payload" },
  });
  engine.releaseTaskPayload("large");
  expect(engine.read(["task", "large"]).value.result).toBeNull();
  expect(
    engine.task({
      id: "large",
      status: "running",
      epoch: "instance",
      revision: 9,
    }).accepted,
  ).toBe(false);
});

it("rejects partial metadata and unstamped replacements of revisioned state", () => {
  for (const data of [
    { revision: 1 },
    { epoch: "instance" },
    { epoch: " ", revision: 1 },
  ]) {
    expect(state.accept(["resource"], data).accepted).toBe(false);
    expect(() => state.accept(["resource"], data, { source: "http" })).toThrow(
      "Invalid backend state revision",
    );
  }
  state.accept(["resource"], {
    epoch: "instance",
    revision: 1,
    value: "current",
  });
  expect(state.accept(["resource"], { value: "legacy" }).accepted).toBe(false);
  expect(state.read(["resource"]).value.value).toBe("current");
});
it("reloads released outcomes only from matching full HTTP snapshots", () => {
  const task = {
    id: "reload",
    status: "failed",
    epoch: "instance",
    revision: 5,
    message: "Failed",
    result: null,
    error: { message: "Failed", details: { reason: "missing" } },
  };
  state.task(task);
  state.releaseTaskPayload(task.id);
  expect(state.task(task).accepted).toBe(false);
  expect(
    state.task({ ...task, status: "completed" }, { source: "http" }).accepted,
  ).toBe(false);
  expect(
    state.task({ ...task, revision: 4 }, { source: "http" }).accepted,
  ).toBe(false);
  expect(
    state.task(task, { source: "http", ticket: state.capture() }).accepted,
  ).toBe(true);
  expect(state.read(["task", task.id]).value.error.details).toEqual(
    task.error.details,
  );
});
it("bounds terminal payloads without evicting task ordering metadata", () => {
  for (let i = 1; i <= 101; i++)
    state.task({
      id: String(i),
      status: "completed",
      epoch: "instance",
      revision: i,
      message: "Done",
      result: { value: i },
      error: null,
    });
  expect(state.entries("task")).toHaveLength(101);
  expect(state.read(["task", "1"]).value.result).toBeNull();
  expect(state.read(["task", "101"]).value.result).toEqual({ value: 101 });
  expect(
    state.task({ id: "1", status: "running", epoch: "instance", revision: 1 })
      .accepted,
  ).toBe(false);
  expect(
    state.task(
      {
        id: "1",
        status: "completed",
        epoch: "instance",
        revision: 1,
        message: "Done",
        result: { value: 1 },
        error: null,
      },
      { source: "http" },
    ).accepted,
  ).toBe(true);
  expect(state.read(["task", "2"]).value.result).toBeNull();
});
