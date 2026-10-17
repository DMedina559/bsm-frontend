import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { usePreference } from "../../../src/app/usePreference";
vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "admin" } }),
}));
beforeEach(() => localStorage.clear());
it("rejects invalid values before changing the in-memory preference", () => {
  const { result } = renderHook(() => usePreference("overviewLayout", "grid"));
  act(() => expect(result.current[1]("invalid")).toBe(false));
  expect(result.current[0]).toBe("grid");
  act(() => result.current[1]("compact"));
  expect(result.current[0]).toBe("compact");
});

it("shares notifications and memory fallback between consumers", () => {
  const first = renderHook(() => usePreference("overviewLayout", "grid"));
  const second = renderHook(() => usePreference("overviewLayout", "grid"));
  const persist = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  act(() => first.result.current[1]("compact"));
  expect(second.result.current[0]).toBe("compact");
  persist.mockRestore();
});

it("does not migrate unscoped embedded preferences into a remote backend", async () => {
  localStorage.setItem("bsm.overview-layout.v1", "list");
  localStorage.setItem("api_base_url", "https://other.example/prefix");
  const { result } = renderHook(() => usePreference("overviewLayout", "grid"));
  expect(result.current[0]).toBe("grid");
  expect(localStorage.getItem("bsm.overview-layout.v1")).toBe("list");
});

it("ignores malformed scoped storage without replacing it with a guessed value", async () => {
  const { getPreferenceIdentity } =
    await import("../../../src/app/backendIdentity");
  const { getSessionStorageKey } =
    await import("@bedrock-server-manager/storage");
  localStorage.removeItem("api_base_url");
  const key = getSessionStorageKey(
    getPreferenceIdentity({ username: "admin" }),
    "preference:serverSort",
  );
  localStorage.setItem(key, "{");
  const fallback = { key: "name", direction: "asc" };
  const { result } = renderHook(() => usePreference("serverSort", fallback));
  expect(result.current[0]).toEqual(fallback);
});
