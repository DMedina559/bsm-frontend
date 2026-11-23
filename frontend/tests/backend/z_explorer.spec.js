import { test, expect } from "@playwright/test";

test("Explorer presents access summaries and a searchable capability catalog at desktop and phone widths", async ({
  page,
  context,
}) => {
  const request = context.request;
  const origin = "http://127.0.0.1:4180";
  const username = "smoke-admin";
  const password = "temporary-smoke-password";
  const schema = await (await request.get(`${origin}/api/openapi.json`)).json();
  test.skip(
    !schema.paths?.["/api/account/tokens"],
    "Backend predates access management",
  );
  if (
    (await (await request.get(`${origin}/api/setup/status`)).json()).needs_setup
  ) {
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
  await page.goto(`${origin}/app/api-explorer?hidden=true`);
  await page
    .getByRole("button", { name: "Load connected backend", exact: true })
    .click();
  const policy = page.getByRole("region", {
    name: "Operation access",
    exact: true,
  });
  await expect(
    policy.getByText("Permission required", { exact: true }),
  ).toBeVisible();
  await expect(policy.locator("details")).not.toHaveAttribute("open");
  await page.screenshot({
    path: "/tmp/explorer-access-desktop.png",
    fullPage: true,
  });
  await policy.locator("summary").click();
  await page
    .getByRole("textbox", { name: "Search account capabilities" })
    .fill("tasks:");
  const catalog = policy.locator(".ae-capability-groups");
  await expect(catalog.getByText("tasks:read", { exact: true })).toBeVisible();
  await expect(catalog.getByText("users:manage", { exact: true })).toHaveCount(
    0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await policy.scrollIntoViewIfNeeded();
  await expect(policy.getByText("tasks:read", { exact: true })).toBeVisible();
  expect(
    await policy.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await policy.screenshot({ path: "/tmp/explorer-access-mobile.png" });
});
