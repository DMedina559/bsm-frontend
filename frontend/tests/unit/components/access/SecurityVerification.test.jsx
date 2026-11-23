import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import SecurityVerification from "../../../../src/components/access/SecurityVerification";
import { callOperation } from "../../../../src/api/operations";
import { getPasskeyAssertion } from "../../../../src/app/passkeys";
import { queryClient } from "../../../../src/app/queryClient";
const auth = vi.hoisted(() => ({
  user: { id: 1, username: "alice" },
  sessionGeneration: 1,
}));
vi.mock("../../../../src/contexts/AuthContext", () => ({
  useAuth: () => auth,
}));
vi.mock("../../../../src/contexts/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));
vi.mock("../../../../src/api/operations", () => ({ callOperation: vi.fn() }));
vi.mock("../../../../src/app/passkeys", () => ({
  isPasskeySupported: () => true,
  getPasskeyAssertion: vi.fn(async () => ({ id: "assertion" })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
  auth.sessionGeneration = 1;
  callOperation.mockImplementation(async (id) =>
    id === "get_account_security"
      ? { enabled: false, passkeys_enabled: true }
      : id === "begin_passkey_step_up"
        ? { challenge_id: "challenge", public_key: {} }
        : { verified_until: 999 },
  );
});
function challenge() {
  const detail = { resume: vi.fn(), cancel: vi.fn() };
  act(() =>
    window.dispatchEvent(
      new CustomEvent("bsm:security-verification-required", {
        cancelable: true,
        detail,
      }),
    ),
  );
  return detail;
}

it.each(["password", "passkey"])(
  "resumes waiting actions after successful %s verification",
  async (method) => {
    render(<SecurityVerification />);
    const first = challenge();
    await screen.findByRole("button", { name: "Verify with passkey" });
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "proof" },
    });
    const second = challenge();
    expect(screen.getByLabelText("Current password")).toHaveValue("proof");
    fireEvent.click(
      screen.getByRole("button", {
        name: method === "passkey" ? "Verify with passkey" : "Verify identity",
      }),
    );
    await waitFor(() => expect(first.resume).toHaveBeenCalledTimes(1));
    expect(second.resume).toHaveBeenCalledTimes(1);
    expect(first.cancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    if (method === "passkey") expect(getPasskeyAssertion).toHaveBeenCalled();
  },
);

it("keeps the action pending after bad credentials and cancels it when dismissed", async () => {
  const original = callOperation.getMockImplementation();
  callOperation.mockImplementation((id, options) =>
    id === "verify_account_security"
      ? Promise.reject(new Error("Incorrect password"))
      : original(id, options),
  );
  render(<SecurityVerification />);
  const action = challenge();
  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "wrong" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify identity" }));
  await screen.findByText("Incorrect password");
  expect(action.resume).not.toHaveBeenCalled();
  expect(action.cancel).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(action.cancel).toHaveBeenCalledTimes(1);
});

it("cancels pending actions when the session changes or verification unmounts", async () => {
  const view = render(<SecurityVerification />);
  const first = challenge();
  auth.sessionGeneration++;
  view.rerender(<SecurityVerification />);
  expect(first.cancel).toHaveBeenCalledTimes(1);
  const second = challenge();
  view.unmount();
  expect(second.cancel).toHaveBeenCalledTimes(1);
  expect(first.resume).not.toHaveBeenCalled();
  expect(second.resume).not.toHaveBeenCalled();
});
