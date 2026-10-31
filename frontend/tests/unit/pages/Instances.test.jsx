import React from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  render,
  act,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Instances from "../../../src/pages/Instances";
import {
  saveInstance,
  updateInstance,
  writeInstanceToken,
} from "../../../src/app/instanceProfiles";
import { createInstanceConnection } from "../../../src/features/instances/connection";
vi.mock("../../../src/features/instances/connection", () => ({
  createInstanceConnection: vi.fn(),
}));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(async () => true) }));
vi.mock("../../../src/contexts/DialogContext", () => ({
  useDialog: () => ({ confirmAction: dialogs.confirm }),
}));
const sessions = new Map();
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem("show_hidden_flag", "true");
  sessions.clear();
  dialogs.confirm.mockReset().mockResolvedValue(true);
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
  await waitFor(() =>
    expect(sessions.get(a.id).action).toHaveBeenCalledWith(
      "survival",
      "stop_server",
    ),
  );
  expect(sessions.get(b.id).action).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Search fleet"), {
    target: { value: "Home" },
  });
  expect(
    within(screen.getByRole("article", { name: "Lab" })).queryByText(
      "survival",
    ),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search fleet"), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("Server status", { exact: true }), {
    target: { value: "stopped" },
  });
  expect(screen.queryByText("survival")).not.toBeInTheDocument();
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

it("keeps connections mounted when group filters hide their cards", async () => {
  const profile = saveInstance({
    name: "Home",
    url: "https://home.test",
    group: "Home",
  });
  saveInstance({ name: "Lab", url: "https://lab.test", group: "Lab" });
  render(
    <MemoryRouter>
      <Instances />
    </MemoryRouter>,
  );
  await screen.findByRole("article", { name: "Home" });
  const session = sessions.get(profile.id);
  fireEvent.change(screen.getByLabelText("Instance group"), {
    target: { value: "Lab" },
  });
  expect(
    screen.queryByRole("article", { name: "Home" }),
  ).not.toBeInTheDocument();
  expect(session.dispose).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Instance group"), {
    target: { value: "all" },
  });
  expect(sessions.get(profile.id)).toBe(session);
});

it("does not redirect a confirmed action to a connection changed while the dialog was open", async () => {
  const profile = saveInstance({ name: "Home", url: "https://home.test" });
  let resolve;
  dialogs.confirm.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  render(
    <MemoryRouter>
      <Instances />
    </MemoryRouter>,
  );
  const card = await screen.findByRole("article", { name: "Home" });
  const old = sessions.get(profile.id);
  fireEvent.click(
    within(card).getByRole("button", { name: "Stop survival on Home" }),
  );
  await act(async () =>
    updateInstance(profile.id, { url: "https://different.test" }),
  );
  const next = sessions.get(profile.id);
  await act(async () => resolve(true));
  expect(old.action).not.toHaveBeenCalled();
  expect(next.action).not.toHaveBeenCalled();
  expect(within(card).getByRole("alert")).toHaveTextContent(
    "connection changed",
  );
});
