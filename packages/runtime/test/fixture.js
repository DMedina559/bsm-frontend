import { vi } from "vitest";
import { createApplicationRuntime } from "../src/index.js";
import { createHost } from "./platform.js";
export function createFixture() {
  const host = createHost();
  const callOperation = vi.fn(async () => []);
  const queryClient = {
    clear: vi.fn(),
    removeQueries: vi.fn(),
    resetQueries: vi.fn(async () => {}),
    cancelQueries: vi.fn(async () => {}),
    invalidateQueries: vi.fn(async () => {}),
    setQueriesData: vi.fn(),
    fetchQuery: ({ queryFn }) =>
      queryFn({ signal: new AbortController().signal }),
  };
  let backend = "https://bsm.example/prefix";
  const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const runtime = createApplicationRuntime({
    queryClient,
    callOperation,
    getBackendIdentity: () => backend,
    resolveWebSocketUrl: () => backend.replace("https:", "wss:") + "/ws",
    platform: host.platform,
    logger,
  });
  return {
    runtime,
    host,
    queryClient,
    callOperation,
    logger,
    setBackend: (value) => {
      backend = value;
    },
  };
}
