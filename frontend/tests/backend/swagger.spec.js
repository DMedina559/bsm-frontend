import { test, expect } from "@playwright/test";

test("Swagger bearer authentication is isolated from the embedded cookie session", async ({
  page,
  context,
}) => {
  const request = context.request;
  await page.route("**/swagger-ui-bundle.js", (route) =>
    route.fulfill({
      path: new URL(
        "../../../node_modules/swagger-ui-dist/swagger-ui-bundle.js",
        import.meta.url,
      ).pathname,
      contentType: "application/javascript",
    }),
  );
  await page.route("**/swagger-ui.css", (route) =>
    route.fulfill({
      path: new URL(
        "../../../node_modules/swagger-ui-dist/swagger-ui.css",
        import.meta.url,
      ).pathname,
      contentType: "text/css",
    }),
  );
  const origin = "http://127.0.0.1:4180";
  const schema = await (await request.get(`${origin}/api/openapi.json`)).json();
  test.skip(
    schema.paths?.["/api/account"]?.get?.["x-bsm-access"]?.version !== 1,
    "Backend predates the versioned HTTP access contract",
  );
  const username = "smoke-admin";
  const password = "temporary-smoke-password";
  const setup = await (await request.get(`${origin}/api/setup/status`)).json();
  if (setup.needs_setup) {
    const created = await request.post(
      `${origin}/api/setup/create-first-user`,
      { data: { username, password } },
    );
    expect(created.ok()).toBe(true);
  }
  const login = await request.post(`${origin}/auth/token`, {
    form: { username, password },
    headers: { "X-BSM-Auth-Mode": "cookie" },
  });
  expect(login.ok()).toBe(true);
  const csrf = login.headers()["x-bsm-csrf-token"];
  const invite = await request.post(`${origin}/api/register/generate-token`, {
    headers: csrf
      ? { "X-CSRF-Token": csrf }
      : { Authorization: `Bearer ${(await login.json()).access_token}` },
    data: { role: "user" },
  });
  expect(invite.ok()).toBe(true);
  const registrationToken = new URL(
    (await invite.json()).registration_url,
  ).pathname
    .split("/")
    .at(-1);
  const registered = await request.post(
    `${origin}/api/register/${registrationToken}`,
    {
      data: { username: "swagger-user", password },
      headers: csrf ? { "X-CSRF-Token": csrf } : {},
    },
  );
  expect(registered.ok()).toBe(true);
  const cookieBefore = (await context.cookies()).find(
    (cookie) => cookie.name === "access_token_cookie",
  );
  expect(cookieBefore).toBeDefined();
  const cookieHeaders = [];
  page.on("request", (outgoing) => {
    if (new URL(outgoing.url()).pathname === "/auth/token")
      cookieHeaders.push(outgoing.allHeaders());
  });
  await page.goto(`${origin}/docs`);
  expect(
    await page.evaluate(async () => (await fetch("/api/account")).status),
  ).toBe(401);
  await page.getByRole("button", { name: "Authorize", exact: true }).click();
  await page.locator("#oauth_username").fill("swagger-user");
  await page.locator("#oauth_password").fill(password);
  await page.locator(".dialog-ux button.authorize").first().click();
  await expect(
    page.locator(".dialog-ux button").filter({ hasText: "Logout" }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  const operation = page.locator(".opblock").filter({
    has: page.locator('.opblock-summary-path[data-path="/api/account"]'),
  });
  await operation.locator(".opblock-summary").click();
  if (
    await page.evaluate(() => typeof window.SwaggerAccessPlugin === "function")
  ) {
    const policy = operation.locator(".bsm-doc-access");
    await expect(
      policy.getByRole("heading", { name: "Access policy" }),
    ).toBeVisible();
    await expect(
      policy.getByText("account:read", { exact: true }),
    ).toBeVisible();
    await expect(policy.locator("details")).not.toHaveAttribute("open");
    await policy.screenshot({ path: "/tmp/swagger-access-ui.png" });
  }
  await operation.getByRole("button", { name: "Try it out" }).click();
  const authenticated = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/account",
  );
  await operation.getByRole("button", { name: "Execute", exact: true }).click();
  expect((await (await authenticated).json()).username).toBe("swagger-user");
  await page.getByRole("button", { name: "Authorize", exact: true }).click();
  await page
    .locator(".dialog-ux button")
    .filter({ hasText: "Logout" })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  const unauthenticated = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/account",
  );
  await operation.getByRole("button", { name: "Execute", exact: true }).click();
  expect((await unauthenticated).status()).toBe(401);
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "access_token_cookie",
    )?.value,
  ).toBe(cookieBefore.value);
  const frontendAccount = await request.get(`${origin}/api/account`);
  expect((await frontendAccount.json()).username).toBe(username);
  expect(cookieHeaders.length).toBe(1);
  expect((await cookieHeaders[0]).cookie).toBeUndefined();
});
