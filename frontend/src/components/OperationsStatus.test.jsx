import { render, screen, fireEvent } from "@testing-library/react";
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
