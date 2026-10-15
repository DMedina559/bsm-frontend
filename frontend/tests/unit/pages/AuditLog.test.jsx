import { assertApiResponse } from "../../support/apiContract";
import { render, screen, waitFor } from "../../support/utils";
import { fireEvent } from "@testing-library/react";
import AuditLog from "../../../src/pages/AuditLog";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as api from "../../support/httpFixtures";
import { fixtureResponse } from "../../support/fixtures";
vi.mock("../../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../../support/httpFixtures");
  return createHttpTransport(await importOriginal());
});
describe("AuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) =>
      Promise.resolve(fixtureResponse(new URL(url, "http://bsm.test"))),
    );
  });
  it("renders the backend audit list", async () => {
    render(<AuditLog />);
    expect(await screen.findByText("server.start")).toBeInTheDocument();
    expect(
      screen.getByText("Survival", { selector: "span" }),
    ).toBeInTheDocument();
  });
  it("loads application log history when the tab opens", async () => {
    render(<AuditLog />);
    fireEvent.click(screen.getByRole("button", { name: /App Log/ }));
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        "/api/logs/history?topic=app_log",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });
  it("renders current task statuses and structured failure messages", async () => {
    const tasks = [
      {
        id: "task-1",
        status: "failed",
        message: "Restore failed.",
        result: null,
        error: {
          code: "not_found",
          message: "Backup file is unavailable.",
          details: {},
        },
      },
    ];
    assertApiResponse("GET", "/api/tasks/list", tasks);
    api.get.mockImplementation((url) =>
      Promise.resolve(
        url === "/api/tasks/list"
          ? tasks
          : fixtureResponse(new URL(url, "http://bsm.test")),
      ),
    );
    render(<AuditLog />);
    fireEvent.click(screen.getByRole("button", { name: "Background Tasks" }));
    const status = await screen.findByText("FAILED");
    expect(status).toHaveClass("status-stopped");
    expect(screen.getByText("Backup file is unavailable.")).toBeInTheDocument();
  });
});
