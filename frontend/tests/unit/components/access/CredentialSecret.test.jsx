import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import CredentialSecret from "../../../../src/components/access/CredentialSecret";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("announces a completed copy and prevents duplicate writes while pending", async () => {
  let resolve;
  const writeText = vi.fn(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const dismiss = vi.fn();
  render(<CredentialSecret value="one-time-test-secret" onDismiss={dismiss} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Copy credential", exact: true }),
  );
  expect(screen.getByRole("button", { name: "Copying…" })).toBeDisabled();
  expect(screen.getByRole("status")).not.toHaveTextContent("Credential copied");
  expect(writeText).toHaveBeenCalledExactlyOnceWith("one-time-test-secret");
  resolve();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Copied", exact: true }),
    ).toBeEnabled(),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Credential copied to clipboard.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Dismiss credential" }));
  expect(dismiss).toHaveBeenCalledOnce();
});
test.each([
  undefined,
  { writeText: () => Promise.reject(new Error("permission denied")) },
])(
  "selects the credential for manual copy if the clipboard is unavailable or denied",
  async (clipboard) => {
    vi.stubGlobal("navigator", { clipboard });
    render(
      <CredentialSecret value="one-time-test-secret" onDismiss={() => {}} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copy credential", exact: true }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Could not copy automatically",
      ),
    );
    const field = screen.getByRole("textbox", {
      name: "New integration credential",
    });
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);
    expect(
      screen.getByRole("button", { name: "Copy credential", exact: true }),
    ).toBeEnabled();
  },
);
