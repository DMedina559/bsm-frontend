import { test, expect } from "@playwright/test";

test("frontend preferences have a central home while Account stays focused on security", async ({
  page,
  context,
}) => {
  const origin = "http://127.0.0.1:4180";
  const request = context.request;
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
  expect(
    (
      await request.post(`${origin}/auth/token`, {
        form,
        headers: { "X-BSM-Auth-Mode": "cookie" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`${origin}/app/account`);
  await expect(
    page.getByRole("heading", { name: "My Account", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Browser recovery", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Profile", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/account-central-desktop.png" });
  await page.goto(`${origin}/app/appearance`);
  await expect(page).toHaveURL(/frontend-settings\?tab=appearance/);
  await expect(
    page.getByRole("heading", { name: "Theme", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /^Display/ }).click();
  await page.getByLabel("Fleet layout", { exact: true }).selectOption("list");
  await page
    .getByLabel("Default server sort", { exact: true })
    .selectOption("status");
  await page.screenshot({
    path: "/tmp/frontend-settings-desktop.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("Fleet layout", { exact: true })).toHaveValue(
    "list",
  );
  await expect(
    page.getByLabel("Default server sort", { exact: true }),
  ).toHaveValue("status");
  await page.getByRole("tab", { name: /^Browser recovery/ }).click();
  await page
    .getByLabel("Recover unsaved settings and properties", { exact: true })
    .check();
  await page.reload();
  await expect(
    page.getByLabel("Recover unsaved settings and properties", { exact: true }),
  ).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".sidebar-nav")
        .evaluate((node) => node.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "/tmp/frontend-settings-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("tab", { name: /^Connections/ }).click();
  await expect(
    page.getByRole("link", { name: "Manage saved instances", exact: true }),
  ).toBeVisible();
});
