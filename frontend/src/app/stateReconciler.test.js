import { beforeEach, expect, it } from "vitest";
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
  state.accept(["monitor"], { revision: 3, value: "event" });
  expect(
    state.accept(
      ["monitor"],
      { revision: 4, value: "http" },
      { source: "http", ticket },
    ).accepted,
  ).toBe(true);
  expect(
    state.accept(["monitor"], { revision: 3, value: "old event" }).accepted,
  ).toBe(false);
  state.accept(
    ["monitor"],
    { value: "fresh HTTP" },
    { source: "http", ticket: state.capture() },
  );
  expect(
    state.accept(["monitor"], { revision: 2, value: "replay" }).accepted,
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
  for (let i = 0; i < 1200; i++) state.accept(["monitor", String(i)], i);
  expect(state.entries("monitor")).toHaveLength(1000);
});
it("prevents task regression and malformed frames poisoning revisions", () => {
  state.task({ id: "task", status: "running", revision: 2 });
  expect(
    state.task({ id: "task", status: "invalid", revision: 99 }).accepted,
  ).toBe(false);
  expect(
    state.task({ id: "task", status: "queued", revision: 3 }).accepted,
  ).toBe(false);
  expect(
    state.task({ id: "task", status: "completed", revision: 3 }).accepted,
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
