import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SignInForm from "../../../src/components/auth/SignInForm";
afterEach(cleanup);
it("clears secrets and storage choice when changing sign-in methods", () => {
  render(<SignInForm onPassword={vi.fn()} onToken={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
    target: { value: "private password" },
  });
  fireEvent.change(screen.getByLabelText("Sign in with"), {
    target: { value: "token" },
  });
  expect(screen.queryByLabelText("Password", { exact: true })).toBeNull();
  fireEvent.change(screen.getByLabelText("API token", { exact: true }), {
    target: { value: "bsm_it_private" },
  });
  fireEvent.change(screen.getByLabelText("Token storage"), {
    target: { value: "remember" },
  });
  fireEvent.change(screen.getByLabelText("Sign in with"), {
    target: { value: "password" },
  });
  expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Sign in with"), {
    target: { value: "token" },
  });
  expect(screen.getByLabelText("API token", { exact: true })).toHaveValue("");
  expect(screen.getByLabelText("Token storage")).toHaveValue("tab");
});
it("defaults tokens to this tab and aborts validation when the connection form unmounts", async () => {
  let signal;
  let finish;
  const success = vi.fn();
  const token = vi.fn((value, remember, pending) => {
    signal = pending;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const view = render(
    <SignInForm onPassword={vi.fn()} onToken={token} onSuccess={success} />,
  );
  fireEvent.change(screen.getByLabelText("Sign in with"), {
    target: { value: "token" },
  });
  fireEvent.change(screen.getByLabelText("API token", { exact: true }), {
    target: { value: "bsm_it_private" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign In", exact: true }));
  await waitFor(() =>
    expect(token).toHaveBeenCalledWith(
      "bsm_it_private",
      false,
      expect.any(AbortSignal),
    ),
  );
  view.unmount();
  expect(signal.aborted).toBe(true);
  finish({ credential_id: "late" });
  await Promise.resolve();
  expect(success).not.toHaveBeenCalled();
});
it("asks for MFA only after valid credentials receive a challenge", async () => {
  const password = vi
    .fn()
    .mockRejectedValueOnce({ mfaRequired: true })
    .mockResolvedValueOnce({});
  render(<SignInForm onPassword={password} onToken={vi.fn()} />);
  expect(screen.queryByLabelText("Authenticator or recovery code")).toBeNull();
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "owner" },
  });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
    target: { value: "private password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign In", exact: true }));
  const code = await screen.findByLabelText("Authenticator or recovery code");
  fireEvent.change(code, { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
  await waitFor(() =>
    expect(password).toHaveBeenLastCalledWith(
      {
        username: "owner",
        password: "private password",
        remember: false,
        otp: "123456",
      },
      expect.any(AbortSignal),
    ),
  );
});

it("only offers remembering after the OTP challenge and submits explicit opt-in", async () => {
  const password = vi
    .fn()
    .mockRejectedValueOnce({ mfaRequired: true })
    .mockResolvedValueOnce({});
  render(<SignInForm onPassword={password} onToken={vi.fn()} />);
  expect(
    screen.queryByLabelText("Remember this device for 30 days"),
  ).toBeNull();
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "owner" },
  });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
    target: { value: "password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign In", exact: true }));
  fireEvent.click(
    await screen.findByLabelText("Remember this device for 30 days"),
  );
  fireEvent.change(screen.getByLabelText("Authenticator or recovery code"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
  await waitFor(() =>
    expect(password).toHaveBeenLastCalledWith(
      expect.objectContaining({ rememberDevice: true, otp: "123456" }),
      expect.any(AbortSignal),
    ),
  );
});
