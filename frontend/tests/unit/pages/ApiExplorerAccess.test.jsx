import React from "react";
import { it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import AccessPolicy from "../../../src/features/api-explorer/AccessPolicy";

it("summarizes missing capabilities and keeps the searchable account catalog collapsed", () => {
  render(
    <AccessPolicy
      connected
      policy={{
        classification: "permission",
        required_permissions: ["servers:control", "servers:read"],
        allowed_roles: ["admin", "moderator"],
        resource_scope: "server",
        integration_tokens: "supported",
      }}
      permissions={["servers:read", "account:read", "tasks:read"]}
    />,
  );
  expect(screen.getByText("Permission required")).toBeInTheDocument();
  expect(
    screen.getByText(/1 required capability is missing/),
  ).toBeInTheDocument();
  expect(screen.getByText("One server")).toBeInTheDocument();
  const disclosure = screen
    .getByText("Current account capabilities")
    .closest("details");
  expect(disclosure).not.toHaveAttribute("open");
  fireEvent.click(within(disclosure).getByText("Current account capabilities"));
  fireEvent.change(
    screen.getByRole("textbox", { name: "Search account capabilities" }),
    { target: { value: "tasks:" } },
  );
  expect(within(disclosure).getByText("tasks:read")).toBeInTheDocument();
  expect(
    within(disclosure).queryByText("account:read"),
  ).not.toBeInTheDocument();
  fireEvent.change(
    screen.getByRole("textbox", { name: "Search account capabilities" }),
    { target: { value: "unknown" } },
  );
  expect(
    within(disclosure).getByText("No capabilities match your search."),
  ).toBeInTheDocument();
});

it("does not claim access for unknown or imported contracts", () => {
  const { rerender } = render(
    <AccessPolicy connected policy={{ classification: "unknown" }} />,
  );
  expect(screen.getByText("Access unknown")).toBeInTheDocument();
  expect(
    screen.getByText(/does not declare a complete access policy/),
  ).toBeInTheDocument();
  rerender(
    <AccessPolicy
      policy={{
        classification: "permission",
        required_permissions: ["servers:read"],
      }}
      permissions={["servers:read"]}
    />,
  );
  expect(screen.getByText(/Imported contract/)).toBeInTheDocument();
  expect(
    screen.queryByText("Your account has the required capabilities.", {
      exact: false,
    }),
  ).not.toBeInTheDocument();
});
