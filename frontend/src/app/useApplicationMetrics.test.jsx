import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useApplicationMetrics } from "./useApplicationMetrics";
const state = vi.hoisted(() => ({
  isConnected: true,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  refetch: vi.fn(),
  resource: vi.fn(),
}));
vi.mock("../contexts/WebSocketContext", () => ({ useWebSocket: () => state }));
vi.mock("./resourceQueries", () => ({
  useResourceQuery: (...args) => {
    state.resource(...args);
    return { refetch: state.refetch };
  },
}));
it("releases live subscriptions and polling while paused, then resumes and cleans up", () => {
  const view = renderHook(({ enabled }) => useApplicationMetrics(enabled), {
    initialProps: { enabled: true },
  });
  expect(state.subscribe).toHaveBeenCalledWith("application-metrics");
  view.rerender({ enabled: false });
  expect(state.unsubscribe).toHaveBeenCalledTimes(1);
  expect(state.resource).toHaveBeenLastCalledWith(
    "applicationMetrics",
    undefined,
    expect.objectContaining({ enabled: false, refetchInterval: false }),
  );
  const readsWhilePaused = state.refetch.mock.calls.length;
  view.rerender({ enabled: true });
  expect(state.refetch.mock.calls.length).toBeGreaterThan(readsWhilePaused);
  expect(state.subscribe).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(state.unsubscribe).toHaveBeenCalledTimes(2);
});
