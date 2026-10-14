import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ApplicationMonitor from "./ApplicationMonitor";
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
const query = vi.hoisted(() => ({
  data: {
    latest: {
      timestamp: 100,
      app_cpu_percent: 250,
      app_ram_mb: 64,
      asyncio_task_count: 4,
      loop_lag_ms: 0,
      servers: [
        { server_name: "Test", pid: null, cpu_percent: null, memory_mb: null },
      ],
    },
    history: [],
    history_limit: 180,
    interval_seconds: 3,
  },
  isLive: true,
  refetch: vi.fn(),
}));
vi.mock("../app/useApplicationMetrics", () => ({
  useApplicationMetrics: () => query,
}));
it("renders application metrics and separates unavailable process readings from zero", () => {
  render(<ApplicationMonitor />);
  expect(
    screen.getByRole("heading", { name: "Application monitor" }),
  ).toBeInTheDocument();
  expect(screen.getByText("250.0%")).toBeInTheDocument();
  expect(screen.getByText("0.0 ms")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Bedrock processes", exact: true }),
  );
  expect(screen.getByRole("row", { name: /Test/ })).toHaveTextContent(
    "Test———",
  );
  fireEvent.click(screen.getByRole("button", { name: "Host", exact: true }));
  expect(
    screen.getByRole("region", { name: "Network throughput" }),
  ).toBeInTheDocument();
});

it("freezes displayed observations while paused and resumes current data", () => {
  const view = render(<ApplicationMonitor />);
  fireEvent.click(screen.getByRole("button", { name: "Pause updates" }));
  query.data = {
    ...query.data,
    latest: { ...query.data.latest, app_cpu_percent: 400 },
  };
  view.rerender(<ApplicationMonitor />);
  expect(screen.getByText("250.0%")).toBeInTheDocument();
  expect(screen.queryByText("400.0%")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Resume updates" }));
  expect(screen.getByText("400.0%")).toBeInTheDocument();
  query.data.latest.app_cpu_percent = 250;
});
