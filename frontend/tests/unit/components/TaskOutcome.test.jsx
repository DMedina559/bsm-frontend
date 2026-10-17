import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import TaskOutcome from "../../../src/components/TaskOutcome";

it.each(["partial", "skipped"])(
  "explains %s outcomes and preserves item details",
  (status) => {
    render(
      <TaskOutcome
        result={{
          status,
          details: {
            properties: { outcome: "skipped", reason: "Missing backup" },
          },
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      status === "partial" ? "partially completed" : "skipped",
    );
    expect(screen.getByText("Missing backup")).toBeInTheDocument();
  },
);
