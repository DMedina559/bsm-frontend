import { test, expect } from "@playwright/test";

test("browser passkey registration, passwordless login, verification and removal", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Virtual authenticators use Chromium CDP",
  );
  test.setTimeout(90000);
  const origin = "http://localhost:4180";
  const request = context.request;
  const schema = await (await request.get(`${origin}/api/openapi.json`)).json();
  test.skip(
    !schema.paths?.["/auth/passkey/options"],
    "Backend predates passkeys",
  );
  const credentials = {
    username: "smoke-admin",
    password: "temporary-smoke-password",
  };
  if (
    (await (await request.get(`${origin}/api/setup/status`)).json()).needs_setup
  )
    expect(
      (
        await request.post(`${origin}/api/setup/create-first-user`, {
          data: credentials,
        })
      ).ok(),
    ).toBe(true);
  const login = await request.post(`${origin}/auth/token`, {
    form: credentials,
    headers: { "X-BSM-Auth-Mode": "cookie" },
  });
  expect(login.ok()).toBe(true);
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  try {
    await page.goto(`${origin}/app/account`);
    await page
      .getByRole("tab", { name: "Password & MFA", exact: true })
      .click();
    await page
      .getByLabel("Passkey label (optional)")
      .fill("Browser regression key");
    await page
      .getByRole("button", { name: "Register passkey", exact: true })
      .click();
    await expect(
      page.getByText("Browser regression key", { exact: true }),
    ).toBeVisible();
    const stored = await cdp.send("WebAuthn.getCredentials", {
      authenticatorId,
    });
    expect(stored.credentials).toHaveLength(1);
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    // A password-only attempt must direct the user to passkey sign-in, not an OTP field.
    await page
      .getByLabel("Username", { exact: true })
      .fill(credentials.username);
    await page
      .getByLabel("Password", { exact: true })
      .fill(credentials.password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(
      page.getByText(/This account requires a passkey/),
    ).toBeVisible();
    await expect(page.getByLabel("Authenticator or recovery code")).toHaveCount(
      0,
    );
    await page
      .getByRole("button", { name: "Sign in with passkey", exact: true })
      .click();
    await expect(page.locator("#server-select")).toBeVisible();
    await page.goto(`${origin}/app/account`);
    await page
      .getByRole("button", { name: "Verify password", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Verify with passkey", exact: true })
      .click();
    await expect(
      page.getByText(/Identity verified with passkey/),
    ).toBeVisible();
    await page
      .getByRole("tab", { name: "Password & MFA", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove passkey", exact: true })
      .click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByText("No passkeys registered", { exact: true }),
    ).toBeVisible();
  } finally {
    // Leave the shared fixture account usable by subsequent password/MFA tests even on failure.
    const cookieHeader = await page.evaluate(async () =>
      (await fetch("/api/account/security")).headers.get("X-BSM-CSRF-Token"),
    );
    if (cookieHeader) {
      const keys = await request.get(`${origin}/api/account/security/passkeys`);
      if (keys.ok())
        for (const key of await keys.json())
          if (key.active)
            await request.delete(
              `${origin}/api/account/security/passkeys/${key.id}`,
              { headers: { "X-CSRF-Token": cookieHeader } },
            );
    }
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await cdp.detach();
  }
});
