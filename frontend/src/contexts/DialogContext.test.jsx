import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DialogProvider, useDialog } from "./DialogContext";
function Harness({ finish }) {
  const { confirmAction, promptAction } = useDialog();
  return (
    <>
      <button
        onClick={async () => finish(await confirmAction("Delete this server?"))}
      >
        Delete
      </button>
      <button
        onClick={async () =>
          finish(await promptAction("Enter a server command"))
        }
      >
        Console
      </button>
    </>
  );
}
describe("themed dialogs", () => {
  it("cancels with Escape and restores focus", async () => {
    const finish = vi.fn();
    render(
      <DialogProvider>
        <Harness finish={finish} />
      </DialogProvider>,
    );
    const trigger = screen.getByText("Delete");
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toHaveTextContent("Delete this server?");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(finish).toHaveBeenCalledWith(false));
    expect(trigger).toHaveFocus();
  });
  it("confirms only after explicit submission", async () => {
    const finish = vi.fn();
    render(
      <DialogProvider>
        <Harness finish={finish} />
      </DialogProvider>,
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(finish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Continue"));
    await waitFor(() => expect(finish).toHaveBeenCalledWith(true));
  });
  it("returns a trimmed console command", async () => {
    const finish = vi.fn();
    render(
      <DialogProvider>
        <Harness finish={finish} />
      </DialogProvider>,
    );
    fireEvent.click(screen.getByText("Console"));
    fireEvent.change(screen.getByLabelText("Command"), {
      target: { value: "  list  " },
    });
    fireEvent.click(screen.getByText("Send command"));
    await waitFor(() => expect(finish).toHaveBeenCalledWith("list"));
  });
});
