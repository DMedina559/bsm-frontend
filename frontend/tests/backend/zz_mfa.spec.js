import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test("login asks for MFA after credentials and accepts a recovery code", async ({
  page,
  context,
}) => {
  const origin = "http://127.0.0.1:4180";
  const request = context.request;
  const schema = await (await request.get(`${origin}/api/openapi.json`)).json();
  test.skip(
    !schema.paths?.["/api/account/security/mfa/enroll"],
    "Backend predates MFA",
  );
  const form = {
    username: "smoke-admin",
    password: "temporary-smoke-password",
  };
  const setup = await (await request.get(`${origin}/api/setup/status`)).json();
  if (setup.needs_setup)
    expect(
      (
        await request.post(`${origin}/api/setup/create-first-user`, {
          data: form,
        })
      ).ok(),
    ).toBe(true);
  const login = await request.post(`${origin}/auth/token`, {
    form,
    headers: { "X-BSM-Auth-Mode": "cookie" },
  });
  expect(login.ok()).toBe(true);
  const headers = { "X-CSRF-Token": login.headers()["x-bsm-csrf-token"] };
  const enrollment = await request.post(
    `${origin}/api/account/security/mfa/enroll`,
    { headers },
  );
  expect(enrollment.ok()).toBe(true);
  const secret = (await enrollment.json()).secret;
  const code = execFileSync(
    "python",
    ["-c", "import pyotp,sys; print(pyotp.TOTP(sys.stdin.read()).now())"],
    { input: secret, encoding: "utf8" },
  ).trim();
  const confirmed = await request.post(
    `${origin}/api/account/security/mfa/confirm`,
    { headers, data: { code } },
  );
  expect(confirmed.ok()).toBe(true);
  const recovery = (await confirmed.json()).recovery_codes[0];
  await context.clearCookies();
  await page.goto(`${origin}/app/login`);
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Authenticator or recovery code", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Username", { exact: true }).fill(form.username);
  await page.getByLabel("Password", { exact: true }).fill(form.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Verify your sign-in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Authenticator or recovery code", { exact: true })
    .fill(recovery);
  await page
    .getByRole("button", { name: "Verify and sign in", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Logout", exact: true }),
  ).toBeVisible();
});
