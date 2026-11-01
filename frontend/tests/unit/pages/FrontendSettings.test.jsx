import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import FrontendSettings from "../../../src/pages/FrontendSettings";
import { ToastProvider } from "../../../src/contexts/ToastContext";
import { DialogProvider } from "../../../src/contexts/DialogContext";
import { preferenceStore } from "../../../src/app/preferenceStore";
import { getPreferenceIdentity } from "../../../src/app/backendIdentity";
vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 909, username: "preferences-user", permissions: [] },
  }),
}));
vi.mock("../../../src/app/resourceQueries", () => ({
  useResourceQuery: () => ({ data: [] }),
}));
vi.mock("../../../src/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "default",
    appearance: { mode: "theme", density: "comfortable", panorama: false },
    updateAppearance: vi.fn(),
    resetAppearance: vi.fn(),
    changeTheme: vi.fn(),
  }),
}));
const identity = () => getPreferenceIdentity({ id: 909 });
function show(tab) {
  return render(
    <MemoryRouter initialEntries={[`/frontend-settings?tab=${tab}`]}>
      <ToastProvider>
        <DialogProvider>
          <FrontendSettings />
        </DialogProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it("opens recovery directly and supports category keyboard navigation", () => {
  show("recovery");
  expect(
    screen.getByRole("heading", { name: "Browser recovery" }),
  ).toBeVisible();
  expect(screen.getByRole("tab", { name: /Browser recovery/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  fireEvent.keyDown(screen.getByRole("tab", { name: /Browser recovery/ }), {
    key: "ArrowRight",
  });
  expect(
    screen.getByRole("link", { name: "Manage saved instances" }),
  ).toHaveAttribute("href", "/instances?hidden=true");
  expect(screen.getByRole("tab", { name: /Connections/ })).toHaveFocus();
});
it("edits the existing account-scoped display preferences instead of creating another store", async () => {
  preferenceStore.write(identity(), "overviewLayout", "list");
  show("display");
  expect(screen.getByLabelText("Fleet layout").value).toBe("list");
  fireEvent.change(screen.getByLabelText("Fleet layout"), {
    target: { value: "compact" },
  });
  fireEvent.change(screen.getByLabelText("Default server sort"), {
    target: { value: "status" },
  });
  fireEvent.click(screen.getByLabelText("Collapse sidebar"));
  await waitFor(() => {
    expect(preferenceStore.read(identity(), "overviewLayout")).toBe("compact");
    expect(preferenceStore.read(identity(), "serverSort")).toEqual({
      key: "status",
      direction: "asc",
    });
    expect(preferenceStore.read(identity(), "sidebarCollapsed")).toBe(true);
  });
});
it("places frontend recording controls in the central settings page", () => {
  show("diagnostics");
  fireEvent.click(screen.getByLabelText("Record frontend observations"));
  expect(preferenceStore.read(identity(), "runtimeDiagnostics")).toEqual({
    recording: true,
    persist: false,
  });
});
