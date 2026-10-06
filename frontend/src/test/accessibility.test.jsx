import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axe from "axe-core";
import { describe, it, expect, vi } from "vitest";
import { DialogProvider } from "../DialogContext";
import { ToastProvider } from "../ToastContext";
import { fixtureResponse, servers, user } from "./fixtures";
import Account from "../pages/Account";
const Appearance = () => <Account appearanceOnly />;
import Overview from "../pages/Overview";
import ServerConfig from "../pages/ServerConfig";
import ServerProperties from "../pages/ServerProperties";
import AccessControl from "../pages/AccessControl";
import Backups from "../pages/Backups";
import Content from "../pages/Content";
import Plugins from "../pages/Plugins";
import Users from "../pages/Users";
import GlobalPlayers from "../pages/GlobalPlayers";
import AuditLog from "../pages/AuditLog";
import ServerInstall from "../pages/ServerInstall";
import OnlinePlayers from "../pages/OnlinePlayers";
import Monitor from "../pages/Monitor";
import Login from "../pages/Login";
import Setup from "../pages/Setup";
import Register from "../pages/Register";
import Playground from "../pages/Playground";
vi.mock("../api", () => ({
  get: vi.fn(async (url) => fixtureResponse(new URL(url, "http://localhost"))),
  post: vi.fn(async () => ({ status: "success" })),
  getApiBaseUrl: () => "",
  resolveApiUrl: (url) => url,
}));
const stable = vi.hoisted(() => ({
  refreshServers: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  reconnect: vi.fn(),
  setSelectedServer: vi.fn(),
  checkUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  anonymous: false,
}));
vi.mock("../AuthContext", () => ({
  useAuth: () => ({
    user: stable.anonymous ? null : user,
    checkUser: stable.checkUser,
    login: stable.login,
    logout: stable.logout,
  }),
}));
vi.mock("../ServerContext", () => ({
  useServer: () => ({
    servers,
    selectedServer: "Survival",
    setSelectedServer: stable.setSelectedServer,
    refreshServers: stable.refreshServers,
    loading: false,
    error: null,
  }),
}));
vi.mock("../WebSocketContext", () => ({
  useWebSocket: () => ({
    isConnected: true,
    isFallback: false,
    lastMessage: null,
    subscribe: stable.subscribe,
    unsubscribe: stable.unsubscribe,
    reconnect: stable.reconnect,
    addMessageListener: () => () => {},
  }),
}));
vi.mock("../ThemeContext", () => ({
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
          </MemoryRouter>,
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
