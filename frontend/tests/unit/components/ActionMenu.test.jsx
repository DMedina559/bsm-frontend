import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ActionMenu from "../../../src/components/ActionMenu";
afterEach(cleanup);
it("opens from the keyboard, navigates actions and restores focus on Escape", () => {
  render(
    <ActionMenu
      label="More backup options"
      items={[
        { label: "Recovery drill", onClick: vi.fn() },
        { label: "Pin", onClick: vi.fn() },
      ]}
    />,
  );
  const trigger = screen.getByRole("button", { name: "More backup options" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(
    screen.getByRole("menuitem", { name: "Recovery drill" }),
  ).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "ArrowDown" });
  expect(screen.getByRole("menuitem", { name: "Pin" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
it("keeps unavailable actions disabled and dismisses after selection or outside click", () => {
  const pin = vi.fn();
  render(
    <ActionMenu
      label="More backup options"
      items={[
        { label: "Recovery drill", disabled: true, onClick: vi.fn() },
        { label: "Pin", onClick: pin },
      ]}
    />,
  );
  const trigger = screen.getByRole("button", { name: "More backup options" });
  fireEvent.click(trigger);
  expect(
    screen.getByRole("menuitem", { name: "Recovery drill" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("menuitem", { name: "Pin" }));
  expect(pin).toHaveBeenCalledOnce();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
