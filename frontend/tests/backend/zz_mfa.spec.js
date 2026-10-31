import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test("login asks for MFA after credentials and accepts a recovery code", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(60000);
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
  const recoveryCodes = (await confirmed.json()).recovery_codes;
  const recovery = recoveryCodes[0];
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
  // The same account can sign in to a saved connection using its second factor.
  const primaryCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "access_token_cookie",
  ).value;
  await page.goto(`${origin}/app/instances?hidden=true`);
  await page.getByRole("button", { name: "Add instance", exact: true }).click();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("MFA saved connection");
  await page.getByLabel("Backend URL", { exact: true }).fill(origin);
  await page
    .getByRole("button", { name: "Save instance", exact: true })
    .click();
  const card = page.getByRole("article", {
    name: "MFA saved connection",
    exact: true,
  });
  await card.getByLabel("Username", { exact: true }).fill(form.username);
  await card.getByLabel("Password", { exact: true }).fill(form.password);
  await card.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    card.getByLabel("Authenticator or recovery code", { exact: true }),
  ).toBeVisible();
  await card
    .getByLabel("Authenticator or recovery code", { exact: true })
    .fill(recoveryCodes[1]);
  await card
    .getByRole("button", { name: "Verify and sign in", exact: true })
    .click();
  await expect(card.getByText(form.username, { exact: true })).toBeVisible();
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "access_token_cookie",
    ).value,
  ).toBe(primaryCookie);
  const stored = await page.evaluate(() =>
    [...Object.values(localStorage), ...Object.values(sessionStorage)].join(
      " ",
    ),
  );
  expect(stored).not.toContain(recoveryCodes[1]);
  expect(stored).not.toContain(form.password);

  // Require MFA for administrators and test the enrollment-only browser flow.
  const primary = await request.get(`${origin}/api/account`);
  const csrf = primary.headers()["x-bsm-csrf-token"];
  const invitation = await request.post(
    `${origin}/api/register/generate-token`,
    { headers: { "X-CSRF-Token": csrf }, data: { role: "admin" } },
  );
  expect(invitation.ok()).toBe(true);
  const inviteToken = new URL(
    (await invitation.json()).registration_url,
  ).pathname
    .split("/")
    .at(-1);
  const newAdmin = {
    username: "enrollment-admin",
    password: "a strong enrollment passphrase",
  };
  expect(
    (
      await request.post(`${origin}/api/register/${inviteToken}`, {
        headers: { "X-CSRF-Token": csrf },
        data: newAdmin,
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post(`${origin}/api/settings/set`, {
        headers: { "X-CSRF-Token": csrf },
        data: { key: "security.require_admin_mfa", value: true },
      })
    ).ok(),
  ).toBe(true);
  const fresh = await browser.newContext();
  try {
    const enrollmentPage = await fresh.newPage();
    await enrollmentPage.goto(`${origin}/app/login`);
    await enrollmentPage
      .getByLabel("Username", { exact: true })
      .fill(newAdmin.username);
    await enrollmentPage
      .getByLabel("Password", { exact: true })
      .fill(newAdmin.password);
    await enrollmentPage
      .getByRole("button", { name: "Sign In", exact: true })
      .click();
    await expect(enrollmentPage).toHaveURL(/\/account$/);
    await expect(
      enrollmentPage.getByText("Your administrator requires MFA.", {
        exact: false,
      }),
    ).toBeVisible();
    await enrollmentPage
      .getByRole("button", { name: "Set up authenticator", exact: true })
      .click();
    const setupKey = await enrollmentPage
      .getByLabel("Setup key", { exact: true })
      .inputValue();
    const confirmationCode = execFileSync(
      "python",
      ["-c", "import pyotp,sys; print(pyotp.TOTP(sys.stdin.read()).now())"],
      { input: setupKey, encoding: "utf8" },
    ).trim();
    await enrollmentPage
      .getByLabel("Six-digit authenticator code", { exact: true })
      .fill(confirmationCode);
    await enrollmentPage
      .getByRole("button", {
        name: "Enable two-factor authentication",
        exact: true,
      })
      .click();
    await expect(
      enrollmentPage.getByRole("heading", {
        name: "Save your recovery codes",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      enrollmentPage.getByRole("button", {
        name: "I saved my codes",
        exact: true,
      }),
    ).toBeVisible();
    await enrollmentPage
      .getByRole("button", { name: "I saved my codes", exact: true })
      .click();
    await enrollmentPage.goto(`${origin}/app/bsm-settings`);
    await expect(
      enrollmentPage.getByRole("heading", {
        name: "Global Settings",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await fresh.close();
  }
});
