import { assertApiRequest, hasApiRoute } from "./apiContract";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../app/queryClient";
import { DialogProvider } from "../DialogContext";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "../ToastContext";
import { AuthProvider } from "../AuthContext";
import { ServerProvider } from "../ServerContext";
import { ThemeProvider } from "../ThemeContext";
import { WebSocketProvider } from "../WebSocketContext";
import { vi, beforeEach, afterEach } from "vitest";
import { sessionRuntime } from "../app/sessionRuntime";
import * as api from "../api";
beforeEach(() => {
  sessionRuntime.reset();
  queryClient.clear();
  if (vi.isMockFunction(api.get))
    api.get.mockResolvedValue({ needs_setup: false });
  if (vi.isMockFunction(api.request))
    api.request.mockImplementation(async (url) =>
      url === "/api/account"
        ? { username: "testuser", role: "admin" }
        : { status: "success" },
    );
});

// Check the requests exercised by page tests against the actual backend schema.
afterEach(() => {
  cleanup();
  for (const [name, method] of Object.entries({
    get: "GET",
    post: "POST",
    put: "PUT",
    del: "DELETE",
    request: null,
  })) {
    if (!vi.isMockFunction(api[name])) continue;
    for (const [url, value, options] of api[name].mock.calls) {
      // Plugin and initial setup routes are outside the backend OpenAPI export.
      if (!hasApiRoute(url)) continue;
      const verb = method ?? value?.method ?? "GET";
      const body = ["get", "del", "request"].includes(name)
        ? value?.body
        : value;
      if (body instanceof FormData || body instanceof URLSearchParams) continue;
      assertApiRequest(verb, url, options?.body ?? body);
    }
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
