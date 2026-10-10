import { render, screen, fireEvent, waitFor, act } from "../test/utils";
import ServerConfig from "./ServerConfig";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import * as api from "../test/httpFixtures";

vi.mock("../api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../test/httpFixtures");
  return createHttpTransport(await importOriginal());
});

describe("ServerConfig", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("selectedServer", "TestServer");

    api.request.mockImplementation((url) => {
      if (url === "/api/account")
        return Promise.resolve({ username: "testuser", role: "admin" });
      if (url === "/api/servers")
        return Promise.resolve({
          status: "success",
          servers: [{ name: "TestServer" }],
        });
      return Promise.resolve({});
    });

    api.get.mockImplementation((url) => {
      if (url.includes("/settings/get")) {
        return Promise.resolve({
          status: "success",
          settings: {
            server_info: {
              installed_version: "1.0",
            },
            settings: {
              target_version: "LATEST",
            },
            auto_backup: {
              enabled: true,
            },
          },
        });
      }
      return Promise.resolve({});
    });

    api.post.mockResolvedValue({ status: "success" });
    api.del.mockResolvedValue({ status: "success" });
  });

  it("renders configuration settings", async () => {
    render(<ServerConfig />);

    await waitFor(() => {
      expect(screen.getByText("server info")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("1.0")).toBeInTheDocument();
  });

  it("saves configuration", async () => {
    render(<ServerConfig />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("1.0")).toBeInTheDocument();
    });

    // Toggle boolean
    // Find the select for enabled.
    // Label is "enabled".
    const select = screen.getByLabelText("enabled");
    fireEvent.change(select, { target: { value: "false" } });

    const saveBtn = screen.getByText(/Save Settings/i).closest("button");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.request).toHaveBeenCalledWith(
        "/api/server/TestServer/settings/set",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders the delete button and handles deletion", async () => {
    render(<ServerConfig />);

    // Wait for the delete button to be fully visible and rendered
    await waitFor(() => {
      const deleteText = screen.getByText("Delete Server");
      expect(deleteText).toBeInTheDocument();
      const deleteBtn = deleteText.closest("button");
      expect(deleteBtn).toBeInTheDocument();
      // Ensure the button isn't disabled (though logic says it shouldn't be)
      expect(deleteBtn).not.toBeDisabled();
    });

    // Use closest("button") to ensure we click the button element, not just the text node
    const deleteBtn = screen.getByText("Delete Server").closest("button");
    fireEvent.click(deleteBtn);

    expect(await screen.findByRole("dialog")).toHaveTextContent("TestServer");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Wait for the API call
    await waitFor(() => {
      expect(api.del).toHaveBeenCalledWith("/api/server/TestServer/delete");
    });
  });
  it.each([false, true])(
    "receives a remote target version update while mounted (dirty=%s)",
    async (dirty) => {
      const sockets = [];
      class Socket {
        static OPEN = 1;
        static CONNECTING = 0;
        readyState = 0;
        send = vi.fn();
        close = vi.fn();
        constructor() {
          sockets.push(this);
        }
      }
      vi.stubGlobal("WebSocket", Socket);
      render(<ServerConfig />);
      await waitFor(() =>
        expect(screen.getByLabelText("target version")).toHaveValue("LATEST"),
      );
      const socket = sockets.at(-1);
      socket.readyState = 1;
      act(() => socket.onopen());
      await act(async () =>
        socket.onmessage({
          data: JSON.stringify({
            status: "success",
            message: "Authenticated successfully",
          }),
        }),
      );
      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: "subscribe",
          topic: "event:after_set_server_setting",
        }),
      );
      if (dirty)
        fireEvent.change(screen.getByLabelText("target version"), {
          target: { value: "local-edit" },
        });
      api.get.mockImplementation((url) =>
        Promise.resolve(
          url.includes("/settings/get")
            ? {
                status: "success",
                settings: {
                  server_info: { installed_version: "1.0" },
                  settings: { target_version: "PREVIEW" },
                  auto_backup: { enabled: true },
                },
              }
            : {},
        ),
      );
      await act(async () =>
        socket.onmessage({
          data: JSON.stringify({
            type: "event",
            topic: "event:after_set_server_setting",
            epoch: "backend",
            revision: 10,
            data: {
              request: {
                server_name: "TestServer",
                key: "settings.target_version",
                value: "PREVIEW",
              },
              server_name: "TestServer",
              key: "settings.target_version",
              value: "PREVIEW",
              result: { status: "success", message: "Setting updated" },
            },
          }),
        }),
      );
      await waitFor(() =>
        expect(screen.getByLabelText("target version")).toHaveValue(
          dirty ? "local-edit" : "PREVIEW",
        ),
      );
      if (dirty)
        await waitFor(() =>
          expect(
            screen.getByText(/saved settings changed while you were editing/i),
          ).toBeInTheDocument(),
        );
    },
  );
});
