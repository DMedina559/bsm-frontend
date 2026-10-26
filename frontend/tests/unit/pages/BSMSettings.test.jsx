import { render, screen, fireEvent, waitFor } from "../../support/utils";
import BSMSettings from "../../../src/pages/BSMSettings";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as api from "../../support/httpFixtures";

vi.mock("../../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../../support/httpFixtures");
  return createHttpTransport(await importOriginal());
});

describe("BSMSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/app/bsm-settings");

    api.get.mockImplementation((url) => {
      if (url === "/api/settings/get") {
        return Promise.resolve({
          status: "success",
          settings: {
            server: {
              name: "Bedrock Server",
              port: 19132,
            },
            backups: {
              encryption: false,
              include_server_packs: true,
              safety_window_hours: 168,
              keep_daily: 0,
              destinations: {},
              schedules: {},
            },
            advanced: {
              debug: false,
            },
          },
        });
      }
      return Promise.resolve({});
    });

    api.post.mockResolvedValue({ status: "success" });
  });

  it("renders settings form", async () => {
    render(<BSMSettings />);

    await waitFor(() => {
      expect(screen.getByText("Global Settings")).toBeInTheDocument();
    });
    // Section headers
    expect(await screen.findByText("server")).toBeInTheDocument();
    // Inputs
    expect(screen.getByDisplayValue("Bedrock Server")).toBeInTheDocument();
    expect(screen.getByDisplayValue("19132")).toBeInTheDocument();
  });

  it("saves settings", async () => {
    render(<BSMSettings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Bedrock Server")).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue("Bedrock Server");
    fireEvent.change(nameInput, { target: { value: "New Name" } });

    const saveBtn = screen.getByText("Save Changes").closest("button");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.request).toHaveBeenCalledWith(
        "/api/settings/set",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            key: "server.name",
            value: "New Name",
          }),
        }),
      );
    });
    expect(
      api.request.mock.calls
        .filter(([url]) => url === "/api/settings/set")
        .map(([, options]) => options.body),
    ).toEqual([{ key: "server.name", value: "New Name" }]);
  });
  it("keeps backup policy in its own tab and retains unsaved edits across tabs", async () => {
    render(<BSMSettings />);
    await screen.findByDisplayValue("Bedrock Server");
    expect(screen.queryByText("Backup policy")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Backups" }));
    expect(screen.getByRole("tab", { name: "Backups" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.change(screen.getByLabelText("Daily recovery points"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "General" }));
    fireEvent.click(screen.getByRole("tab", { name: "Backups" }));
    expect(screen.getByLabelText("Daily recovery points")).toHaveValue(7);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() =>
      expect(api.request).toHaveBeenCalledWith(
        "/api/settings/set",
        expect.objectContaining({
          body: {
            key: "backups",
            value: expect.objectContaining({ keep_daily: 7 }),
          },
        }),
      ),
    );
  });
  it("supports direct links and keyboard navigation between settings tabs", async () => {
    window.history.replaceState({}, "", "/app/bsm-settings?tab=backups");
    render(<BSMSettings />);
    await screen.findByText("Backup policy");
    const tab = screen.getByRole("tab", { name: "Backups" });
    fireEvent.keyDown(tab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Web & access" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Web & access" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("saves removals from backup destinations as a complete policy", async () => {
    api.get.mockImplementation((url) =>
      Promise.resolve(
        url === "/api/settings/get"
          ? {
              status: "success",
              settings: {
                backups: {
                  encryption: false,
                  include_server_packs: true,
                  safety_window_hours: 168,
                  destinations: {
                    nas: { path: "/mnt/backups", enabled: true },
                  },
                  schedules: {},
                },
              },
            }
          : {},
      ),
    );
    window.history.replaceState({}, "", "/app/bsm-settings?tab=backups");
    render(<BSMSettings />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove destination" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() =>
      expect(api.request).toHaveBeenCalledWith(
        "/api/settings/set",
        expect.objectContaining({
          body: {
            key: "backups",
            value: expect.objectContaining({ destinations: {} }),
          },
        }),
      ),
    );
  });
});
