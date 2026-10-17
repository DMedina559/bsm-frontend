import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi, beforeEach } from "vitest";
import { useEditableDraft } from "../../../src/app/useEditableDraft";
const store = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
}));
const preference = vi.hoisted(() => ({ enabled: true }));
vi.mock("../../../src/app/browserRecords", () => ({ browserRecords: store }));
vi.mock("../../../src/app/usePreference", () => ({
  usePreference: () => [preference.enabled],
}));
vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin" }, sessionGeneration: 1 }),
}));
vi.mock("../../../src/contexts/DialogContext", () => ({
  useDialog: () => ({ confirmAction: vi.fn(async () => true) }),
}));
const empty = {};
const baseline = {
  monitoring: { app_metrics_interval_sec: 3 },
  web: { jwt_secret_key: "private" },
};
beforeEach(() => {
  vi.clearAllMocks();
  store.read.mockResolvedValue(undefined);
  preference.enabled = true;
});
it("offers explicit recovery, rebases on fresh secrets, and flags changed backend values", async () => {
  store.read.mockResolvedValue({
    savedAt: 1,
    value: [
      { path: "monitoring.app_metrics_interval_sec", baseline: 2, value: 10 },
    ],
  });
  const { result } = renderHook(() =>
    useEditableDraft("settings", baseline, empty),
  );
  await waitFor(() => expect(result.current.recoverable).toBeTruthy());
  expect(result.current.value).toEqual(baseline);
  act(() => result.current.restoreRecovery());
  expect(result.current.value.monitoring.app_metrics_interval_sec).toBe(10);
  expect(result.current.value.web.jwt_secret_key).toBe("private");
  expect(result.current.conflicted).toBe(true);
  expect(JSON.stringify(store.write.mock.calls)).not.toContain("private");
  act(() => result.current.markSaved(result.current.value));
  expect(store.remove).toHaveBeenCalled();
  expect(result.current.recoverable).toBeFalsy();
});
it("does not read or write drafts until recovery is enabled", () => {
  preference.enabled = false;
  const { result } = renderHook(() =>
    useEditableDraft("settings", baseline, empty),
  );
  act(() =>
    result.current.setValue({ monitoring: { app_metrics_interval_sec: 10 } }),
  );
  expect(store.read).not.toHaveBeenCalled();
  expect(store.write).not.toHaveBeenCalled();
});
it("ignores a late recovery read after new edits or a resource change", async () => {
  let finish;
  store.read.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, rerender } = renderHook(
    ({ resource }) => useEditableDraft(resource, baseline, empty),
    { initialProps: { resource: "settings" } },
  );
  act(() =>
    result.current.setValue({
      ...baseline,
      monitoring: { app_metrics_interval_sec: 15 },
    }),
  );
  await act(async () =>
    finish({
      value: [
        { path: "monitoring.app_metrics_interval_sec", baseline: 3, value: 10 },
      ],
    }),
  );
  expect(result.current.recoverable).toBeFalsy();
  rerender({ resource: "server-settings:other" });
  expect(result.current.value).toEqual(baseline);
  expect(result.current.recoverable).toBeFalsy();
});
