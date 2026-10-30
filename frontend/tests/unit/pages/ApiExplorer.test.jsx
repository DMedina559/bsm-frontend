import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ApiExplorer from "../../../src/pages/ApiExplorer";
import { sessionSettings } from "../../../src/app/browserStorage";
import {
  inspectSchema,
  prepareCall,
} from "../../../src/features/api-explorer/schema";
import backend from "../../../../packages/api-client/src/generated/openapi.json";

vi.mock("../../../src/api/transport", () => ({ request: vi.fn() }));
import { request } from "../../../src/api/transport";
const schema = {
  openapi: "3.1.0",
  info: { title: "Example", version: "1" },
  paths: {
    "/api/plugin/{name}": {
      post: {
        operationId: "plugin_example",
        tags: ["Example plugin"],
        parameters: [
          {
            name: "name",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Input" },
            },
          },
        },
        responses: { 200: { description: "OK" } },
      },
    },
  },
  components: {
    schemas: {
      Input: {
        type: "object",
        required: ["enabled"],
        additionalProperties: false,
        properties: { enabled: { type: "boolean" } },
      },
    },
  },
};
afterEach(() => {
  sessionSettings.removeItem("show_hidden_flag");
  vi.resetAllMocks();
});

it("prepares typed dynamic parameters and validates referenced request models", () => {
  const op = inspectSchema(schema)[0];
  expect(
    prepareCall(
      schema,
      op,
      { "path:name": "alpha", "query:limit": "3" },
      '{"enabled":false}',
    ),
  ).toEqual({
    path: { name: "alpha" },
    query: { limit: 3 },
    header: {},
    body: { enabled: false },
  });
  expect(() =>
    prepareCall(
      schema,
      op,
      { "path:name": "alpha", "query:limit": "0" },
      '{"enabled":true}',
    ),
  ).toThrow(/>= 1/);
  expect(() =>
    prepareCall(schema, op, { "path:name": "alpha" }, '{"enabled":"false"}'),
  ).toThrow(/boolean/);
});
it("handles the actual backend's recursive JSON request models", () => {
  const op = inspectSchema(backend).find((op) => op.id === "set_setting");
  expect(
    prepareCall(backend, op, {}, '{"key":"web.port","value":11325}').body.value,
  ).toBe(11325);
});
it("rejects external references, malformed documents and unsafe paths", () => {
  expect(() => inspectSchema({})).toThrow(/OpenAPI/);
  expect(() =>
    inspectSchema({
      ...schema,
      paths: { "//example.com/api": schema.paths["/api/plugin/{name}"] },
    }),
  ).toThrow(/path/i);
  expect(() =>
    inspectSchema({
      ...schema,
      paths: { "/api/test": { $ref: "https://example.com/schema" } },
    }),
  ).toThrow(/External/);
});
describe("API Explorer", () => {
  it("is unavailable without hidden mode", () => {
    render(
      <MemoryRouter>
        <ApiExplorer />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("heading", { name: "API Explorer" }),
    ).not.toBeInTheDocument();
  });
  it("loads plugin operations, previews typed requests and executes with cancellation support", async () => {
    sessionSettings.setItem("show_hidden_flag", "true");
    request
      .mockResolvedValueOnce(schema)
      .mockImplementationOnce(async (_url, options) => {
        options.onResponseMetadata({
          status: 202,
          headers: { "content-type": "application/json" },
        });
        return { accepted: true };
      });
    render(
      <MemoryRouter>
        <ApiExplorer />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Load connected backend" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /POST plugin_example/ }),
    );
    fireEvent.change(screen.getByLabelText(/name \(path\)/), {
      target: { value: "alpha" },
    });
    fireEvent.click(screen.getByRole("button", { name: "JSON", exact: true }));
    fireEvent.change(screen.getByLabelText("JSON body"), {
      target: { value: '{"enabled":true}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Execute POST" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Response" }),
      ).toBeInTheDocument(),
    );
    expect(request.mock.calls[1][0]).toBe("/api/plugin/alpha");
    expect(request.mock.calls[1][1].body).toEqual({ enabled: true });
    expect(
      screen.getByText("202", { selector: ".ae-status" }),
    ).toBeInTheDocument();
  });
});

it("cancels a pending contract fetch without issuing a second request", async () => {
  sessionSettings.setItem("show_hidden_flag", "true");
  request.mockImplementation(
    (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("Cancelled"))),
      ),
  );
  render(
    <MemoryRouter>
      <ApiExplorer />
    </MemoryRouter>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Load connected backend" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Cancelled"),
  );
  expect(request).toHaveBeenCalledTimes(1);
});

it("loads pasted contracts and keeps the active contract after an invalid replacement", () => {
  sessionSettings.setItem("show_hidden_flag", "true");
  render(
    <MemoryRouter>
      <ApiExplorer />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Import contract" }));
  const input = screen.getByLabelText("OpenAPI JSON");
  fireEvent.change(input, { target: { value: JSON.stringify(schema) } });
  fireEvent.click(screen.getByRole("button", { name: "Load JSON" }));
  expect(
    screen.getByRole("button", { name: /POST plugin_example/ }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Import contract" }));
  fireEvent.change(screen.getByLabelText("OpenAPI JSON"), {
    target: { value: "{}" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load JSON" }));
  expect(screen.getByRole("alert")).toHaveTextContent("OpenAPI");
  expect(
    screen.getByRole("button", { name: /POST plugin_example/ }),
  ).toBeInTheDocument();
});

it("allows a direct hidden=true URL before the application persists the flag", () => {
  render(
    <MemoryRouter initialEntries={["/api-explorer?hidden=true"]}>
      <ApiExplorer />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "API Explorer" }),
  ).toBeInTheDocument();
});
