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

it("pages through bounded audit requests and returns to the newest page", async () => {
  api.get.mockImplementation((url) => {
    const parsed = new URL(url, "http://bsm.test");
    if (parsed.pathname === "/audit-log/list") {
      const offset = Number(parsed.searchParams.get("offset") ?? 0);
      const length = offset === 0 ? 101 : 2;
      return Promise.resolve(
        Array.from({ length }, (_, index) => ({
          id: 1000 - offset - index,
          action: `event-${offset + index}`,
          user_id: 1,
          timestamp: "2026-10-31T12:00:00Z",
          details: {},
        })),
      );
    }
    return Promise.resolve(fixtureResponse(parsed));
  });
  render(<AuditLog />);
  await screen.findByText("event-0");
  expect(screen.queryByText("event-100")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Newer events" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Older events" }));
  await screen.findByText("event-100");
  expect(screen.queryByText("event-0")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Older events" })).toBeDisabled();
  expect(api.get).toHaveBeenCalledWith(
    "/audit-log/list?limit=101&offset=100",
    expect.anything(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Newer events" }));
  await screen.findByText("event-0");
});
