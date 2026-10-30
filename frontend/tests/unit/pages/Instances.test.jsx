import React from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Instances from "../../../src/pages/Instances";
import {
  saveInstance,
  writeInstanceToken,
} from "../../../src/app/instanceProfiles";
import { createInstanceConnection } from "../../../src/features/instances/connection";
vi.mock("../../../src/features/instances/connection", () => ({
  createInstanceConnection: vi.fn(),
}));
vi.mock("../../../src/contexts/DialogContext", () => ({
  useDialog: () => ({ confirmAction: async () => true }),
}));
const sessions = new Map();
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem("show_hidden_flag", "true");
  sessions.clear();
  createInstanceConnection.mockImplementation((profile, { onChange }) => {
    const snapshot = {
      status: "online",
      user: { username: profile.id, role: "admin" },
      servers: [{ name: "survival", status: "running" }],
      socket: "connected",
      info: { app_version: "4.0" },
      pending: null,
    };
    const session = {
      getSnapshot: () => snapshot,
      start: vi.fn(async () => onChange(snapshot)),
      refresh: vi.fn(),
      action: vi.fn(async () => ({ status: "success" })),
      login: vi.fn(async () => {}),
      logout: vi.fn(async () => {}),
      dispose: vi.fn(),
    };
    sessions.set(profile.id, session);
    return session;
  });
});
afterEach(() => vi.clearAllMocks());
it("shows multiple fleets and scopes same-named server actions to the selected card", async () => {
  const a = saveInstance({ name: "Home", url: "https://home.test" }),
    b = saveInstance({ name: "Lab", url: "https://lab.test" });
  writeInstanceToken(a.url, "home-token");
  writeInstanceToken(b.url, "lab-token");
  const view = render(
    <MemoryRouter>
      <Instances />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getAllByText("survival")).toHaveLength(2));
  fireEvent.click(
    within(screen.getByRole("article", { name: "Home" })).getByRole("button", {
      name: "Stop survival on Home",
    }),
  );
  expect(sessions.get(a.id).action).toHaveBeenCalledWith(
    "survival",
    "stop_server",
  );
  expect(sessions.get(b.id).action).not.toHaveBeenCalled();
  view.unmount();
  expect(sessions.get(a.id).dispose).toHaveBeenCalledOnce();
  expect(sessions.get(b.id).dispose).toHaveBeenCalledOnce();
});
it("does not open instance connections when hidden mode is disabled", () => {
  sessionStorage.removeItem("show_hidden_flag");
  saveInstance({ name: "Home", url: "https://home.test" });
  render(
    <MemoryRouter>
      <Instances />
    </MemoryRouter>,
  );
  expect(
    screen.queryByRole("heading", { name: "BSM Instances" }),
  ).not.toBeInTheDocument();
  expect(createInstanceConnection).not.toHaveBeenCalled();
});
it("can add a backend before any instance is signed in", async () => {
  render(
    <MemoryRouter>
      <Instances />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add instance" }));
  fireEvent.change(screen.getByLabelText("Display name", { exact: true }), {
    target: { value: "Remote" },
  });
  fireEvent.change(screen.getByLabelText("Backend URL"), {
    target: { value: "https://remote.test/proxy" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save instance" }));
  await screen.findByRole("article", { name: "Remote" });
  expect(createInstanceConnection).toHaveBeenCalledWith(
    expect.objectContaining({ url: "https://remote.test/proxy" }),
    expect.any(Object),
  );
});
