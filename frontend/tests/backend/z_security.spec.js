import { test, expect } from "@playwright/test";

test("embedded cookie sessions can revoke another login without exposing a bearer token", async ({
  page,
  context,
}) => {
  const origin = "http://127.0.0.1:4180";
  const request = context.request;
  const schema = await (await request.get(`${origin}/api/openapi.json`)).json();
  test.skip(
    !schema.paths?.["/api/account/sessions"],
    "Backend predates tracked sessions",
  );
  const form = {
    username: "smoke-admin",
    password: "temporary-smoke-password",
  };
  const login = await request.post(`${origin}/auth/token`, {
    form,
    headers: { "X-BSM-Auth-Mode": "cookie" },
  });
  expect(login.ok()).toBe(true);
  expect((await login.json()).access_token).toBe("");
  expect(login.headers()["x-bsm-csrf-token"]).toBeTruthy();
  const secondary = await request.post(`${origin}/auth/token`, {
    form,
    headers: { "X-BSM-Client": "Secondary CLI" },
  });
  const token = (await secondary.json()).access_token;
  expect(token).toBeTruthy();
  expect(secondary.headers()["set-cookie"]).toBeUndefined();
  await page.goto(`${origin}/app/account`);
  await expect(
    page.getByRole("heading", { name: "Security", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Secondary CLI", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Sign out Secondary CLI", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect
    .poll(async () =>
      (
        await request.get(`${origin}/api/account`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status(),
    )
    .toBe(401);
  expect((await request.get(`${origin}/api/account`)).status()).toBe(200);
  const stored = await page.evaluate(() => [
    ...Object.values(localStorage),
    ...Object.values(sessionStorage),
  ]);
  expect(stored.join(" ")).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./);
  await page.screenshot({
    path: "/tmp/security-sessions-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/security-sessions-mobile.png",
    fullPage: true,
  });
});
