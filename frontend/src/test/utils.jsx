import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../app/queryClient";
import { DialogProvider } from "../DialogContext";
import React from "react";
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "../ToastContext";
import { AuthProvider } from "../AuthContext";
import { ServerProvider } from "../ServerContext";
import { ThemeProvider } from "../ThemeContext";
import { WebSocketProvider } from "../WebSocketContext";
import { vi, beforeEach } from "vitest";
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
        <ToastProvider>
          <DialogProvider>
            <AuthProvider>
              <ThemeProvider>
                <WebSocketProvider>
                  <ServerProvider>{children}</ServerProvider>
                </WebSocketProvider>
              </ThemeProvider>
            </AuthProvider>
          </DialogProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const customRender = (ui, options) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from "@testing-library/react";
export { customRender as render };
