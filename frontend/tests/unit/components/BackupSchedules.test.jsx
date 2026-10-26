import { render, screen, fireEvent, waitFor } from "../../support/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BackupSchedules from "../../../src/components/BackupSchedules";
import * as api from "../../support/httpFixtures";

vi.mock("../../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../../support/httpFixtures");
  return createHttpTransport(await importOriginal());
});
describe("Backup schedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.request.mockImplementation((url) =>
      Promise.resolve(
        url === "/api/account" ? { username: "test", role: "admin" } : {},
      ),
    );
    api.get.mockResolvedValue({
      schedules: [],
      task_types: ["backup", "verify"],
    });
    api.put.mockResolvedValue({ status: "success", message: "Saved" });
  });
  it("creates a paused verification schedule independently from backups", async () => {
    render(<BackupSchedules serverName="alpha" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Add schedule" }),
    );
    const name = screen.getByLabelText("Name");
    const pattern = new RegExp(`^(?:${name.getAttribute("pattern")})$`, "v");
    expect(pattern.test("backup schedule test")).toBe(true);
    expect(pattern.test("backup/name")).toBe(false);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "backup schedule test" },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Task", exact: true }),
      {
        target: { value: "verify" },
      },
    );
    expect(
      screen.getByRole("combobox", { name: "Server", exact: true }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Enabled")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        "/api/scheduler/schedules/backup-schedule-test",
        expect.objectContaining({
          task: "verify",
          enabled: false,
          server_name: "alpha",
        }),
      ),
    );
  });
});
