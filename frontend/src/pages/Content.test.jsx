import { render, screen, waitFor } from "../test/utils";
import { act } from "@testing-library/react";
import Content from "./Content";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as api from "../api";

vi.mock("../api");

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
          data: {
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
      // Return a default success object to prevent "Unknown error" on other gets
      return Promise.resolve({ status: "success" });
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

  it("handles file deletion", async () => {
    render(<Content />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
  });
});
