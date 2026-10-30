import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  DataView,
  SchemaView,
  SchemaField,
} from "../../../src/features/api-explorer/views";
import backend from "../../../../packages/api-client/src/generated/openapi.json";

describe("Structured API explorer views", () => {
  it("bounds and filters large primitive arrays", () => {
    render(
      <DataView
        value={Array.from({ length: 600 }, (_, index) => `Timezone-${index}`)}
      />,
    );
    expect(screen.getByText("Timezone-0")).toBeInTheDocument();
    expect(screen.queryByText("Timezone-25")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Timezone-25")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter response items"), {
      target: { value: "Timezone-599" },
    });
    expect(screen.getByText("Timezone-599")).toBeInTheDocument();
    expect(screen.queryByText("Timezone-25")).not.toBeInTheDocument();
  });
  it("renders object collections as tables with typed cells", () => {
    render(
      <DataView
        value={[
          { name: "survival", online: false, players: 0 },
          { name: "creative", online: true, players: 3 },
        ]}
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "name" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("survival", { selector: "td > span" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("false", { selector: "td > span" }),
    ).toBeInTheDocument();
  });
  it("presents schema fields, required markers, defaults and navigable model references", () => {
    const onModel = vi.fn();
    render(
      <SchemaView
        schema={backend}
        value={backend.components.schemas.SettingsResponse}
        onModel={onModel}
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "Property" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("status", { selector: "code" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("required").length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: "SettingItemPayload", exact: true }),
    );
    expect(onModel).toHaveBeenCalledWith("SettingItemPayload");
  });
  it("keeps recursive models bounded", () => {
    const recursive = {
      components: {
        schemas: {
          Node: {
            anyOf: [
              { type: "string" },
              { type: "array", items: { $ref: "#/components/schemas/Node" } },
            ],
          },
        },
      },
    };
    render(
      <SchemaView
        schema={recursive}
        value={recursive.components.schemas.Node}
      />,
    );
    expect(screen.getAllByText(/Node/).length).toBeLessThan(30);
  });
  it("provides boolean choices and preserves false", () => {
    const onChange = vi.fn();
    render(
      <SchemaField
        schema={{}}
        spec={{ type: "boolean" }}
        name="enabled"
        value={true}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/enabled/), {
      target: { value: "false" },
    });
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
