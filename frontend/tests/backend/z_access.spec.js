import { test, expect } from "@playwright/test";

test("named credentials are shown once, usable as bearer, and revocable", async ({
  page,
  context,
}) => {
  const request = context.request;
  const origin = "http://127.0.0.1:4180";
  const schema = await (await request.get(`${origin}/api/openapi.json`)).json();
  test.skip(
    !schema.paths?.["/api/account/tokens"],
    "Backend predates named credentials",
  );
  const username = "smoke-admin";
  const password = "temporary-smoke-password";
  const setup = await (await request.get(`${origin}/api/setup/status`)).json();
  if (setup.needs_setup) {
    expect(
      (
        await request.post(`${origin}/api/setup/create-first-user`, {
          data: { username, password },
        })
      ).ok(),
    ).toBe(true);
  }
  expect(
    (
      await request.post(`${origin}/auth/token`, {
        form: { username, password },
        headers: { "X-BSM-Auth-Mode": "cookie" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`${origin}/app/account`);
  const integrations = page.getByRole("tab", {
    name: "Integrations",
    exact: true,
  });
  if (schema.paths?.["/api/account/sessions"]) {
    await expect(integrations).toBeVisible();
    await integrations.click();
  }
  await expect(
    page.getByRole("heading", { name: "Integration credentials" }),
  ).toBeVisible();
  await page
    .getByLabel("Credential name", { exact: true })
    .fill("Browser monitoring");
  const supportsNoExpiry =
    schema.components?.schemas?.CreateIntegrationToken?.properties?.expires_in_days?.anyOf?.some(
      (type) => type.type === "null",
    );
  if (supportsNoExpiry)
    await page.getByLabel("Never expire", { exact: true }).check();
  await page
    .getByRole("button", { name: "Create credential", exact: true })
    .click();
  const field = page.getByRole("textbox", {
    name: "New integration credential",
    exact: true,
  });
  await expect(field).toBeVisible();
  const secret = await field.inputValue();
  expect(secret).toMatch(/^bsm_it_[a-f0-9]{32}\./);
  const bearer = { Authorization: `Bearer ${secret}` };
  const account = await request.get(`${origin}/api/account`, {
    headers: bearer,
  });
  expect(account.status()).toBe(200);
  expect((await account.json()).credential_id).toBeTruthy();
  expect(
    (
      await request.get(`${origin}/api/account/tokens`, { headers: bearer })
    ).status(),
  ).toBe(403);
  const listing = await request.get(`${origin}/api/account/tokens`);
  const listingText = await listing.text();
  expect(listingText).not.toContain(secret);
  if (supportsNoExpiry) {
    expect(
      JSON.parse(listingText).find(
        (token) => token.name === "Browser monitoring",
      ).expires_at,
    ).toBeNull();
    await expect(
      page.getByText("Never expires", { exact: true }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: "/tmp/access-settings-browser.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Dismiss credential", exact: true })
    .click();
  await expect(field).toHaveCount(0);
  await page
    .getByRole("button", { name: "Revoke Browser monitoring", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect
    .poll(async () =>
      (
        await request.get(`${origin}/api/account`, { headers: bearer })
      ).status(),
    )
    .toBe(401);
  await page.reload();
  await expect(field).toHaveCount(0);
});
