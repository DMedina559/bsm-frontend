import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useEditableDraft } from "./useEditableDraft";
const confirm = vi.hoisted(() => vi.fn());
vi.mock("../AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin" }, sessionGeneration: 1 }),
}));
vi.mock("../DialogContext", () => ({
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
