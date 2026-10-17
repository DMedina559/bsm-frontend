import { test, expect } from "@playwright/test";
test("the packaged app completes setup, authentication, socket connection, settings save and reload against BSM", async ({
  page,
}) => {
  let authenticated = false;
  let taskListRead = false;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) =>
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.message === "Authenticated successfully")
        authenticated = true;
    }),
  );
  page.on("response", (response) => {
    if (
      new URL(response.url()).pathname === "/api/tasks/list" &&
      response.status() === 200
    )
      taskListRead = true;
  });
  await page.goto("");
  await expect(
    page.getByRole("heading", { name: "Setup Bedrock Server Manager" }),
  ).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill("smoke-admin");
  await page
    .getByLabel("Password", { exact: true })
    .fill("temporary-smoke-password");
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill("temporary-smoke-password");
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();
  await expect(page.locator("#server-select")).toBeVisible();
  await expect.poll(() => authenticated).toBe(true);
  await expect.poll(() => taskListRead).toBe(true);
  await page.locator('a[href="/app/bsm-settings"]').click();
  const backups = page.locator('[id="setting-retention.backups"]');
  await expect(backups).toBeVisible();
  const value = String(Number(await backups.inputValue()) + 1);
  await backups.fill(value);
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/settings/set" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(
    page.getByText("Settings saved successfully.", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(backups).toHaveValue(value);
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("smoke-admin");
  await page
    .getByLabel("Password", { exact: true })
    .fill("temporary-smoke-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#server-select")).toBeVisible();
  expect(errors).toEqual([]);
});
