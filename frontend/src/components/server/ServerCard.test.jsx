import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ServerCard from "./ServerCard";

function mount() {
  const handlers = {
    onOpen: vi.fn(),
    onAction: vi.fn(),
    onUpdate: vi.fn(),
    onCommand: vi.fn(),
  };
  render(
    <ServerCard
      server={{ name: "Test", status: "stopped" }}
      busy={false}
      {...handlers}
    />,
  );
  return handlers;
}

describe("server card navigation", () => {
  it.each(["INSTALLED", "ERROR", "UNKNOWN", "CRASHED"])(
    "offers Start for a %s server",
    (status) => {
      const action = vi.fn();
      render(
        <ServerCard server={{ name: "Recovery", status }} onAction={action} />,
      );
      const start = screen.getByRole("button", { name: "Start Recovery" });
      expect(start).toBeEnabled();
      fireEvent.click(start);
      expect(action).toHaveBeenCalledWith(
        expect.anything(),
        "Recovery",
        "start",
      );
    },
  );
  it.each(["INSTALLED", "UPDATED"])("allows updating a %s server", (status) => {
    const onUpdate = vi.fn();
    render(
      <ServerCard server={{ name: "Test", status }} onUpdate={onUpdate} />,
    );
    const button = screen.getByRole("button", { name: "Update Test" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onUpdate).toHaveBeenCalledWith(expect.anything(), "Test");
  });
  it.each(["INSTALLING", "UPDATING", "STARTING", "STOPPING"])(
    "disables updating during %s",
    (status) => {
      render(<ServerCard server={{ name: "Test", status }} />);
      expect(
        screen.getByRole("button", { name: "Update Test" }),
      ).toBeDisabled();
    },
  );
  it("opens Monitor from the card's primary button", () => {
    const handlers = mount();
    fireEvent.click(screen.getByRole("button", { name: "Open Test monitor" }));
    expect(handlers.onOpen).toHaveBeenCalledWith("Test");
  });
  it.each([
    ["Settings", "/server-config"],
    ["Properties", "/server-properties"],
    ["Access Control", "/access-control"],
    ["Backups", "/backups"],
  ])("opens %s without opening Monitor", (label, route) => {
    const handlers = mount();
    fireEvent.click(
      screen.getByRole("button", { name: "More options for Test" }),
    );
    fireEvent.click(screen.getByRole("button", { name: label, exact: true }));
    expect(handlers.onOpen).toHaveBeenCalledExactlyOnceWith("Test", route);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
  it("dismisses with Escape and restores focus to the trigger", () => {
    const handlers = mount();
    const trigger = screen.getByRole("button", {
      name: "More options for Test",
    });
    fireEvent.click(trigger);
    screen.getByRole("button", { name: "Properties", exact: true }).focus();
    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });
  it("dismisses on an outside pointer press", () => {
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: "More options for Test" }),
    );
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
  it("keeps lifecycle actions separate from navigation", () => {
    const handlers = mount();
    fireEvent.click(screen.getByRole("button", { name: "Start Test" }));
    expect(handlers.onAction).toHaveBeenCalledWith(
      expect.anything(),
      "Test",
      "start",
    );
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });
});
