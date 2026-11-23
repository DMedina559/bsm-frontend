import { render, screen, fireEvent, waitFor } from "../../support/utils";
import Plugins from "../../../src/pages/Plugins";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as api from "../../support/httpFixtures";

vi.mock("../../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../../support/httpFixtures");
  return createHttpTransport(await importOriginal());
});

describe("Plugins", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    api.get.mockImplementation((url) => {
      if (url === "/api/plugins") {
        return Promise.resolve({
          status: "success",
          plugins: {
            "Test Plugin": {
              version: "1.0",
              author: "Tester",
              description: "A test plugin",
              enabled: true,
            },
          },
        });
      }
      return Promise.resolve({});
    });

    api.put.mockResolvedValue({ status: "success" });
    api.post.mockResolvedValue({ status: "success" });
  });

  it("renders plugin list", async () => {
    render(<Plugins />);

    await waitFor(() => {
      expect(screen.getByText("Test Plugin")).toBeInTheDocument();
    });
    expect(screen.getByText("v1.0")).toBeInTheDocument();
  });

  it("toggles plugin", async () => {
    render(<Plugins />);

    await waitFor(() => {
      expect(screen.getByText("Test Plugin")).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTitle("Disable");
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/api/plugins/Test%20Plugin",
        expect.objectContaining({ enabled: false }),
      );
    });
  });
  it("keeps configured state distinct from runtime and exposes declared capabilities", async () => {
    api.get.mockImplementation((url) =>
      Promise.resolve(
        url === "/api/plugins"
          ? {
              status: "success",
              plugins: {
                broken: {
                  enabled: true,
                  status: "ERROR",
                  permissions: ["path:servers", "custom:future"],
                  has_global_settings: true,
                  has_server_settings: true,
                },
                idle: { enabled: false, status: "DISABLED", permissions: [] },
              },
            }
          : {},
      ),
    );
    render(<Plugins />);
    expect(await screen.findByText("broken")).toBeInTheDocument();
    expect(screen.getByText("ERROR")).toBeInTheDocument();
    expect(
      screen.getByText("Enabled", { selector: "span" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.getByText("Server")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Declared permissions (2)"));
    expect(screen.getByText("path:servers")).toBeVisible();
    expect(screen.getByText("custom:future")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Plugin status"), {
      target: { value: "error" },
    });
    expect(screen.queryByText("idle")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search plugins"), {
      target: { value: "custom:future" },
    });
    expect(screen.getByText("broken")).toBeInTheDocument();
  });
});
