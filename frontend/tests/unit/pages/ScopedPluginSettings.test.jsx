import BSMSettings from "../../../src/pages/BSMSettings";
import { render, screen, fireEvent, waitFor } from "../../support/utils";
import { beforeEach, expect, it, vi } from "vitest";
import * as api from "../../support/httpFixtures";
import ScopedPluginSettings from "../../../src/features/plugins/ScopedPluginSettings";
vi.mock("../../../src/api/transport", async (original) => {
  const { createHttpTransport } = await import("../../support/httpFixtures");
  return createHttpTransport(await original());
});
beforeEach(() => {
  vi.clearAllMocks();
  const values = { global: 3, alpha: 1, beta: 2 };
  api.get.mockImplementation((url) => {
    if (url === "/api/settings")
      return Promise.resolve({
        settings: { general: { timezone: "UTC" }, custom: {} },
      });
    if (url === "/api/plugins")
      return Promise.resolve({
        plugins: {
          profiles: {
            enabled: true,
            has_settings: false,
            has_global_settings: true,
            has_server_settings: true,
          },
        },
      });
    if (url.startsWith("/api/plugins/profiles/settings?")) {
      const params = new URL(url, "http://test").searchParams;
      const scope = params.get("server_name") || "global";
      return Promise.resolve({
        settings: { count: values[scope] },
        settings_schema: {
          type: "object",
          properties: {
            count: { title: "Count", type: "integer", minimum: 0 },
          },
        },
      });
    }
    return Promise.resolve({});
  });
  api.put.mockImplementation((_url, payload) => {
    values[payload.server_name || "global"] = payload.settings.count;
    return Promise.resolve({ status: "success", message: "Saved" });
  });
});
it("edits global plugin settings using their declared schema", async () => {
  render(<ScopedPluginSettings scope="global" />);
  const input = await screen.findByRole("spinbutton", { name: "Count" });
  expect(input).toHaveValue(3);
  fireEvent.change(input, { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith("/api/plugins/profiles/settings", {
      scope: "global",
      settings: { count: 5 },
    }),
  );
});
it("keeps per-server plugin settings and drafts isolated", async () => {
  const view = render(
    <ScopedPluginSettings scope="server" serverName="alpha" />,
  );
  const input = await screen.findByRole("spinbutton", { name: "Count" });
  expect(input).toHaveValue(1);
  fireEvent.change(input, { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith("/api/plugins/profiles/settings", {
      scope: "server",
      server_name: "alpha",
      settings: { count: 7 },
    }),
  );
  view.rerender(<ScopedPluginSettings scope="server" serverName="beta" />);
  await waitFor(() =>
    expect(screen.getByRole("spinbutton", { name: "Count" })).toHaveValue(2),
  );
});

it("exposes the global schema editor in the Plugins settings tab", async () => {
  render(<BSMSettings />);
  fireEvent.click(await screen.findByRole("tab", { name: "Plugins" }));
  expect(await screen.findByRole("spinbutton", { name: "Count" })).toHaveValue(
    3,
  );
  expect(screen.getByRole("tabpanel")).toHaveAttribute(
    "id",
    "settings-panel-plugins",
  );
});
