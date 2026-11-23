import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import DiagnosticActivity from "../../../../src/components/diagnostics/DiagnosticActivity";
const fixtures = vi.hoisted(() => ({ query: {}, calls: [] }));
vi.mock("../../../../src/app/resourceQueries", () => ({
  useResourceQuery: (...args) => {
    fixtures.calls.push(args);
    return fixtures.query;
  },
}));
beforeEach(() => {
  fixtures.calls = [];
  fixtures.query = {
    refetch: vi.fn(),
    data: {
      scope: "application",
      events: {
        active: [],
        recent: [
          {
            event_id: "event",
            operation_id: "op",
            name: "before_server_start",
            status: "completed",
            correlation_id: "trace",
          },
        ],
      },
      operations: {
        active: [],
        recent: [
          {
            operation_id: "op",
            name: "server.start",
            status: "finished",
            outcome: "started",
            correlation_id: "trace",
            parent_operation_id: "root",
          },
        ],
      },
      subscriptions: {
        total: 1,
        truncated: false,
        items: [
          {
            listener_id: "plugin:listener",
            owner: "plugin:example",
            name: "before_server_start",
            priority: 100,
            unresolved_after: ["other:missing"],
          },
        ],
      },
      truncated: true,
    },
  };
});
it("shows global activity, listener details, partial views and trace navigation", () => {
  const onTrace = vi.fn();
  render(<DiagnosticActivity onTrace={onTrace} />);
  expect(
    screen.getByText(/Activity across all execution chains/),
  ).toBeInTheDocument();
  expect(screen.getByText(/This view is partial/)).toBeInTheDocument();
  expect(
    screen.getByText(/server.start · Application · finished/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/plugin:listener · plugin:example/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Inspect trace" })[0]);
  expect(onTrace).toHaveBeenCalledWith("trace");
  fireEvent.change(screen.getByLabelText("Server"), {
    target: { value: "alpha" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(fixtures.calls.at(-1)[1]).toEqual({
    server_name: "alpha",
    limit: 100,
  });
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(fixtures.calls.at(-1)[1]).toEqual({ limit: 100 });
});
it("keeps source unavailability distinct from empty activity", () => {
  fixtures.query.data = {
    ...fixtures.query.data,
    events: null,
    operations: null,
    subscriptions: null,
  };
  render(<DiagnosticActivity onTrace={vi.fn()} />);
  expect(
    screen.getByText("Event observations are unavailable."),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Operation observations are unavailable."),
  ).toBeInTheDocument();
});
it("provides a useful message when an older backend cannot load activity", () => {
  fixtures.query = {
    error: new Error("Unknown API operation"),
    refetch: vi.fn(),
  };
  render(<DiagnosticActivity onTrace={vi.fn()} />);
  expect(
    screen.getByText(/Older backends may not provide global activity/),
  ).toBeInTheDocument();
});
