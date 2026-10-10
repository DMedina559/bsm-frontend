import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import Layout from "./Layout";
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "admin" } }),
}));
vi.mock("../contexts/ServerContext", () => ({
  useServer: () => ({ selectedServer: "Survival" }),
}));
vi.mock("../contexts/WebSocketContext", () => ({
  useWebSocket: () => ({ isConnected: true, isFallback: false }),
}));
vi.mock("../components/NotificationHistory", () => ({ default: () => null }));
vi.mock("../components/Footer", () => ({ default: () => null }));
vi.mock("../components/Sidebar", () => ({
  default: ({ mobileOpen, setMobileOpen }) => (
    <aside>
      <button onClick={() => setMobileOpen(false)}>
        {mobileOpen ? "Close sidebar" : "Collapse sidebar"}
      </button>
    </aside>
  ),
}));
let change;
const originalMatchMedia = window.matchMedia;
beforeEach(() => {
  window.matchMedia = vi.fn(() => ({
    matches: true,
    addEventListener: (_, callback) => {
      change = callback;
    },
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});
it("shows one mobile navigation control at a time and excludes the closed drawer", () => {
  const { container } = render(
    <MemoryRouter>
      <Layout />
    </MemoryRouter>,
  );
  const menu = screen.getByRole("button", { name: "Open navigation" });
  const navigation = container.querySelector(".navigation-shell");
  expect(navigation).toHaveAttribute("inert");
  fireEvent.click(menu);
  expect(menu).toHaveAttribute("hidden");
  expect(navigation).not.toHaveAttribute("inert");
  fireEvent.click(screen.getByRole("button", { name: "Close sidebar" }));
  expect(menu).not.toHaveAttribute("hidden");
  expect(navigation).not.toHaveAttribute("aria-hidden");
  expect(menu).toHaveFocus();
});
it("resets drawer and restores desktop navigation on a breakpoint change", () => {
  const { container } = render(
    <MemoryRouter>
      <Layout />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  act(() => change({ matches: false }));
  expect(container.querySelector(".navigation-shell")).not.toHaveAttribute(
    "inert",
  );
  expect(container.querySelector(".workspace-shell")).not.toHaveAttribute(
    "inert",
  );
  expect(
    screen.getByRole("button", { name: "Collapse sidebar" }),
  ).toBeInTheDocument();
});
