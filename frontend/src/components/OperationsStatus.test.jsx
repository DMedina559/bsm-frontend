import { render, screen, fireEvent, within } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import OperationsStatus from "./OperationsStatus";
import { operationCoordinator } from "../app/operationCoordinator";
beforeEach(() => operationCoordinator.clear());
it("keeps operation details in a dismissible dialog", () => {
  operationCoordinator.register({
    id: "job",
    kind: "backup",
    serverName: "Test",
  });
  render(<OperationsStatus />);
  const button = screen.getByRole("button", {
    name: "1 active operation. View operations",
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  button.focus();
  fireEvent.click(button);
  expect(
    screen.getByRole("dialog", { name: "Operations" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Test: backup")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Dismiss backup/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(button).toHaveFocus();
});

it("shows authoritative task messages and structured outcomes", () => {
  operationCoordinator.register({ id: "job", kind: "update" });
  operationCoordinator.reconcileTask({
    type: "task_update",
    data: {
      id: "job",
      status: "completed",
      message: "Task completed.",
      result: { message: "Server updated successfully.", version: "1.2.3" },
    },
  });
  render(<OperationsStatus />);
  fireEvent.click(screen.getByRole("button", { name: /View operations/ }));
  expect(screen.getByText("Task completed.")).toBeInTheDocument();
  expect(screen.getByText("Server updated successfully.")).toBeInTheDocument();
  expect(screen.getByText("View task outcome")).toBeInTheDocument();
  expect(screen.getByText(/"version": "1.2.3"/)).toBeInTheDocument();
});
it.each([false, 0, "Backup created"])("shows a scalar outcome %s", (result) => {
  operationCoordinator.register({ id: "job", kind: "backup" });
  operationCoordinator.reconcileTask({
    type: "task_update",
    data: {
      id: "job",
      status: "completed",
      result,
    },
  });
  render(<OperationsStatus />);
  fireEvent.click(screen.getByRole("button", { name: /View operations/ }));
  expect(
    within(screen.getByRole("dialog")).getByText(
      result === false ? "No" : String(result),
      {
        selector: "span",
      },
    ),
  ).toBeInTheDocument();
});
