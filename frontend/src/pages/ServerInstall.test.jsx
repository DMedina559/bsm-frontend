import { startOperationRecovery } from "../app/operationRecovery";
import { operationCoordinator } from "../app/operationCoordinator";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../app/queryClient";
vi.mock("../AuthContext", () => ({
  useAuth: () => ({ user: { username: "admin" } }),
}));
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import ServerInstall from "./ServerInstall";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as api from "../api";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  refreshServers: vi.fn(),
  setSelectedServer: vi.fn(),
  addToast: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  listeners: new Set(),
  addMessageListener: vi.fn(),
}));
vi.mock("../api");
vi.mock("../DialogContext", () => ({
  useDialog: () => ({ confirmAction: vi.fn() }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("../ToastContext", () => ({ useToast: () => mocks }));
vi.mock("../ServerContext", () => ({ useServer: () => mocks }));
vi.mock("../WebSocketContext", () => ({ useWebSocket: () => mocks }));

describe("ServerInstall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    operationCoordinator.clear();
    mocks.listeners.clear();
    mocks.addMessageListener.mockImplementation((listener) => {
      mocks.listeners.add(listener);
      return () => mocks.listeners.delete(listener);
    });
    mocks.refreshServers.mockResolvedValue();
    api.get.mockImplementation((url) =>
      Promise.resolve(
        url === "/api/downloads/list"
          ? { status: "success", custom_zips: ["custom.zip"] }
          : { id: "install-task", status: "running" },
      ),
    );
    api.post.mockResolvedValue({ status: "accepted", task_id: "install-task" });
  });

  async function submit() {
    fireEvent.change(screen.getByLabelText("Server Name"), {
      target: { value: "NewServer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Install Server/i }));
    await waitFor(() =>
      expect(operationCoordinator.get("install-task")).not.toBeNull(),
    );
  }
  function emit(status, result) {
    act(() => {
      operationCoordinator.reconcileTask({
        type: "task_update",
        data: {
          task_id: "install-task",
          status,
          result,
          message: "Task finished",
        },
      });
    });
  }

  it("renders installation form", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ServerInstall />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Install New Server")).toBeInTheDocument();
  });
  it("handles installation submission", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ServerInstall />
      </QueryClientProvider>,
    );
    await submit();
    expect(api.post).toHaveBeenCalledWith(
      "/api/server/install",
      expect.objectContaining({ server_name: "NewServer" }),
    );
  });
  it.each(["completed", "success"])(
    "advances after a %s socket update",
    async (status) => {
      render(
        <QueryClientProvider client={queryClient}>
          <ServerInstall />
        </QueryClientProvider>,
      );
      await submit();
      emit(status, { status: "success" });
      await waitFor(() =>
        expect(mocks.navigate).toHaveBeenCalledWith("/server-properties", {
          state: { setupFlow: true },
        }),
      );
      expect(mocks.setSelectedServer).toHaveBeenCalledWith("NewServer");
      expect(mocks.refreshServers).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["failed", "cancelled", "error"])(
    "stops monitoring after a %s task",
    async (status) => {
      render(
        <QueryClientProvider client={queryClient}>
          <ServerInstall />
        </QueryClientProvider>,
      );
      await submit();
      emit(status);
      expect(mocks.navigate).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: /Install Server/i }),
      ).toBeEnabled();
      expect(operationCoordinator.get("install-task").terminal).toBe(true);
    },
  );
  it("does not advance when the completed operation was skipped", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ServerInstall />
      </QueryClientProvider>,
    );
    await submit();
    emit("completed", {
      status: "skipped",
      message: "Operation already in progress",
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.addToast).toHaveBeenCalledWith(
      "Installation failed: Operation already in progress",
      "error",
    );
  });
  it("reconciles completion via HTTP even with an active socket", async () => {
    api.get.mockImplementation((url) =>
      Promise.resolve(
        url === "/api/downloads/list"
          ? { status: "success", custom_zips: [] }
          : { status: "completed", result: { status: "success" } },
      ),
    );
    render(
      <QueryClientProvider client={queryClient}>
        <ServerInstall />
      </QueryClientProvider>,
    );
    await submit();
    const stop = startOperationRecovery("admin");
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    stop();
    expect(mocks.refreshServers).toHaveBeenCalledTimes(1);
  });
  it("handles duplicate completion frames once", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ServerInstall />
      </QueryClientProvider>,
    );
    await submit();
    emit("completed");
    emit("completed");
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mocks.refreshServers).toHaveBeenCalledTimes(1);
  });
});
