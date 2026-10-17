import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useScopedMutation } from "../../../src/app/publicRequests";
import { queryClient } from "../../../src/app/queryClient";
import { sessionRuntime } from "../../../src/app/sessionRuntime";

describe("scoped page writes", () => {
  beforeEach(() => {
    queryClient.clear();
    sessionRuntime.reset();
  });
  it.each(["unmount", "scope", "session"])(
    "rejects late completion after %s changes",
    async (change) => {
      let complete;
      let signal;
      const run = (_body, context) => {
        signal = context.signal;
        return new Promise((resolve) => {
          complete = resolve;
        });
      };
      const hook = renderHook(({ scope }) => useScopedMutation(scope, run), {
        initialProps: { scope: "first" },
      });
      let result;
      await act(async () => {
        result = hook.result.current.mutateAsync({}).catch((error) => error);
        await Promise.resolve();
      });
      act(() => {
        if (change === "unmount") hook.unmount();
        else if (change === "scope") hook.rerender({ scope: "second" });
        else sessionRuntime.reset();
      });
      expect(signal.aborted).toBe(true);
      await act(async () => {
        complete({ status: "success" });
      });
      expect((await result).name).toBe("AbortError");
    },
  );
});
