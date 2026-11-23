import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { displayComponents } from "../../../src/features/plugins/components/display";
import { layoutComponents } from "../../../src/features/plugins/components/layout";

vi.mock("../../../src/utils/pluginUrl", () => ({
  resolvePluginUrl: (url) => url,
}));

it("keeps scripted plugin frames isolated from the application origin", () => {
  const Frame = displayComponents.iframe;
  render(<Frame src="https://example.com/plugin" title="Plugin frame" />);
  const permissions = screen
    .getByTitle("Plugin frame")
    .getAttribute("sandbox")
    .split(" ");
  expect(permissions).toContain("allow-scripts");
  expect(permissions).not.toContain("allow-same-origin");
});

it("renders nested tab children and ignores conditional empty children", () => {
  const Tabs = layoutComponents.Tabs;
  render(
    <Tabs activeTab="second">
      {false}
      {[
        <div id="first" label="First" key="first">
          First content
        </div>,
        [
          <div id="second" label="Second" key="second">
            Second content
          </div>,
        ],
      ]}
    </Tabs>,
  );
  expect(screen.getByRole("button", { name: "Second" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText("Second content")).toBeVisible();
  expect(screen.queryByText("First content")).not.toBeInTheDocument();
});
