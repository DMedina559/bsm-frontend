import { render, screen, waitFor } from "../test/utils";
import { act, fireEvent } from "@testing-library/react";
import Content from "./Content";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as api from "../test/httpFixtures";

vi.mock("../api", async (importOriginal) => {
  const { createHttpTransport } = await import("../test/httpFixtures");
  return createHttpTransport(await importOriginal());
});

describe("Content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("selectedServer", "TestServer");

    api.request.mockImplementation((url) => {
      if (url === "/api/servers")
        return Promise.resolve({
          status: "success",
          servers: [{ name: "TestServer" }],
        });
      if (url === "/api/account")
        return Promise.resolve({ username: "admin", role: "admin" });
      return Promise.resolve({});
    });

    api.get.mockImplementation((url) => {
      if (url === "/api/plugins") {
        return Promise.resolve({
          status: "success",
          plugins: {
            content_uploader_plugin: { enabled: true },
          },
        });
      }

      if (url.includes("/content/worlds")) {
        return Promise.resolve({
          status: "success",
          files: ["world.zip"],
        });
      }

      if (url.includes("/content/addons")) {
        return Promise.resolve({
          status: "success",
          files: ["addon.mcpack"],
        });
      }
      if (url.endsWith("/addons"))
        return Promise.resolve({
          status: "success",
          addons: {
            behavior_packs: [
              {
                uuid: "pack-1",
                name: "Example Pack",
                version: [1, 0, 0],
                status: "ACTIVE",
                subpacks: [
                  { folder_name: "low", name: "Low" },
                  { folder_name: "high", name: "High" },
                ],
                active_subpack: "low",
              },
            ],
            resource_packs: [],
          },
        });
      // Return a default success object to prevent "Unknown error" on other gets
      return Promise.resolve({ status: "success" });
    });

    api.resolveApiUrl.mockImplementation((url) => url);
    api.post.mockResolvedValue({
      status: "accepted",
      task_id: "addon-task",
      message: "Queued.",
    });
    api.del.mockResolvedValue({ status: "success" });
  });

  it("renders file list", async () => {
    render(<Content />);

    await waitFor(() => {
      expect(screen.getByText(/Content Management/)).toHaveTextContent(
        "TestServer",
      );
    });

    await waitFor(() => {
      expect(screen.getByText("world.zip")).toBeInTheDocument();
    });
  });

  it("renders addon list when tab changed", async () => {
    render(<Content />);

    await waitFor(() => {
      expect(screen.getByText("world.zip")).toBeInTheDocument();
    });

    // Click addons tab
    const addonsTab = screen.getByText("Addons");
    act(() => {
      addonsTab.click();
    });

    await waitFor(() => {
      expect(screen.getByText("addon.mcpack")).toBeInTheDocument();
    });
  });

  it("sends the typed subpack request from the installed addons modal", async () => {
    render(<Content />);
    await screen.findByText("world.zip");
    fireEvent.click(screen.getByRole("button", { name: "Addons" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Manage Installed Addons/ }),
    );
    const select = await screen.findByTitle("Active Subpack");
    fireEvent.change(select, { target: { value: "high" } });
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/api/server/TestServer/addon/subpack",
        { pack_uuid: "pack-1", pack_type: "behavior", subpack_name: "high" },
      ),
    );
  });
});
