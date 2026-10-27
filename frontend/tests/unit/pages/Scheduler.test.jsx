import { render, screen } from "../../support/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Scheduler from "../../../src/pages/Scheduler";
import * as api from "../../support/httpFixtures";

vi.mock("../../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../../support/httpFixtures");
  return createHttpTransport(await importOriginal());
});
describe("Scheduler page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.request.mockImplementation((url) =>
      Promise.resolve(
        url === "/api/account" ? { username: "test", role: "admin" } : {},
      ),
    );
    api.get.mockImplementation((url) =>
      Promise.resolve(
        url.includes("/scheduler/schedules")
          ? { schedules: [], task_types: ["backup", "verify"] }
          : { servers: [{ name: "alpha" }] },
      ),
    );
  });
  it("provides fleet-wide scheduling independently of the backup archive list", async () => {
    render(<Scheduler />);
    expect(
      await screen.findByRole("heading", { name: "Scheduler", exact: true }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Show server")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Add schedule" }),
    ).toBeInTheDocument();
  });
});
