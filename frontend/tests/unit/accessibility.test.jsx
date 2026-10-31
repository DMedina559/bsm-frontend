import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../src/app/queryClient";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axe from "axe-core";
import { describe, it, expect, vi } from "vitest";
import { DialogProvider } from "../../src/contexts/DialogContext";
import { ToastProvider } from "../../src/contexts/ToastContext";
import { fixtureResponse, servers, user } from "../support/fixtures";
import Account from "../../src/pages/Account";
import FrontendSettings from "../../src/pages/FrontendSettings";
const Appearance = FrontendSettings;
import Overview from "../../src/pages/Overview";
import ServerConfig from "../../src/pages/ServerConfig";
import ServerProperties from "../../src/pages/ServerProperties";
import AccessControl from "../../src/pages/AccessControl";
import Backups from "../../src/pages/Backups";
import Content from "../../src/pages/Content";
import Plugins from "../../src/pages/Plugins";
import Users from "../../src/pages/Users";
import GlobalPlayers from "../../src/pages/GlobalPlayers";
import AuditLog from "../../src/pages/AuditLog";
import ServerInstall from "../../src/pages/ServerInstall";
import OnlinePlayers from "../../src/pages/OnlinePlayers";
import Monitor from "../../src/pages/Monitor";
import Login from "../../src/pages/Login";
import Setup from "../../src/pages/Setup";
import Register from "../../src/pages/Register";
import Playground from "../../src/pages/Playground";
vi.mock("../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport, configureHttpFixtures } =
    await import("../support/httpFixtures");
  const fixtures = {
    get: vi.fn(async (url) =>
      fixtureResponse(new URL(url, "http://localhost")),
    ),
    post: vi.fn(async () => ({ status: "success" })),
    getApiBaseUrl: () => "",
    resolveApiUrl: (url) => url,
  };
  configureHttpFixtures(fixtures);
  return createHttpTransport(await importOriginal());
});
const stable = vi.hoisted(() => ({
  refreshServers: vi.fn(),
  subscribe: vi.fn(),
  addMessageListener: () => () => {},
  unsubscribe: vi.fn(),
  reconnect: vi.fn(),
  setSelectedServer: vi.fn(),
  checkUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  anonymous: false,
}));
vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: stable.anonymous ? null : user,
    checkUser: stable.checkUser,
    login: stable.login,
    logout: stable.logout,
  }),
}));
vi.mock("../../src/contexts/ServerContext", () => ({
  useServer: () => ({
    servers,
    selectedServer: "Survival",
    setSelectedServer: stable.setSelectedServer,
    refreshServers: stable.refreshServers,
    loading: false,
    error: null,
  }),
}));
vi.mock("../../src/contexts/WebSocketContext", () => ({
  useWebSocket: () => ({
    isConnected: true,
    isFallback: false,
    lastMessage: null,
    subscribe: stable.subscribe,
    unsubscribe: stable.unsubscribe,
    reconnect: stable.reconnect,
    addMessageListener: stable.addMessageListener,
  }),
}));
vi.mock("../../src/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "default",
    appearance: { mode: "theme", density: "comfortable" },
    changeTheme: vi.fn(),
    updateAppearance: vi.fn(),
    resetAppearance: vi.fn(),
  }),
}));
describe("page accessibility structure with fixture data", () => {
  for (const [name, Page] of Object.entries({
    Login,
    Account,
    Appearance,
    Overview,
    ServerConfig,
    ServerProperties,
    AccessControl,
    Backups,
    Content,
    Plugins,
    Users,
    GlobalPlayers,
    AuditLog,
    ServerInstall,
    OnlinePlayers,
    Monitor,
    Setup,
    Register,
    Playground,
  })) {
    it(
      name,
      async () => {
        stable.anonymous = name === "Login";
        const { container } = render(
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={["/register/test"]}>
              <DialogProvider>
                <ToastProvider>
                  <Routes>
                    <Route
                      path="/register/:token"
                      element={
                        <main>
                          <Page />
                        </main>
                      }
                    />
                  </Routes>
                </ToastProvider>
              </DialogProvider>
            </MemoryRouter>
          </QueryClientProvider>,
        );
        await act(async () => {});
        await waitFor(() =>
          expect(screen.getAllByRole("heading").length).toBeGreaterThan(0),
        );
        const results = await axe.run(container, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          rules: { "color-contrast": { enabled: false } },
        });
        expect(
          results.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        ).toEqual([]);
      },
      15000,
    );
  }
});
