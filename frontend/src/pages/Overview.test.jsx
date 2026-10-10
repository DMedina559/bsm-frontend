import { assertApiResponse } from "../test/apiContract";
import { getPreferenceIdentity } from "../app/backendIdentity";
import { getSessionStorageKey } from "../app/sessionBoundary";
import { render, screen, fireEvent, waitFor } from "../test/utils";
import Overview from "./Overview";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as api from "../test/httpFixtures";

vi.mock("../api", async (importOriginal) => {
  const { createHttpTransport } = await import("../test/httpFixtures");
  return createHttpTransport(await importOriginal());
});

describe("Overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock servers fetch
    api.request.mockImplementation((url) => {
      if (url === "/api/servers") {
        return Promise.resolve({
          status: "success",
          servers: [
            {
              name: "Server1",
              status: "stopped",
              version: "1.0",
              player_count: 0,
            },
            {
              name: "Server2",
              status: "running",
              version: "1.1",
              player_count: 5,
            },
          ],
        });
      }
      if (url === "/api/account")
        return Promise.resolve({ username: "admin", role: "admin" });
      return Promise.resolve({});
    });

    // Mock actions
    api.post.mockResolvedValue({ status: "success" });
  });

  it("renders server list", async () => {
    render(<Overview />);
    await waitFor(() =>
      expect(screen.getByText("Server1")).toBeInTheDocument(),
    );
    expect(screen.getByText("Server2")).toBeInTheDocument();
    expect(screen.getByText("STOPPED")).toBeInTheDocument();
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
  });

  it("handles start action", async () => {
    render(<Overview />);
    await waitFor(() =>
      expect(screen.getByText("Server1")).toBeInTheDocument(),
    );

    const startBtns = screen.getAllByTitle("Start Server");
    // Server1 is first (Server1)
    const btn = startBtns[0];
    fireEvent.click(btn);

    // api.post params: url, body, options
    // handleAction calls post(`/api/server/${serverName}/${action}`)
    // post helper: post(url, body, options)
    // If body is undefined, it might pass undefined.
    // Overview.jsx calls post with 1 argument.
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/server/Server1/start"),
    );
  });
  it("shows only actions appropriate to each server state", async () => {
    render(<Overview />);
    await waitFor(() =>
      expect(screen.getByText("Server1")).toBeInTheDocument(),
    );
    expect(screen.getAllByTitle("Start Server")).toHaveLength(1);
    expect(screen.getAllByTitle("Stop Server")).toHaveLength(1);
    expect(screen.getAllByTitle("Restart Server")).toHaveLength(1);
    expect(screen.getAllByTitle("Update Server")).toHaveLength(2);
    expect(screen.getAllByTitle("Send Command")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Send command to Server1" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Send command to Server2" }),
    ).toBeEnabled();
  });

  it("defaults to grid and lets users change the saved layout", async () => {
    localStorage.removeItem("bsm.overview-layout.v1");
    render(<Overview />);
    await waitFor(() =>
      expect(screen.getByText("Server1")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Grid" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      JSON.parse(
        localStorage.getItem(
          getSessionStorageKey(
            getPreferenceIdentity({ username: "admin" }),
            "preference:overviewLayout",
          ),
        ),
      ).value,
    ).toBe("list");
    expect(document.querySelector(".overview-layout-list")).toBeInTheDocument();
  });

  it("shows the branded intro and three fleet metrics", async () => {
    render(<Overview />);
    await waitFor(() =>
      expect(screen.getByText("Server1")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("region", { name: "Fleet status" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Managed servers")).toBeInTheDocument();
    expect(screen.getByText("Players online")).toBeInTheDocument();
    expect(document.querySelector(".overview-intro")).toBeInTheDocument();
  });
  it("shows the backend lifecycle outcome instead of an assumed start", async () => {
    const response = {
      status: "success",
      server_name: "Server1",
      outcome: "already_running",
      message: "Server is already running.",
    };
    assertApiResponse("POST", "/api/server/Server1/start", response);
    api.post.mockResolvedValue(response);
    render(<Overview />);
    await screen.findByText("Server1");
    fireEvent.click(screen.getByTitle("Start Server"));
    expect(await screen.findByText(response.message)).toBeInTheDocument();
  });
});
