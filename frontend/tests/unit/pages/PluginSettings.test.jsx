import { render, screen, fireEvent, waitFor } from "../../support/utils";
import { beforeEach, expect, it, vi } from "vitest";
import * as api from "../../support/httpFixtures";
import PluginSettings from "../../../src/pages/PluginSettings";
vi.mock("../../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../../support/httpFixtures");
  return createHttpTransport(await importOriginal());
});
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/plugin-settings");
  api.get.mockImplementation((url) => {
    if (url === "/api/plugins")
      return Promise.resolve({
        status: "success",
        plugins: {
          typed: { enabled: true, has_settings: true },
          legacy: { enabled: false, has_settings: true },
          empty: { enabled: true, has_settings: false },
        },
      });
    if (url === "/api/plugins/typed/settings")
      return Promise.resolve({
        status: "success",
        settings: { count: 3, enabled: true, mode: "safe", servers: [] },
        settings_schema: {
          type: "object",
          properties: {
            servers: {
              type: "array",
              title: "Servers",
              description: "Empty selects all servers",
              items: {
                type: "string",
                "x-bsm-server-name": true,
                enum: ["alpha", "beta"],
              },
            },
            count: { type: "integer", title: "Count", minimum: 1, maximum: 10 },
            enabled: { type: "boolean", title: "Enabled" },
            mode: { type: "string", title: "Mode", enum: ["safe", "fast"] },
          },
        },
      });
    if (url === "/api/plugins/legacy/settings")
      return Promise.resolve({
        status: "success",
        settings: {},
        settings_schema: null,
      });
    return Promise.resolve({});
  });
  api.put.mockResolvedValue({ status: "success", message: "Saved" });
});
it("opens plugin tabs and preserves typed values when saving", async () => {
  render(<PluginSettings />);
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: "legacy" })).toHaveAttribute(
      "aria-selected",
      "true",
    ),
  );
  fireEvent.click(screen.getByRole("tab", { name: "typed" }));
  const count = await screen.findByLabelText("Count");
  expect(count).toHaveAttribute("max", "10");
  fireEvent.change(count, { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Enabled"), {
    target: { value: "false" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith(
      "/api/plugins/typed/settings",
      expect.objectContaining({
        settings: { count: 5, enabled: false, mode: "safe", servers: [] },
      }),
    ),
  );
});
it("preserves legacy JSON types and blocks malformed JSON", async () => {
  render(<PluginSettings />);
  const input = await screen.findByLabelText("Plugin settings");
  fireEvent.change(input, { target: { value: '{"items":[1,false,null]}' } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith(
      "/api/plugins/legacy/settings",
      expect.objectContaining({ settings: { items: [1, false, null] } }),
    ),
  );
  fireEvent.change(input, { target: { value: "{broken" } });
  expect(input).toBeInvalid();
});

it("hides plugins without settings", async () => {
  render(<PluginSettings />);
  await screen.findByRole("tab", { name: "typed" });
  expect(screen.queryByRole("tab", { name: "empty" })).not.toBeInTheDocument();
});

it("offers current server choices and lets users clear the selection", async () => {
  render(<PluginSettings />);
  fireEvent.click(await screen.findByRole("tab", { name: "typed" }));
  const server = await screen.findByRole("checkbox", { name: "alpha" });
  fireEvent.click(server);
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith(
      "/api/plugins/typed/settings",
      expect.objectContaining({
        settings: expect.objectContaining({ servers: ["alpha"] }),
      }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(server).not.toBeChecked();
});
