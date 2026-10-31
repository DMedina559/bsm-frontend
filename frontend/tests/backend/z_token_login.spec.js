import { test, expect } from "@playwright/test";

test("token sign-in is scoped, explicit about storage, and shared with saved connections", async ({
  browser,
  request,
}) => {
  test.setTimeout(90000);
  const origin = "http://127.0.0.1:4180";
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
  const headers = { "X-CSRF-Token": login.headers()["x-bsm-csrf-token"] };
  const created = await request.post(`${origin}/api/account/tokens`, {
    headers,
    data: {
      name: "Read-only dashboard",
      permissions: ["account:read", "servers:read"],
      expires_in_days: null,
    },
  });
  expect(created.status()).toBe(201);
  const token = (await created.json()).token;
  const context = await browser.newContext();
  const remembered = await browser.newContext();
  try {
    await context.addInitScript(() =>
      sessionStorage.setItem("show_hidden_flag", "true"),
    );
    const page = await context.newPage();
    await page.goto(`${origin}/app/login`);
    const dropdown = page.getByRole("button", {
      name: "Active BSM instance: Default",
      exact: true,
    });
    await dropdown.click();
    await expect(
      page.getByRole("menuitem", {
        name: "Configure Remote Server",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Manage Instances…", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByText("Other sign-in methods", { exact: true }).click();
    await page
      .getByLabel("Sign in with", { exact: true })
      .selectOption("token");
    await expect(page.getByLabel("Token storage", { exact: true })).toHaveValue(
      "tab",
    );
    await page.getByLabel("API token", { exact: true }).fill(token);
    await page
      .getByLabel("Sign in with", { exact: true })
      .selectOption("password");
    await page
      .getByLabel("Sign in with", { exact: true })
      .selectOption("token");
    await expect(page.getByLabel("API token", { exact: true })).toHaveValue("");
    await page.getByLabel("API token", { exact: true }).fill(token);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    const notice = page.getByRole("complementary", {
      name: "Integration token access",
    });
    await expect(
      notice.getByText("Integration token · Read-only dashboard", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      notice.getByText("Never expires", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Install Server", exact: true }),
    ).toHaveCount(0);
    expect(
      (await context.cookies()).some(
        (cookie) => cookie.name === "access_token_cookie",
      ),
    ).toBe(false);
    expect(
      await page.evaluate(
        (value) =>
          Object.values(localStorage).some((item) => item.includes(value)),
        token,
      ),
    ).toBe(false);
    expect(
      await page.evaluate(
        (value) =>
          Object.values(sessionStorage).some((item) => item.includes(value)),
        token,
      ),
    ).toBe(true);
    // The login-page instance menu is the same menu used by the workspace.
    await dropdown.click();
    await page
      .getByRole("menuitem", { name: "Manage Instances…", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add instance", exact: true })
      .click();
    await page
      .getByLabel("Display name", { exact: true })
      .fill("token dashboard");
    await page.getByLabel("Backend URL", { exact: true }).fill(origin);
    await page
      .getByRole("button", { name: "Save instance", exact: true })
      .click();
    const card = page.getByRole("article", {
      name: "token dashboard",
      exact: true,
    });
    // A same-backend saved connection can already use the explicitly stored bearer.
    await expect(
      card.getByRole("complementary", { name: "Integration token access" }),
    ).toBeVisible();
    await card.getByText("Connection options", { exact: true }).click();
    await card
      .getByRole("button", { name: "Switch account", exact: true })
      .click();
    await card
      .getByLabel("Sign in with", { exact: true })
      .selectOption("token");
    await card.getByLabel("API token", { exact: true }).fill(token);
    await card.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(card.getByLabel("API token", { exact: true })).toHaveCount(0);
    await expect(
      card.getByRole("complementary", { name: "Integration token access" }),
    ).toBeVisible();
    await page.goto(`${origin}/app/`);
    let logouts = 0;
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/auth/logout") logouts++;
    });
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
    expect(logouts).toBe(0);
    expect(
      await page.evaluate(
        (value) =>
          [
            ...Object.values(localStorage),
            ...Object.values(sessionStorage),
          ].some((item) => item.includes(value)),
        token,
      ),
    ).toBe(false);
    expect(
      (
        await request.get(`${origin}/api/account`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status(),
    ).toBe(200);
    // Explicit remembered login survives a page reload, and logout forgets it.
    const persistent = await remembered.newPage();
    await persistent.goto(`${origin}/app/login`);
    await persistent
      .getByText("Other sign-in methods", { exact: true })
      .click();
    await persistent
      .getByLabel("Sign in with", { exact: true })
      .selectOption("token");
    await persistent.getByLabel("API token", { exact: true }).fill(token);
    await persistent
      .getByLabel("Token storage", { exact: true })
      .selectOption("remember");
    await persistent
      .getByRole("button", { name: "Sign In", exact: true })
      .click();
    await expect(
      persistent.getByRole("complementary", {
        name: "Integration token access",
      }),
    ).toBeVisible();
    expect(
      await persistent.evaluate(
        (value) =>
          Object.values(localStorage).some((item) => item.includes(value)),
        token,
      ),
    ).toBe(true);
    await persistent.reload();
    await expect(
      persistent.getByRole("complementary", {
        name: "Integration token access",
      }),
    ).toBeVisible();
    await persistent
      .getByRole("button", { name: "Logout", exact: true })
      .click();
    await expect(
      persistent.getByLabel("Username", { exact: true }),
    ).toBeVisible();
    expect(
      await persistent.evaluate(
        (value) =>
          Object.values(localStorage).some((item) => item.includes(value)),
        token,
      ),
    ).toBe(false);
  } finally {
    await context.close();
    await remembered.close();
  }
});
