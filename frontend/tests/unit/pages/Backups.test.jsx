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
      }),
    );
  });
  it("inspects contents, disables absent components, and restores a reviewed selection", async () => {
    render(<Backups />);
    await screen.findByText("snapshot.bsmbackup");
    fireEvent.click(screen.getByRole("button", { name: /Inspect \/ restore/ }));
    fireEvent.click(screen.getByRole("button", { name: "Unlock and inspect" }));
    expect(await screen.findByLabelText(/Allowlist/)).toBeDisabled();
    fireEvent.click(screen.getByLabelText("World"));
    fireEvent.click(screen.getByLabelText("Server properties"));
    fireEvent.click(screen.getByLabelText("BSM server settings"));
    fireEvent.click(screen.getByRole("button", { name: "Review restore" }));
    expect(await screen.findByText("Replaces secrets")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Restore selected components" }),
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
});
