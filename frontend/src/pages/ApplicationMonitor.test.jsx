import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ApplicationMonitor from "./ApplicationMonitor";
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
    screen.getByRole("heading", { name: "Application Monitor" }),
  ).toBeInTheDocument();
  expect(screen.getByText("250.0%")).toBeInTheDocument();
  expect(screen.getByText("0.0 ms")).toBeInTheDocument();
  expect(screen.getByRole("row", { name: /Test/ })).toHaveTextContent(
    "Test———",
  );
  expect(
    screen.getByRole("region", { name: "Network throughput" }),
  ).toBeInTheDocument();
});
