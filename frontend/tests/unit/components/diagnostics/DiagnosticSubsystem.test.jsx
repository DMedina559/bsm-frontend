import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import DiagnosticSubsystem from "../../../../src/components/diagnostics/DiagnosticSubsystem";

const plugins = {
  name: "plugins",
  owner: "application",
  status: "ok",
  age_seconds: 0,
  data: {
    kind: "plugins",
    total: 2,
    plugins: [
      {
        name: "unresolved_plugin",
        status: "UNKNOWN",
        version: "1.0",
        active_tasks: 0,
        managed_tasks: 0,
        listeners: 0,
        workers: 0,
        diagnostic_providers: 0,
        generation: 0,
        last_transition_at: null,
        last_drain_duration_ms: null,
      },
      {
        name: "loaded_plugin",
        status: "LOADED",
        active_tasks: 2,
        version: "2.0",
      },
    ],
  },
};
it("preserves unresolved plugin status, searches and selects known runtime observations", () => {
  render(<DiagnosticSubsystem item={plugins} />);
  expect(screen.getByText("Status not reported")).toBeInTheDocument();
  expect(
    screen.getByText(/could not resolve a runtime status/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText("Lifecycle details"));
  expect(screen.getByText("No drain measurement recorded")).toBeVisible();
  expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search plugins" }), {
    target: { value: "loaded_plugin" },
  });
  expect(
    screen.getByRole("region", { name: "loaded_plugin plugin details" }),
  ).toHaveTextContent("Loaded");
  expect(
    screen.queryByRole("region", { name: "unresolved_plugin plugin details" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "missing" },
  });
  expect(screen.getByText("No plugins match your search.")).toBeInTheDocument();
});
it("uses pending queue observations rather than connected clients for transport capacity", () => {
  render(
    <DiagnosticSubsystem
      item={{
        name: "transport",
        owner: "application",
        status: "ok",
        data: {
          kind: "transport",
          connected_clients: 1,
          max_pending_per_client: 0,
          queue_limit_per_client: 64,
          successful_sends: 0,
        },
      }}
    />,
  );
  expect(
    screen.getByRole("progressbar", {
      name: "Maximum pending sends per client",
    }),
  ).toHaveAttribute("value", "0");
  expect(screen.getByText("0 / 64")).toBeInTheDocument();
  const metric = within(screen.getByLabelText("Transport summary")).getByText(
    "Successful sends",
  ).parentElement;
  expect(within(metric).getByText("0")).toBeInTheDocument();
});
it("does not present unobserved process counts as measured zero", () => {
  render(
    <DiagnosticSubsystem
      item={{
        name: "processes",
        owner: "application",
        status: "unknown",
        data: {
          kind: "processes",
          registered: 2,
          observed_running: 0,
          observation_available: false,
        },
      }}
    />,
  );
  expect(
    within(
      within(screen.getByLabelText("Processes summary")).getByText(
        "Observed running",
      ).parentElement,
    ).getByText("Not reported"),
  ).toBeInTheDocument();
  expect(screen.getByText("Not assessed")).toBeInTheDocument();
});
