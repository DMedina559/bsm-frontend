import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LogViewer from "./LogViewer";
import { get } from "../test/httpFixtures";

const auth = vi.hoisted(() => ({ identity: 1, generation: 0 }));
const socket = vi.hoisted(() => ({
  listener: null,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  addMessageListener: vi.fn(),
}));
vi.mock("../api", async (importOriginal) => {
  const { createHttpTransport, configureHttpFixtures } =
    await import("../test/httpFixtures");
  const fixtures = { get: vi.fn(), request: vi.fn() };
  configureHttpFixtures(fixtures);
  return createHttpTransport(await importOriginal());
});
vi.mock("../AuthContext", () => ({
  useAuth: () => ({
    user: auth.identity === null ? null : { id: auth.identity },
    sessionGeneration: auth.generation,
  }),
}));
vi.mock("../WebSocketContext", () => ({
  useWebSocket: () => ({ isConnected: true, ...socket }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  auth.identity = 1;
  auth.generation = 0;
  socket.addMessageListener.mockImplementation((listener) => {
    socket.listener = listener;
    return () => {
      socket.listener = null;
    };
  });
});

const tail = {
  data: "recent\n",
  start: 6,
  end: 13,
  file_id: "file-1",
  has_more: true,
};

describe("LogViewer", () => {
  it("loads older text as the user scrolls up, preserves the anchor and continues live updates", async () => {
    get.mockResolvedValueOnce(tail).mockResolvedValueOnce({
      data: "older\n",
      start: 0,
      end: 6,
      file_id: "file-1",
      has_more: false,
    });
    render(<LogViewer topic="app_log" />);
    await screen.findByText("recent");
    const region = screen.getByRole("region", { name: "Log output" });
    Object.defineProperty(region, "scrollHeight", {
      configurable: true,
      get: () => (region.textContent.includes("older") ? 600 : 300),
    });
    Object.defineProperty(region, "clientHeight", {
      configurable: true,
      value: 100,
    });
    region.scrollTop = 0;
    fireEvent.scroll(region);
    await waitFor(() => expect(region.textContent).toBe("older\nrecent\n"));
    expect(region.scrollTop).toBe(300);
    expect(get.mock.calls[1][0]).toContain("before=6&file_id=file-1");
    act(() =>
      socket.listener({
        type: "log_update",
        topic: "app_log",
        data: "new\n",
        start: 13,
        end: 17,
        file_id: "file-1",
      }),
    );
    expect(region.textContent).toBe("older\nrecent\nnew\n");
    expect(region.scrollTop).toBe(300);
    expect(
      screen.queryByRole("button", { name: "Load older entries" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Follow live" }));
    expect(region.scrollTop).toBe(600);
  });

  it("merges overlapping live frames without repeating text or splitting Unicode", async () => {
    get.mockResolvedValue({
      data: "🌍\n",
      start: 0,
      end: 5,
      file_id: "file-1",
      has_more: false,
    });
    render(<LogViewer topic="app_log" />);
    await screen.findByText("🌍");
    act(() =>
      socket.listener({
        type: "log_update",
        topic: "app_log",
        data: "🌍\nnext\n",
        start: 0,
        end: 10,
        file_id: "file-1",
      }),
    );
    expect(screen.getByRole("region").textContent).toBe("🌍\nnext\n");
  });

  it("ignores history responses from a previously selected server", async () => {
    let resolveOld;
    get
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce({ ...tail, data: "new server\n" });
    const view = render(<LogViewer topic="server_log:old" />);
    view.rerender(<LogViewer topic="server_log:new" />);
    await screen.findByText("new server");
    await act(async () => resolveOld({ ...tail, data: "old server\n" }));
    expect(screen.getByRole("region").textContent).toBe("new server\n");
    expect(socket.unsubscribe).toHaveBeenCalledWith("server_log:old");
  });

  it("allows retrying a failed history request", async () => {
    get
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce(tail);
    render(<LogViewer topic="app_log" />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Reload log" }));
    await screen.findByText("recent");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

it("cancels session reads and clears private history on sign-out", async () => {
  get.mockResolvedValue(tail);
  const view = render(<LogViewer topic="app_log" />);
  await screen.findByText("recent");
  const signal = get.mock.calls[0][1].signal;
  auth.identity = null;
  auth.generation += 1;
  view.rerender(<LogViewer topic="app_log" />);
  expect(signal.aborted).toBe(true);
  expect(socket.unsubscribe).toHaveBeenCalledWith("app_log");
  expect(screen.getByRole("region").textContent).toBe("Waiting for logs...");
  act(() =>
    socket.listener({
      type: "log_update",
      topic: "app_log",
      data: "private data",
    }),
  );
  expect(screen.getByRole("region").textContent).not.toContain("private data");
  expect(get).toHaveBeenCalledTimes(1);
});
