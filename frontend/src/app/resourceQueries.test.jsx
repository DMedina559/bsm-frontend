import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "./queryClient";
import { useResourceQuery, useResourceMutation } from "./resourceQueries";
import { queryKeys } from "./queryKeys";
import { get } from "../api";
const auth = vi.hoisted(() => ({ user: null, sessionGeneration: 1 }));
vi.mock("../AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../api", () => ({ get: vi.fn(), request: vi.fn() }));
const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
beforeEach(() => {
  queryClient.clear();
  get.mockReset();
  auth.user = null;
  auth.sessionGeneration = 1;
});
it("cannot enable an authenticated resource while anonymous", async () => {
  renderHook(() => useResourceQuery("plugins", undefined, { enabled: true }), {
    wrapper,
  });
  await act(async () => {});
  expect(get).not.toHaveBeenCalled();
});
it("isolates delayed resource results across session generations", async () => {
  let finish;
  auth.user = { username: "first" };
  get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, rerender } = renderHook(() => useResourceQuery("users"), {
    wrapper,
  });
  auth.user = { username: "second" };
  auth.sessionGeneration++;
  get.mockResolvedValue([{ username: "second" }]);
  rerender();
  await waitFor(() => expect(result.current.data?.[0].username).toBe("second"));
  await act(async () => finish([{ username: "first" }]));
  expect(result.current.data[0].username).toBe("second");
});
it("invalidates affected resources after a successful mutation", async () => {
  auth.user = { username: "admin" };
  get.mockResolvedValue([{ username: "before" }]);
  const mutate = vi.fn(async () => {
    get.mockResolvedValue([{ username: "after" }]);
  });
  const { result } = renderHook(
    () => ({
      query: useResourceQuery("users"),
      write: useResourceMutation(mutate, [queryKeys.users()]),
    }),
    { wrapper },
  );
  await waitFor(() =>
    expect(result.current.query.data?.[0].username).toBe("before"),
  );
  await act(async () => {
    await result.current.write.mutateAsync();
  });
  await waitFor(() =>
    expect(result.current.query.data?.[0].username).toBe("after"),
  );
});
it.each([
  "tasks",
  "content",
  "downloads",
  "settings",
  "plugins",
  "globalPlayers",
])(
  "surfaces malformed %s responses instead of an empty resource",
  async (resource) => {
    auth.user = { username: "admin" };
    get.mockResolvedValue({ unexpected: true });
    const { result } = renderHook(() => useResourceQuery(resource, "worlds"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error.message).toContain("Invalid");
  },
);
it("cancels a multi-step mutation after account switch and resets pending state for the new scope", async () => {
  const { sessionRuntime } = await import("./sessionRuntime");
  auth.user = { username: "first" };
  let finish;
  const second = vi.fn();
  const first = new Promise((resolve) => {
    finish = resolve;
  });
  const { result, rerender } = renderHook(
    () =>
      useResourceMutation(
        async (_variables, context) => {
          await first;
          context.assertCurrent();
          second();
        },
        [queryKeys.settings()],
      ),
    { wrapper },
  );
  let promise;
  act(() => {
    promise = result.current.mutateAsync({});
  });
  const assertion = expect(promise).rejects.toMatchObject({
    name: "AbortError",
  });
  await waitFor(() => expect(result.current.isPending).toBe(true));
  sessionRuntime.reset();
  auth.user = { username: "second" };
  auth.sessionGeneration++;
  rerender();
  expect(result.current.isPending).toBe(false);
  await act(async () => {
    finish();
    await assertion;
  });
  expect(second).not.toHaveBeenCalled();
});
