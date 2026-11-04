import React from "react";
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import TokenAccessNotice from "../../../src/components/auth/TokenAccessNotice";
import { TimeContext } from "../../../src/contexts/TimeContext";

test("token expiry follows display timezone changes across a date boundary", () => {
  const account = {
    credential_id: "test-credential",
    credential_expires_at: Date.parse("2026-01-02T02:00:00Z") / 1000,
    permissions: [],
  };
  const view = (timezone) => (
    <TimeContext value={{ timezone }}>
      <TokenAccessNotice account={account} />
    </TimeContext>
  );
  const { rerender } = render(view("UTC"));
  const utc = screen.getByText(/^Expires /).textContent;
  expect(utc).toMatch(/Jan 2, 2026/);
  expect(utc).toContain("UTC");
  rerender(view("America/Los_Angeles"));
  const pacific = screen.getByText(/^Expires /).textContent;
  expect(pacific).toMatch(/Jan 1, 2026/);
  expect(pacific).toContain("PST");
  expect(pacific).not.toBe(utc);
});
