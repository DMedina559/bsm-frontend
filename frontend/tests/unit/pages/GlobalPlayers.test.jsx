import { render, screen, waitFor, fireEvent } from "../../support/utils";
import GlobalPlayers from "../../../src/pages/GlobalPlayers";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as api from "../../support/httpFixtures";

vi.mock("../../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../../support/httpFixtures");
  return createHttpTransport(await importOriginal());
});

describe("GlobalPlayers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    api.get.mockImplementation((url) => {
      if (url === "/api/players/get") {
        return Promise.resolve({
          status: "success",
          players: [
            { xuid: "111", name: "GlobalPlayer1", last_seen: "2023-01-01" },
          ],
        });
      }
      // Return success for auth/other checks
      if (url === "/api/account") return Promise.resolve({ role: "admin" });

      return Promise.resolve({});
    });
  });

  it("renders player list", async () => {
    render(<GlobalPlayers />);

    await waitFor(() => {
      expect(screen.getByText("Global Player Database")).toBeInTheDocument();
    });

    await waitFor(() =>
      expect(screen.getByText("GlobalPlayer1")).toBeInTheDocument(),
    );
  });
});

it("shows partial scan results and per-server failures", async () => {
  api.get.mockResolvedValue({ status: "success", players: [] });
  api.put.mockResolvedValue({
    status: "partial",
    message: "One server could not be scanned.",
    details: {
      scan_errors: [
        {
          server: "Survival",
          error: { code: "file_error", message: "Log unavailable" },
        },
      ],
    },
  });
  render(<GlobalPlayers />);
  await waitFor(() =>
    expect(api.get.mock.calls.some(([url]) => url === "/api/players/get")).toBe(
      true,
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Scan server logs for players" }),
  );
  await waitFor(() =>
    expect(
      screen.getByText(/Operation partially completed/),
    ).toBeInTheDocument(),
  );
  expect(screen.getByText("Log unavailable")).toBeInTheDocument();
  expect(screen.getByText("Survival")).toBeInTheDocument();
});
