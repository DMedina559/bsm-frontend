import { TimeContext } from "../../../src/contexts/TimeContext";
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
      task_types: ["backup:create", "backup:verify", "server:send_command"],
      task_definitions: {
        "backup:create": {
          description: "Create a scheduled server snapshot archive.",
          options_schema: { type: "object", properties: {} },
        },
        "backup:verify": {
          description:
            "Verify snapshot archive integrity for backups older than minimum_age_hours.",
          options_schema: {
            type: "object",
            properties: {
              minimum_age_hours: { type: "integer", default: 168 },
            },
          },
        },
        "server:send_command": {
          description: "Send a console command to a running Bedrock server.",
          options_schema: {
            type: "object",
            required: ["command"],
            properties: {
              command: { type: "string", description: "Command to execute" },
            },
          },
        },
      },
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
        target: { value: "backup:verify" },
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
          task: "backup:verify",
          enabled: false,
          server_name: "alpha",
        }),
      ),
    );
  });
  it("renders dynamic options from task_definitions for built-in and plugin tasks", async () => {
    render(<BackupSchedules serverName="alpha" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Add schedule" }),
    );
    await screen.findByRole("option", { name: "Send console command" });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Task", exact: true }),
      {
        target: { value: "server:send_command" },
      },
    );
    expect(
      await screen.findByText(
        "Send a console command to a running Bedrock server.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("command"), {
      target: { value: "say Hello" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "announce" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        "/api/scheduler/schedules/announce",
        expect.objectContaining({
          task: "server:send_command",
          options: { command: "say Hello" },
        }),
      ),
    );
  });
  it("shows the rejected API field when saving fails validation", async () => {
    api.put.mockRejectedValue({
      message: "API data failed validation.",
      details: {
        errors: [
          { location: ["body", "time"], code: "string_pattern_mismatch" },
        ],
      },
    });
    render(<BackupSchedules serverName="alpha" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Add schedule" }),
    );
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "backup-test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    expect(
      await screen.findByText(/body.time: string_pattern_mismatch/),
    ).toBeInTheDocument();
  });
  it("pauses a schedule with the listed configuration revision", async () => {
    api.get.mockResolvedValue({
      schedules: [
        {
          schedule_id: "nightly",
          configuration: {
            task: "backup:verify",
            server_name: "alpha",
            enabled: true,
            time: "03:00",
            timezone: "UTC",
          },
          available: true,
          revision: "current",
          runs: [],
        },
      ],
      task_types: ["backup:create", "backup:verify"],
    });
    api.post.mockResolvedValue({ status: "success" });
    render(<BackupSchedules serverName="alpha" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Pause", exact: true }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/api/scheduler/schedules/nightly/action",
        { action: "pause", revision: "current" },
      ),
    );
  });
  it("shows pending retries independently of the next calendar occurrence", async () => {
    api.get.mockResolvedValue({
      schedules: [
        {
          schedule_id: "nightly",
          configuration: {
            task: "backup:verify",
            server_name: "alpha",
            enabled: true,
            time: "03:00",
            timezone: "UTC",
          },
          available: true,
          revision: "current",
          last_status: "failed",
          next_run_at: "2026-10-28T03:00:00Z",
          next_attempt_at: "2026-10-27T03:02:00Z",
          retry_exhausted: true,
          blocked_reason: "retry_exhausted",
          runs: [],
        },
      ],
      task_types: ["backup:create", "backup:verify"],
    });
    const { container } = render(
      <TimeContext.Provider value={{ timezone: "America/Los_Angeles" }}>
        <BackupSchedules serverName="alpha" />
      </TimeContext.Provider>,
    );
    expect(
      await screen.findByText(/Automatic retries exhausted/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry now", exact: true }),
    ).toBeInTheDocument();
    const timestamps = [...container.querySelectorAll("time.timestamp")];
    expect(timestamps).toHaveLength(2);
    expect(timestamps.every((node) => node.textContent.includes("PDT"))).toBe(
      true,
    );
    expect(screen.getByText("UTC", { exact: true })).toBeVisible();
  });
});

it("offers Pacific Time as a regional timezone instead of PDT", async () => {
  api.request.mockImplementation((url) =>
    Promise.resolve(
      url === "/api/account" ? { username: "test", role: "admin" } : {},
    ),
  );
  api.get.mockResolvedValue({
    schedules: [],
    task_types: ["backup:create", "backup:verify"],
    timezones: ["UTC", "America/Los_Angeles"],
    timezone_database_available: true,
  });
  render(<BackupSchedules serverName="alpha" />);
  fireEvent.click(await screen.findByRole("button", { name: "Add schedule" }));
  const select = screen.getByRole("combobox", {
    name: "Timezone",
    exact: true,
  });
  fireEvent.change(select, { target: { value: "America/Los_Angeles" } });
  expect(select).toHaveValue("America/Los_Angeles");
  expect(
    screen.getByRole("option", { name: "Pacific Time (America/Los_Angeles)" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: "PDT", exact: true }),
  ).not.toBeInTheDocument();
});
