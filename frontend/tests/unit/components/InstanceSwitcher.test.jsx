import React from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import InstanceSwitcher from "../../../src/components/InstanceSwitcher";
import {
  saveInstance,
  selectInstance,
  getActiveInstance,
} from "../../../src/app/instanceProfiles";
import { draftRegistry } from "../../../src/app/draftRegistry";
const dialogs = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock("../../../src/contexts/DialogContext", () => ({
  useDialog: () => ({ confirmAction: dialogs.confirm }),
}));
function Route() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem("show_hidden_flag", "true");
  dialogs.confirm.mockReset();
  dialogs.confirm.mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const show = () =>
  render(
    <MemoryRouter>
      <InstanceSwitcher />
      <Route />
    </MemoryRouter>,
  );
it("shows saved colors in the open menu and marks the selected connection", async () => {
  saveInstance({ name: "Home", url: "https://home.test", color: "#ff0000" });
  const lab = saveInstance({
    name: "Lab",
    url: "https://lab.test",
    color: "#0000ff",
  });
  show();
  const trigger = screen.getByRole("button", {
    name: "Active BSM instance: Default connection",
  });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(
    screen.getByRole("menuitemradio", {
      name: "Default connection",
      checked: true,
    }),
  ).toHaveFocus();
  const home = screen.getByRole("menuitemradio", { name: "Home" });
  const item = screen.getByRole("menuitemradio", { name: "Lab" });
  expect(home.querySelector(".instance-color-swatch")).toHaveStyle({
    "--instance-color": "#ff0000",
  });
  expect(item.querySelector(".instance-color-swatch")).toHaveStyle({
    "--instance-color": "#0000ff",
  });
  fireEvent.click(item);
  await screen.findByRole("button", { name: "Active BSM instance: Lab" });
  expect(getActiveInstance()?.id).toBe(lab.id);
  fireEvent.click(
    screen.getByRole("button", { name: "Active BSM instance: Lab" }),
  );
  expect(
    screen.getByRole("menuitemradio", { name: "Lab", checked: true }),
  ).toBeVisible();
});
it("opens management without switching connections or discarding drafts", () => {
  const home = saveInstance({
    name: "Home",
    url: "https://home.test",
    color: "#ff0000",
  });
  selectInstance(home.id);
  vi.spyOn(draftRegistry, "dirty").mockReturnValue(true);
  show();
  fireEvent.click(
    screen.getByRole("button", { name: "Active BSM instance: Home" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "Manage instances…" }));
  expect(screen.getByLabelText("Current route")).toHaveTextContent(
    "/instances",
  );
  expect(getActiveInstance()?.id).toBe(home.id);
  expect(dialogs.confirm).not.toHaveBeenCalled();
});
it("preserves the active connection when switching with unsaved drafts is declined", async () => {
  const home = saveInstance({
    name: "Home",
    url: "https://home.test",
    color: "#ff0000",
  });
  saveInstance({ name: "Lab", url: "https://lab.test", color: "#0000ff" });
  selectInstance(home.id);
  vi.spyOn(draftRegistry, "dirty").mockReturnValue(true);
  dialogs.confirm.mockResolvedValue(false);
  show();
  fireEvent.click(
    screen.getByRole("button", { name: "Active BSM instance: Home" }),
  );
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Lab" }));
  await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledOnce());
  expect(getActiveInstance()?.id).toBe(home.id);
  expect(
    screen.getByRole("button", { name: "Active BSM instance: Home" }),
  ).toBeVisible();
});
