import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { QueryObserver } from "@tanstack/react-query";
import { application } from "../../../src/app/application";
import { queryClient } from "../../../src/app/queryClient";
import { getPreferenceIdentity } from "../../../src/app/backendIdentity";
import { browserPlatform } from "../../../src/app/browserPlatform";
import {
  refreshActiveResources,
  startResourceRecovery,
} from "../../../src/app/resourceRecovery";
const stops = [];
beforeEach(() => application.reset());
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  application.reset();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const observe = (root, scope) => {
  const load = vi.fn(async () => ({ current: true }));
  const observer = new QueryObserver(queryClient, {
    queryKey: [root, scope],
    queryFn: load,
    staleTime: Infinity,
  });
  stops.push(observer.subscribe(() => {}));
  return load;
};
it("recovers active resources in this session without duplicating tasks or diagnostics", async () => {
  const identity = getPreferenceIdentity({ username: "admin" });
  const generation = application.sessionRuntime.capture().generation;
  const active = observe("servers", { identity, generation });
  const foreign = observe("settings", { identity: "other", generation });
  const tasks = observe("tasks", { identity, generation });
  const diagnostics = observe("diagnostics", { identity, generation });
  await vi.waitFor(() => expect(active).toHaveBeenCalledOnce());
  await refreshActiveResources(identity, generation);
  expect(active).toHaveBeenCalledTimes(2);
  expect(foreign).toHaveBeenCalledOnce();
  expect(tasks).toHaveBeenCalledOnce();
  expect(diagnostics).toHaveBeenCalledOnce();
});
it("suppresses hidden/offline fallback work, resumes when visible, and stops on reset", async () => {
  const identity = getPreferenceIdentity({ username: "admin" });
  const generation = application.sessionRuntime.capture().generation;
  const load = observe("servers", { identity, generation });
  await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
  vi.useFakeTimers();
  const visible = vi.spyOn(browserPlatform, "isVisible").mockReturnValue(false);
  const online = vi.spyOn(browserPlatform, "isOnline").mockReturnValue(true);
  const stop = startResourceRecovery({
    identity,
    generation,
    connected: false,
    fallback: true,
  });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(load).toHaveBeenCalledOnce();
  visible.mockReturnValue(true);
  online.mockReturnValue(false);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(load).toHaveBeenCalledOnce();
  online.mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(1);
  expect(load).toHaveBeenCalledTimes(2);
  application.reset();
  const count = load.mock.calls.length;
  await vi.advanceTimersByTimeAsync(120_000);
  window.dispatchEvent(new Event("online"));
  await vi.advanceTimersByTimeAsync(1);
  expect(load).toHaveBeenCalledTimes(count);
  stop();
});
