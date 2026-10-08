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
      expect(mocks.subscribe).toHaveBeenCalledWith("task:install-task"),
    );
  }
  function emit(status, result) {
    act(() => {
      for (const listener of mocks.listeners) {
        listener({
          type: "task_update",
          topic: "task:install-task",
          data: { status, result, message: "Task finished" },
        });
      }
    });
  }

  it("renders installation form", () => {
    render(<ServerInstall />);
    expect(screen.getByText("Install New Server")).toBeInTheDocument();
  });
  it("handles installation submission", async () => {
    render(<ServerInstall />);
    await submit();
    expect(api.post).toHaveBeenCalledWith(
      "/api/server/install",
      expect.objectContaining({ server_name: "NewServer" }),
    );
  });
  it.each(["completed", "success"])(
    "advances after a %s socket update",
    async (status) => {
      render(<ServerInstall />);
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
      render(<ServerInstall />);
      await submit();
      emit(status);
      expect(mocks.navigate).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: /Install Server/i }),
      ).toBeEnabled();
      expect(mocks.unsubscribe).toHaveBeenCalledWith("task:install-task");
    },
  );
  it("does not advance when the completed operation was skipped", async () => {
    render(<ServerInstall />);
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
    render(<ServerInstall />);
    await submit();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mocks.refreshServers).toHaveBeenCalledTimes(1);
  });
  it("handles duplicate completion frames once", async () => {
    render(<ServerInstall />);
    await submit();
    act(() => {
      for (const listener of mocks.listeners) {
        const message = {
          type: "task_update",
          topic: "task:install-task",
          data: { status: "completed" },
        };
        listener(message);
        listener(message);
      }
    });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mocks.refreshServers).toHaveBeenCalledTimes(1);
  });
});
