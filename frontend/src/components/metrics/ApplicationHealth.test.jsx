import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ApplicationHealth from "./ApplicationHealth";
const query = vi.hoisted(() => ({
  data: {
    health: "degraded",
    checked_at: 100,
    checks: {
      database: { healthy: true, message: "Database reachable" },
      metrics: { healthy: false, message: "Metrics sampler stopped or stale" },
    },
  },
  isPending: false,
  refetch: vi.fn(),
  error: null,
}));
vi.mock("../../app/resourceQueries", () => ({ useResourceQuery: () => query }));
it("opens individual health checks, refreshes, and closes with Escape", () => {
  render(<ApplicationHealth />);
  const summary = screen.getByLabelText("Application health: Degraded");
  fireEvent.click(summary);
  expect(screen.getByText("Database reachable")).toBeVisible();
  expect(screen.getByText("Metrics sampler stopped or stale")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Check again" }));
  expect(query.refetch).toHaveBeenCalled();
  fireEvent.keyDown(summary, { key: "Escape" });
  expect(summary.closest("details").open).toBe(false);
  expect(summary).toHaveFocus();
});
