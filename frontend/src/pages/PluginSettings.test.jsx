import { render, screen, fireEvent, waitFor } from "../test/utils";
import { beforeEach, expect, it, vi } from "vitest";
import * as api from "../test/httpFixtures";
import PluginSettings from "./PluginSettings";
vi.mock("../api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../test/httpFixtures");
  return createHttpTransport(await importOriginal());
});
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/plugin-settings");
  api.get.mockImplementation((url) => {
    if (url === "/api/plugins")
      return Promise.resolve({
        status: "success",
        plugins: { typed: { enabled: true }, legacy: { enabled: false } },
      });
    if (url === "/api/plugins/typed/settings")
      return Promise.resolve({
        status: "success",
        settings: { count: 3, enabled: true, mode: "safe" },
        settings_schema: {
          type: "object",
          properties: {
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
        settings: { count: 5, enabled: false, mode: "safe" },
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
