import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import RuntimeDiagnostics from "../../../../src/components/diagnostics/RuntimeDiagnostics";
import { application } from "../../../../src/app/application";
import { runtimeHistory } from "../../../../src/app/runtimeHistoryStore";
afterEach(() => {
  cleanup();
  runtimeHistory.close();
});
it("filters retained observations, inspects metadata and clears history", () => {
  runtimeHistory.open("runtime-ui");
  application.diagnostics.setEnabled(true);
  application.diagnostics.record("rejected", { reason: "invalid-task" });
  application.diagnostics.record("refresh", {
    reason: "recovery-or-event",
    family: "servers",
  });
  render(
    <MemoryRouter>
      <RuntimeDiagnostics />
    </MemoryRouter>,
  );
  expect(screen.getByText("Recording", { exact: true })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Observation", { exact: true }), {
    target: { value: "rejected" },
  });
  expect(
    screen.queryByRole("button", { name: "Inspect refresh observation" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Inspect rejected observation" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Frontend observation" }),
  ).toHaveTextContent("invalid-task");
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
  expect(
    screen.getByText(/Waiting for frontend observations/),
  ).toBeInTheDocument();
  expect(runtimeHistory.getSnapshot().events).toEqual([]);
});
