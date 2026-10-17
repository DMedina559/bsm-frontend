import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useServerSnapshot } from "../../../src/app/useServerSnapshot";
import { getPreferenceIdentity } from "../../../src/app/backendIdentity";
vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin" }, sessionGeneration: 1 }),
}));
it("does not render an unrelated server or start a second fleet request", async () => {
  const client = new QueryClient();
  const key = [
    "servers",
    { identity: getPreferenceIdentity({ id: "admin" }), generation: 1 },
  ];
  client.setQueryData(key, {
    servers: [
      { name: "one", status: "stopped" },
      { name: "two", status: "stopped" },
    ],
  });
  let renders = 0;
  const { result } = renderHook(
    () => {
      renders++;
      return useServerSnapshot("two");
    },
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  const before = renders;
  act(() =>
    client.setQueryData(key, {
      servers: [
        { name: "one", status: "running" },
        { name: "two", status: "stopped" },
      ],
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(renders).toBe(before);
  act(() =>
    client.setQueryData(key, {
      servers: [
        { name: "one", status: "running" },
        { name: "two", status: "running" },
      ],
    }),
  );
  await waitFor(() => expect(result.current.status).toBe("running"));
  expect(renders).toBe(before + 1);
  expect(client.isFetching()).toBe(0);
  client.clear();
});
