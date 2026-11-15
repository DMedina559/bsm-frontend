import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, it, expect, vi } from "vitest";
import { useThemePreviews } from "../../../src/app/useThemePreviews";
import { getBlob } from "../../../src/api/transport";
const auth = vi.hoisted(() => ({ user: { id: 1 }, sessionGeneration: 1 }));
vi.mock("../../../src/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../../src/api/transport", () => ({ getBlob: vi.fn() }));
vi.mock("../../../src/app/backendIdentity", () => ({
  getPreferenceIdentity: (user) => (user ? `backend:${user.id}` : null),
}));
beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 1 };
  auth.sessionGeneration = 1;
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
it("loads custom CSS once, retains built-ins, and re-extracts colors when mode changes", async () => {
  getBlob.mockResolvedValue({
    text: async () =>
      ':root { --bsm-accent:#123456; } :root[data-mode="light"] { --bsm-accent:#abcdef; }',
  });
  const { result, rerender } = renderHook(
    ({ mode }) => useThemePreviews(["default", "custom theme"], mode),
    { wrapper: setup(), initialProps: { mode: "dark" } },
  );
  await waitFor(() =>
    expect(result.current["custom theme"]?.colors[2]).toBe("#123456"),
  );
  expect(result.current.default.colors).toHaveLength(3);
  expect(getBlob).toHaveBeenCalledWith(
    "/themes/custom%20theme.css",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  rerender({ mode: "light" });
  await waitFor(() =>
    expect(result.current["custom theme"].colors[2]).toBe("#abcdef"),
  );
  expect(getBlob).toHaveBeenCalledTimes(1);
});
it("falls back for failed or unrecognized CSS while keeping theme selection available", async () => {
  getBlob.mockImplementation((url) =>
    url.includes("missing")
      ? Promise.reject(new Error("404"))
      : Promise.resolve({ text: async () => ".button {color:red}" }),
  );
  const { result } = renderHook(
    () => useThemePreviews(["default", "missing", "empty"], "dark"),
    { wrapper: setup() },
  );
  await waitFor(() => expect(getBlob).toHaveBeenCalledTimes(2));
  expect(result.current.default).toBeDefined();
  expect(result.current.missing).toBeUndefined();
  expect(result.current.empty).toBeUndefined();
});
it("isolates cached CSS between sessions and accounts", async () => {
  getBlob.mockResolvedValue({
    text: async () => ":root {--bsm-accent:#123456;}",
  });
  const { result, rerender } = renderHook(
    () => useThemePreviews(["custom"], "dark"),
    { wrapper: setup() },
  );
  await waitFor(() => expect(result.current.custom).toBeDefined());
  auth.user = { id: 2 };
  auth.sessionGeneration++;
  getBlob.mockResolvedValue({
    text: async () => ":root {--bsm-accent:#abcdef;}",
  });
  rerender();
  expect(result.current.custom).toBeUndefined();
  await waitFor(() => expect(result.current.custom.colors[2]).toBe("#abcdef"));
});

it("matches the selected density and updates the preview without downloading CSS again", async () => {
  getBlob.mockResolvedValue({
    text: async () =>
      ':root[data-density="comfortable"] {--bsm-accent:#123456;} :root[data-density="compact"] {--bsm-accent:#abcdef;}',
  });
  const { result, rerender } = renderHook(
    ({ density }) => useThemePreviews(["custom"], "dark", density),
    { wrapper: setup(), initialProps: { density: "comfortable" } },
  );
  await waitFor(() => expect(result.current.custom?.colors[2]).toBe("#123456"));
  rerender({ density: "compact" });
  await waitFor(() => expect(result.current.custom?.colors[2]).toBe("#abcdef"));
  expect(getBlob).toHaveBeenCalledTimes(1);
});
