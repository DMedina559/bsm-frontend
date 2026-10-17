import { it, expect, vi } from "vitest";
import { createFrontendApplication } from "../../../src/app/application";

it("requires explicit command composition before starting any session work", () => {
  const socket = vi.fn();
  const app = createFrontendApplication({
    queryClient: { clear: vi.fn() },
    getBackendIdentity: () => "https://bsm.example",
    resolveWebSocketUrl: () => "wss://bsm.example/ws",
    platform: { createWebSocket: socket },
  });
  expect(() => app.start({ identity: "admin" })).toThrow("operation caller");
  expect(socket).not.toHaveBeenCalled();
  app.dispose();
});
