/** @vitest-environment jsdom */
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ScopeBadge from "../../../src/components/ScopeBadge";

describe("ScopeBadge", () => {
  it("renders with correct data-scope and data-category attributes", () => {
    render(<ScopeBadge scope="servers:lifecycle" />);
    const badge = screen.getByText("servers:lifecycle").closest("li");
    expect(badge).toHaveAttribute("data-scope", "servers:lifecycle");
    expect(badge).toHaveAttribute("data-category", "servers");
    expect(badge).toHaveClass("scope-badge-servers");
  });

  it("renders as a span when requested", () => {
    render(<ScopeBadge as="span" scope="admin" />);
    const badge = screen.getByText("admin").closest("span");
    expect(badge).toHaveAttribute("data-scope", "admin");
    expect(badge).toHaveAttribute("data-category", "admin");
    expect(badge).toHaveClass("scope-badge-admin");
  });

  it("handles missing capability indicator", () => {
    render(<ScopeBadge scope="backups:create" present={false} />);
    const badge = screen.getByText("backups:create").closest("li");
    expect(badge).toHaveClass("ae-capability-missing");
    expect(badge).toHaveAttribute("data-category", "backups");
  });
});
