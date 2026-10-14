import { describe, it, expect, vi } from "vitest";
import { createSessionRuntime } from "./sessionRuntime";
describe("session resources", () => {
  it("invalidates and aborts old work before initializing a new generation", () => {
    const runtime = createSessionRuntime();
    const old = runtime.capture();
    const cleanup = vi.fn(() => expect(runtime.isCurrent(old)).toBe(false));
    const remove = runtime.onReset(cleanup);
    runtime.reset();
    expect(old.signal.aborted).toBe(true);
    expect(runtime.capture().signal.aborted).toBe(false);
    expect(cleanup).toHaveBeenCalledOnce();
    remove();
    runtime.reset();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
it("runs every session cleanup even when an earlier cleanup throws", () => {
  const runtime = createSessionRuntime();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const cleanup = vi.fn();
  runtime.onReset(() => {
    throw new Error("broken cleanup");
  });
  runtime.onReset(cleanup);
  expect(() => runtime.reset()).not.toThrow();
  expect(cleanup).toHaveBeenCalledOnce();
  log.mockRestore();
});
