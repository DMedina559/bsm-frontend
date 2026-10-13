import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import ApplicationMonitor from "../../pages/ApplicationMonitor";
import { sessionRuntime } from "../../app/sessionRuntime";

const fixtures = vi.hoisted(() => ({
  user: { username: "admin", role: "admin" },
  calls: [],
  failure: false,
}));
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: fixtures.user, sessionGeneration: 0 }),
}));
vi.mock("../../app/useApplicationMetrics", () => ({
  useApplicationMetrics: () => ({ data: null, refetch: vi.fn() }),
}));
vi.mock("../../api/operations", () => ({
  callOperation: vi.fn(async (id, options) => {
    fixtures.calls.push([id, options]);
    if (id === "get_application_diagnostics") {
      if (fixtures.failure) throw new Error("Backend unreachable");
      return snapshot();
    }
    if (id === "get_diagnostic_runs")
      return { available: true, runs: [], truncated: false };
    if (id === "get_diagnostic_history")
      return {
        available: true,
        records: options.query.cursor
          ? []
          : [
              {
                id: "r",
                timestamp: 100,
                subsystem: "events",
                operation: "listener",
                outcome: "failed",
                correlation_id: "trace",
              },
            ],
        next_cursor: options.query.cursor ? null : "next",
        truncated: true,
      };
    if (id === "get_diagnostic_trace")
      return {
        events: null,
        events_available: false,
        tasks: [],
        tasks_available: true,
        history: { available: true, records: [] },
        truncated: true,
        issues: [],
      };
    if (id === "compare_diagnostic_snapshots")
      return { same_instance: false, changes: [], truncated: false };
    if (id === "get_diagnostic_report")
      return {
        report_id: "report",
        snapshot: snapshot(),
        history: { records: [] },
      };
  }),
}));
function snapshot() {
  return {
    instance_id: "instance",
    snapshot_id: "snapshot",
    collected_at: 100,
    summary: { status: "degraded", ready: true, findings: [] },
    sections: [
      {
        name: "events",
        owner: "application",
        status: "unavailable",
        stale: true,
        age_seconds: 5,
        data: null,
        last_success_at: null,
        issues: [],
      },
    ],
    recent: { failures: 0, timeouts: 0 },
    collection: { status: "ok" },
    persistence: { queued: 0 },
    registry: { registered: 9 },
    environment: { backend_version: "4.0" },
  };
}
beforeEach(() => {
  fixtures.user = { username: "admin", role: "admin" };
  fixtures.calls = [];
  fixtures.failure = false;
});
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ApplicationMonitor />
    </QueryClientProvider>,
  );
}
async function open() {
  fireEvent.click(screen.getByRole("tab", { name: "Diagnostics" }));
  await screen.findByText("Ready");
}
it("mounts diagnostics only for admins and supports keyboard tab navigation", async () => {
  const view = mount();
  expect(fixtures.calls).toHaveLength(0);
  const metricTab = screen.getByRole("tab", { name: "Metrics", exact: true });
  metricTab.focus();
  fireEvent.keyDown(metricTab, { key: "ArrowRight" });
  await screen.findByText("Ready");
  expect(screen.getByRole("tab", { name: "Diagnostics" })).toHaveFocus();
  expect(
    screen.getByRole("region", { name: "Events diagnostics" }),
  ).toHaveTextContent("Stale reading");
  fixtures.user = { username: "admin", role: "user" };
  view.rerender(
    <QueryClientProvider client={new QueryClient()}>
      <ApplicationMonitor />
    </QueryClientProvider>,
  );
  expect(
    screen.queryByRole("tab", { name: "Diagnostics" }),
  ).not.toBeInTheDocument();
});
it("retains observations on fetch failures, pages history and inspects partial traces", async () => {
  mount();
  await open();
  await screen.findByRole("button", { name: "Next page" });
  fireEvent.click(
    screen
      .getAllByRole("button", { name: "Inspect trace", exact: true })
      .find((button) => !button.disabled),
  );
  await screen.findByText(/Events: unavailable/);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByText("No matching retained records.");
  expect(
    fixtures.calls.some(
      ([id, options]) =>
        id === "get_diagnostic_history" && options.query.cursor === "next",
    ),
  ).toBe(true);
  fixtures.failure = true;
  fireEvent.click(screen.getByRole("button", { name: "Refresh observations" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Ready")).toBeInTheDocument();
});
it("compares saved observations and downloads a report without persisting it", async () => {
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:report"),
      revokeObjectURL: vi.fn(),
    }),
  );
  mount();
  await open();
  fireEvent.click(
    screen.getByRole("button", { name: "Save comparison baseline" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Compare with baseline" }),
  );
  await screen.findByText(/Application instance changed/);
  fireEvent.click(
    screen.getByRole("button", { name: "Download support report" }),
  );
  await waitFor(() => expect(click).toHaveBeenCalled());
  click.mockRestore();
  expect(
    fixtures.calls.find(([id]) => id === "compare_diagnostic_snapshots")[1].body
      .before.snapshot_id,
  ).toBe("snapshot");
});
it("drops an in-flight report after the session changes", async () => {
  const { callOperation } = await import("../../api/operations");
  let resolve;
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  mount();
  await open();
  callOperation.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Download support report" }),
  );
  await waitFor(() => expect(resolve).toBeTypeOf("function"));
  act(() => sessionRuntime.reset());
  await act(async () => resolve({ report_id: "old", snapshot: snapshot() }));
  expect(click).not.toHaveBeenCalled();
  click.mockRestore();
});
