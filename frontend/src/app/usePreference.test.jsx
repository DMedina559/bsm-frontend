import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { usePreference } from "./usePreference";
vi.mock("../AuthContext", () => ({
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
