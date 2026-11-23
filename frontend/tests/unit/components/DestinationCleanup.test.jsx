import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../../src/app/queryClient";
import { DialogProvider } from "../../../src/contexts/DialogContext";
import { ToastProvider } from "../../../src/contexts/ToastContext";
import { render, screen, fireEvent, waitFor } from "../../support/utils";
import DestinationCleanup from "../../../src/components/DestinationCleanup";
import { vi, describe, it, beforeEach, expect } from "vitest";
import * as api from "../../support/httpFixtures";

vi.mock("../../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../../support/httpFixtures");
  return createHttpTransport(await importOriginal());
});

// Keep account bootstrap outside this mutation/polling test. A late authentication
// reset correctly cancels session-scoped work, making the full provider fixture race.
vi.mock("../../../src/contexts/AuthContext", async (importOriginal) => ({
  ...(await importOriginal()),
  useAuth: () => ({
    user: { username: "testuser", role: "admin" },
    loading: false,
    sessionGeneration: 1,
  }),
}));
function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <DialogProvider>{children}</DialogProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("Destination cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ status: "accepted", task_id: "cleanup" });
    api.get.mockImplementation((url) =>
      Promise.resolve(
        url === "/api/tasks/status/cleanup"
          ? {
              id: "cleanup",
              status: "completed",
              result: {
                plan: {
                  token: "reviewed",
                  delete: ["old.bsmbackup"],
                  retain: ["new.bsmbackup"],
                  reclaim_bytes: 1024,
                  warnings: ["Only tracked copies are deleted."],
                  applied: false,
                },
              },
            }
          : {},
      ),
    );
  });
  it("previews without a deletion token and requires confirmation to apply", async () => {
    render(<DestinationCleanup serverName="test" destination="nas" />, {
      wrapper: Providers,
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Preview external cleanup" }),
    );
    // The authenticated preview crosses the HTTP mutation and task-status poll.
    // Allow busy CI workers to finish both before asserting the review result.
    await screen.findByText("old.bsmbackup", {}, { timeout: 10000 });
    expect(api.post).toHaveBeenCalledWith(
      "/api/server/test/backup-destinations/nas/cleanup",
      { token: null },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete reviewed copies" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/api/server/test/backup-destinations/nas/cleanup",
        { token: "reviewed" },
      ),
    );
  }, 15000);
});
