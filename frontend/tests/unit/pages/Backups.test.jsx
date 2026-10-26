import { render, screen, fireEvent, waitFor } from "../../support/utils";
import Backups from "../../../src/pages/Backups";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as api from "../../support/httpFixtures";

vi.mock("../../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../../support/httpFixtures");
  return createHttpTransport(await importOriginal());
});

const archive = {
  backup_id: "snapshot.bsmbackup",
  filename: "snapshot.bsmbackup",
  size: 1024,
  encrypted: false,
};
const manifest = {
  created_at: "2026-10-19T00:00:00Z",
  source_server: "TestServer",
  source_world: "world",
  bsm_version: "4.0",
  bedrock_version: "1.26",
  components: {
    world: "included",
    "server.properties": "included",
    script_config: "included",
    bsm_settings: "included",
    "allowlist.json": "absent",
  },
};
const results = {
  create: { backup: archive },
  inspect: { backup: { ...archive, manifest } },
  plan: {
    plan: {
      token: "reviewed",
      destinations: { script_config: "config" },
      warnings: ["Replaces secrets"],
      required_bytes: 1024,
      change_counts: { added: 1, replaced: 2, removed: 3 },
      changes: [
        {
          component: "script_config",
          path: "config/permissions.json",
          action: "replaced",
        },
      ],
      setting_changes: [
        {
          component: "server.properties",
          key: "difficulty",
          before: "easy",
          after: "hard",
        },
      ],
    },
  },
  dry_run: {
    plan: {
      token: "dry-reviewed",
      destinations: { world: "worlds/test" },
      warnings: [],
      required_bytes: 1024,
      sufficient_space: true,
      dry_run: true,
      checked_files: 4,
    },
  },
  restore: { status: "success", result: { committed: true } },
};

describe("Backups", () => {
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
      if (url.endsWith("/backups/recovery"))
        return Promise.resolve({ recovery: { active: false } });
      if (url.endsWith("/backups"))
        return Promise.resolve({ backups: [archive] });
      if (url.includes("/backup/list/all"))
        return Promise.resolve({ backups: {} });
      if (url.includes("/api/tasks/status/"))
        return Promise.resolve({
          status: "completed",
          message: "Completed",
          result: results[url.split("/").at(-1)],
        });
      return Promise.resolve({});
    });
    api.post.mockImplementation((url) =>
      Promise.resolve({
        status: "accepted",
        task_id: url.endsWith("/inspect")
          ? "inspect"
          : url.endsWith("/dry-run")
            ? "dry_run"
            : url.endsWith("/plan")
              ? "plan"
              : url.endsWith("/restore")
                ? "restore"
                : "create",
      }),
    );
  });
  it("lists unified archives and labels legacy backups separately", async () => {
    render(<Backups />);
    expect(await screen.findByText("snapshot.bsmbackup")).toBeInTheDocument();
    expect(screen.getByText("Legacy backups")).toBeInTheDocument();
    expect(screen.queryByText("Restore All (Latest)")).not.toBeInTheDocument();
  });
  it("creates one backup using the selected encryption policy", async () => {
    render(<Backups />);
    await screen.findByText("snapshot.bsmbackup");
    fireEvent.change(screen.getByLabelText("Encryption"), {
      target: { value: "encrypted" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create backup" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/server/TestServer/backups", {
        encrypted: true,
        include_packs: null,
      }),
    );
  });
  it("inspects contents, disables absent components, and restores a reviewed selection", async () => {
    render(<Backups />);
    await screen.findByText("snapshot.bsmbackup");
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect", exact: true }),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Inspect", exact: true }).at(-1),
    );
    expect(await screen.findByLabelText(/Allowlist/)).toBeDisabled();
    fireEvent.click(screen.getByLabelText("World"));
    fireEvent.click(screen.getByLabelText("Server properties"));
    fireEvent.click(screen.getByLabelText("BSM server settings"));
    fireEvent.click(screen.getByRole("button", { name: "Review restore" }));
    expect(await screen.findByText("Replaces secrets")).toBeInTheDocument();
    expect(screen.getByText(/A protected safety backup/)).toBeInTheDocument();
    expect(
      screen.getByText("1 added · 2 replaced · 3 removed"),
    ).toBeInTheDocument();
    expect(screen.getByText("difficulty")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Restore", exact: true }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/api/server/TestServer/backups/snapshot.bsmbackup/restore",
        expect.objectContaining({
          components: ["script_config"],
          token: "reviewed",
        }),
      ),
    );
  });

  it("runs an isolated dry run before replacement", async () => {
    render(<Backups />);
    await screen.findByText("snapshot.bsmbackup");
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect", exact: true }),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Inspect", exact: true }).at(-1),
    );
    await screen.findByText("Components to restore");
    fireEvent.click(screen.getByRole("button", { name: "Dry run" }));
    expect(
      await screen.findByText(/Dry run: 4 selected files/),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/restore$/),
      expect.anything(),
    );
  });
  it("groups history by capture date and orders it independently of filenames", async () => {
    api.get.mockImplementation((url) =>
      Promise.resolve(
        url.endsWith("/backups")
          ? {
              backups: [
                {
                  ...archive,
                  backup_id: "z-old.bsmbackup",
                  filename: "z-old.bsmbackup",
                  created_at: "2026-10-01T12:00:00Z",
                },
                {
                  ...archive,
                  backup_id: "a-new.bsmbackup",
                  filename: "a-new.bsmbackup",
                  created_at: "2026-10-19T12:00:00Z",
                },
              ],
            }
          : url.endsWith("/backups/recovery")
            ? { recovery: { active: false } }
            : url.includes("/backup/list/all")
              ? { backups: {} }
              : {},
      ),
    );
    const { container } = render(<Backups />);
    await screen.findByText("a-new.bsmbackup");
    expect(
      [...container.querySelectorAll(".archive-filename")].map(
        (element) => element.textContent,
      ),
    ).toEqual(["a-new.bsmbackup", "z-old.bsmbackup"]);
    expect(container.querySelectorAll(".backup-date-group")).toHaveLength(2);
  });

  it("shows a viewport-bounded inspector with a compact summary", async () => {
    // The workflow tests above exercise selection and restore; this checks the dialog structure.
    api.get.mockImplementation((url) => {
      if (url.endsWith("/backups"))
        return Promise.resolve({ backups: [archive] });
      if (url.includes("/scheduler/schedules"))
        return Promise.resolve({
          schedules: [],
          task_types: ["backup", "verify"],
        });
      return Promise.resolve({});
    });
    localStorage.setItem("selectedServer", "TestServer");
    render(<Backups />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Inspect", exact: true }),
    );
    const dialog = screen.getByRole("dialog", { name: "Inspect backup" });
    expect(dialog).toHaveClass("backup-inspector");
    expect(dialog.querySelector(".dialog-body")).toBeInTheDocument();
    expect(screen.getByText("Capture timings")).toBeInTheDocument();
    for (const input of document.querySelectorAll('input[type="password"]')) {
      expect(input.closest("form")).not.toBeNull();
    }
  });
});
