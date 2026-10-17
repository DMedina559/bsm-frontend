import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useEditableDraft } from "../../../src/app/useEditableDraft";
const confirm = vi.hoisted(() => vi.fn());
const recovery = vi.hoisted(() => ({ enabled: false }));
vi.mock("../../../src/app/usePreference", () => ({
  usePreference: () => [recovery.enabled],
}));
vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin" }, sessionGeneration: 1 }),
}));
vi.mock("../../../src/contexts/DialogContext", () => ({
  useDialog: () => ({ confirmAction: confirm }),
}));
const empty = {};
it("keeps newer edits dirty after a save and ignores background refresh", () => {
  const { result, rerender } = renderHook(
    ({ server, data }) => useEditableDraft(server, data, empty),
    { initialProps: { server: "one", data: { name: "old" } } },
  );
  act(() => result.current.setValue({ name: "submitted" }));
  const complete = result.current.markSaved;
  act(() => result.current.setValue({ name: "newer" }));
  act(() => complete({ name: "submitted" }));
  rerender({ server: "one", data: { name: "submitted" } });
  expect(result.current.value.name).toBe("newer");
  expect(result.current.dirty).toBe(true);
  rerender({ server: "two", data: { name: "two" } });
  act(() => complete({ name: "submitted" }));
  expect(result.current.value.name).toBe("two");
  expect(result.current.dirty).toBe(false);
});
it("requires confirmation to replace a dirty draft", async () => {
  const { result } = renderHook(() => useEditableDraft("one", empty, empty));
  act(() => result.current.setValue({ name: "edit" }));
  const refetch = vi.fn().mockResolvedValue({ data: { name: "backend" } });
  confirm.mockResolvedValueOnce(false);
  await act(async () =>
    expect(await result.current.refresh(refetch)).toBe(false),
  );
  expect(refetch).not.toHaveBeenCalled();
  confirm.mockResolvedValueOnce(true);
  await act(async () => result.current.refresh(refetch));
  expect(result.current.value.name).toBe("backend");
  expect(result.current.dirty).toBe(false);
});
it("reports backend conflicts without replacing edits", () => {
  const { result, rerender } = renderHook(
    ({ data }) => useEditableDraft("one", data, empty),
    { initialProps: { data: { name: "old" } } },
  );
  act(() => result.current.setValue({ name: "edit" }));
  rerender({ data: { name: "other editor" } });
  expect(result.current.conflicted).toBe(true);
  expect(result.current.value.name).toBe("edit");
});
it("does not mistake the cached pre-save value for a remote conflict", () => {
  const { result, rerender } = renderHook(
    ({ data }) => useEditableDraft("saved", data, empty),
    { initialProps: { data: { name: "old" } } },
  );
  act(() => result.current.setValue({ name: "submitted" }));
  const saved = result.current.markSaved;
  act(() => result.current.setValue({ name: "newer" }));
  act(() => saved({ name: "submitted" }));
  rerender({ data: { name: "old" } });
  expect(result.current.conflicted).toBe(false);
  expect(result.current.dirty).toBe(true);
  rerender({ data: { name: "remote" } });
  expect(result.current.conflicted).toBe(true);
});

it("does not acknowledge an old save after the configured backend changes", async () => {
  const { sessionRuntime } = await import("../../../src/app/sessionRuntime");
  const { result } = renderHook(() =>
    useEditableDraft("one", { name: "old" }, empty),
  );
  act(() => result.current.setValue({ name: "submitted" }));
  const saved = result.current.markSaved;
  sessionRuntime.reset();
  act(() => saved({ name: "submitted" }));
  expect(result.current.dirty).toBe(true);
});

it("debounces browser recovery, reports failures, and flushes the last edit on leaving", async () => {
  const { browserRecords } = await import("../../../src/app/browserRecords");
  const write = vi.spyOn(browserRecords, "write").mockResolvedValue(true);
  recovery.enabled = true;
  vi.useFakeTimers();
  const data = { monitoring: { app_metrics_interval_sec: 3 } };
  const view = renderHook(() => useEditableDraft("settings", data, empty));
  try {
    for (let i = 4; i <= 10; i++)
      act(() =>
        view.result.current.setValue({
          monitoring: { app_metrics_interval_sec: i },
        }),
      );
    await act(async () => vi.advanceTimersByTimeAsync(399));
    expect(write).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][3]).toEqual([
      { path: "monitoring.app_metrics_interval_sec", baseline: 3, value: 10 },
    ]);
    expect(view.result.current.persistenceStatus).toBe("saved");
    write.mockResolvedValueOnce(undefined);
    act(() =>
      view.result.current.setValue({
        monitoring: { app_metrics_interval_sec: 11 },
      }),
    );
    await act(async () => vi.advanceTimersByTimeAsync(400));
    expect(view.result.current.persistenceStatus).toBe("unavailable");
    act(() =>
      view.result.current.setValue({
        monitoring: { app_metrics_interval_sec: 12 },
      }),
    );
    view.unmount();
    expect(write).toHaveBeenCalledTimes(3);
    expect(write.mock.calls[2][3][0].value).toBe(12);
  } finally {
    view.unmount();
    recovery.enabled = false;
    vi.useRealTimers();
    write.mockRestore();
  }
});
it("cancels a delayed recovery write after the session is reset", async () => {
  const { browserRecords } = await import("../../../src/app/browserRecords");
  const { sessionRuntime } = await import("../../../src/app/sessionRuntime");
  const write = vi.spyOn(browserRecords, "write").mockResolvedValue(true);
  recovery.enabled = true;
  vi.useFakeTimers();
  const data = { monitoring: { app_metrics_interval_sec: 3 } };
  const view = renderHook(() => useEditableDraft("settings", data, empty));
  try {
    act(() =>
      view.result.current.setValue({
        monitoring: { app_metrics_interval_sec: 10 },
      }),
    );
    sessionRuntime.reset();
    await act(async () => vi.advanceTimersByTimeAsync(500));
    view.unmount();
    expect(write).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    recovery.enabled = false;
    vi.useRealTimers();
    write.mockRestore();
  }
});
