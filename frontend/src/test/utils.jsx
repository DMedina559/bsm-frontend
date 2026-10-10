import { assertApiRequest, hasApiRoute } from "./apiContract";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../app/queryClient";
import { DialogProvider } from "../contexts/DialogContext";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "../contexts/ToastContext";
import { AuthProvider } from "../contexts/AuthContext";
import { ServerProvider } from "../contexts/ServerContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { WebSocketProvider } from "../contexts/WebSocketContext";
import { vi, beforeEach, afterEach } from "vitest";
import { sessionRuntime } from "../app/sessionRuntime";
import * as api from "../api/transport";
import * as fixtures from "./httpFixtures";
beforeEach(() => {
  sessionRuntime.reset();
  queryClient.clear();
  if (vi.isMockFunction(fixtures.get))
    fixtures.get.mockResolvedValue({ needs_setup: false });
  if (vi.isMockFunction(api.request))
    fixtures.request.mockImplementation(async (url) =>
      url === "/api/account"
        ? { username: "testuser", role: "admin" }
        : { status: "success" },
    );
});

// Check the requests exercised by page tests against the actual backend schema.
afterEach(() => {
  cleanup();
  if (!vi.isMockFunction(api.request)) return;
  for (const [url, options = {}] of api.request.mock.calls) {
    if (!hasApiRoute(url)) continue;
    const body = options.body;
    if (body instanceof FormData || body instanceof URLSearchParams) continue;
    assertApiRequest(options.method ?? "GET", url, body);
  }
});

// Common fetch mock for testing providers
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ needs_setup: false }),
  }),
);

const AllTheProviders = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <DialogProvider>
                <WebSocketProvider>
                  <ServerProvider>{children}</ServerProvider>
                </WebSocketProvider>
              </DialogProvider>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const customRender = (ui, options) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from "@testing-library/react";
export { customRender as render };
