import { describe, it, expect } from "vitest";
import { createRuntimeDiagnostics } from "../../../../packages/runtime/src/runtimeDiagnostics.js";
import {
  createRuntimeHistory,
  RUNTIME_HISTORY_AGE,
} from "../../../src/app/runtimeHistory";
const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";
function fixture(storage = localStorage, session = first) {
  let clock = Date.now();
  const diagnostics = createRuntimeDiagnostics(1500);
  const history = createRuntimeHistory({
    diagnostics,
    storage,
    session,
    now: () => clock,
    schedule: () => 1,
    cancel: () => {},
  });
  return {
    history,
    diagnostics,
    advance: (amount) => {
      clock += amount;
    },
  };
}
describe("frontend runtime history", () => {
  it("keeps paused observations and restores only the chosen account/backend after reload", () => {
    const a = fixture();
    a.history.open("backend-a:alice", true);
    a.diagnostics.setEnabled(true);
    a.diagnostics.record("rejected", { reason: "invalid-task" });
    a.diagnostics.setEnabled(false);
    expect(a.history.getSnapshot().events).toHaveLength(1);
    expect(a.diagnostics.getSnapshot().events).toHaveLength(1);
    a.history.close();
    const b = fixture(localStorage, second);
    b.history.open("backend-a:alice", true);
    expect(b.history.export().events[0].session).toBe("previous");
    b.history.open("backend-b:alice", true);
    expect(b.history.getSnapshot().events).toEqual([]);
    b.history.open("backend-a:bob", true);
    expect(b.history.getSnapshot().events).toEqual([]);
    b.history.open("backend-a:alice", true);
    expect(b.history.getSnapshot().events).toHaveLength(1);
    b.history.clear();
    b.history.close();
    a.history.open("backend-a:alice", true);
    expect(a.history.getSnapshot().events).toEqual([]);
  });
  it("stores only fixed safe labels and no unknown fields or dynamic resource names", () => {
    const { history, diagnostics } = fixture();
    history.open("privacy", true);
    diagnostics.setEnabled(true);
    diagnostics.record("rejected", {
      reason: "invalid-task",
      family: "private-server",
      token: "never-save",
      count: 3,
    });
    diagnostics.record("private-identity", { reason: "private-token" });
    history.flush();
    const data = JSON.stringify(history.export());
    expect(data).toContain("invalid-task");
    expect(data).toContain('"count":3');
    expect(data).not.toMatch(/private|token|never-save/);
    history.close();
  });
  it("bounds retained observations and removes expired entries", () => {
    const { history, diagnostics, advance } = fixture();
    history.open("bounds");
    diagnostics.setEnabled(true);
    for (let i = 0; i < 1100; i++)
      diagnostics.record("compacted", { count: i });
    expect(history.getSnapshot().events).toHaveLength(1000);
    expect(history.getSnapshot().events[0].count).toBe(100);
    advance(RUNTIME_HISTORY_AGE + 60000);
    history.prune();
    expect(history.getSnapshot().events).toEqual([]);
    history.close();
  });
  it("disables persistence without erasing the in-memory history", () => {
    const { history, diagnostics } = fixture();
    history.open("remove-copy", true);
    diagnostics.setEnabled(true);
    diagnostics.record("refresh");
    history.flush();
    history.setPersistent(false);
    expect(history.getSnapshot().events).toHaveLength(1);
    const after = fixture(localStorage, second);
    after.history.open("remove-copy", true);
    expect(after.history.getSnapshot().events).toEqual([]);
    history.close();
    after.history.close();
  });
  it("continues in memory when storage fails and isolates invalid saved data", () => {
    const blocked = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    const { history, diagnostics } = fixture(blocked);
    history.open("blocked", true);
    diagnostics.setEnabled(true);
    diagnostics.record("refresh");
    history.flush();
    expect(history.getSnapshot().persistence).toBe("unavailable");
    expect(history.getSnapshot().events).toHaveLength(1);
    history.close();
    const bad = fixture({
      getItem: () =>
        '{"version":1,"events":[null,{"type":"rejected","at":1,"session":"private-name"}]}',
      setItem() {},
      removeItem() {},
    });
    bad.history.open("corrupt", true);
    expect(bad.history.getSnapshot().events).toEqual([]);
    bad.history.close();
  });
});
