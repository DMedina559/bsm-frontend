import { test, expect } from "@playwright/test";
import WebSocket from "ws";
async function login(page, name) {
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Login", exact: true }),
  ).toHaveCount(0);
}
test("production standalone UI authenticates across origins and isolates credentials across tabs", async ({
  context,
  page,
  request,
}) => {
  await page.goto("http://127.0.0.1:4174/");
  await expect(
    page.getByRole("button", { name: "Configure Remote Server" }),
  ).toBeVisible();
  await login(page, "alice");
  await expect
    .poll(async () => {
      const records = await (
        await request.get("http://127.0.0.1:4176/audit/requests")
      ).json();
      return records.some(
        (record) => record.path === "/ws" && record.token === "4176-alice",
      );
    })
    .toBe(true);
  const second = await context.newPage();
  await second.goto("http://127.0.0.1:4174/");
  await login(second, "bob");
  await second.evaluate(() =>
    localStorage.setItem("api_base_url", "http://127.0.0.1:4177"),
  );
  await expect(
    page.getByRole("heading", { name: "Login", exact: true }),
  ).toBeVisible();
  const records = await (
    await request.get("http://127.0.0.1:4177/audit/requests")
  ).json();
  expect(
    records.some(
      (record) =>
        record.port === 4176 &&
        record.origin === "http://127.0.0.1:4174" &&
        record.token === "4176-alice",
    ),
  ).toBe(true);
  expect(
    records
      .filter((record) => record.port === 4177)
      .every((record) => !record.token),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Login", exact: true }),
  ).toBeVisible();
});
test("production ingress keeps application assets and backend requests under the prefix", async ({
  page,
}) => {
  const missing = [];
  page.on("response", (response) => {
    if (response.status() === 404) missing.push(response.url());
  });
  await page.goto("http://127.0.0.1:4175/ingress/test/app/");
  await expect(
    page.getByRole("heading", { name: "Login", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".auth-brand img")).toHaveJSProperty(
    "naturalWidth",
    512,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Login", exact: true }),
  ).toBeVisible();
  expect(missing).toEqual([]);
});
test("production backend enforces HTTP and WebSocket origins", async ({
  request,
}) => {
  expect(
    (
      await request.get("http://127.0.0.1:4176/api/account", {
        headers: { Origin: "https://untrusted.example" },
      })
    ).status(),
  ).toBe(403);
  const preflight = await request.fetch("http://127.0.0.1:4176/api/account", {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:4174",
      "Access-Control-Request-Headers": "authorization",
    },
  });
  expect(preflight.status()).toBe(204);
  expect(preflight.headers()["access-control-allow-origin"]).toBe(
    "http://127.0.0.1:4174",
  );
  const status = await new Promise((resolve) => {
    const socket = new WebSocket("ws://127.0.0.1:4176/ws", {
      origin: "https://untrusted.example",
    });
    socket.on("unexpected-response", (_request, response) => {
      response.resume();
      socket.terminate();
      resolve(response.statusCode);
    });
    socket.on("error", () => {});
  });
  expect(status).toBe(403);
});

test("production login opens and reloads on a non-secure HTTP origin", async ({
  page,
}) => {
  // Loopback URLs are secure contexts and would hide missing browser capabilities.
  const origin = "http://bsm.test";
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/setup/status")
      return route.fulfill({ json: { needs_setup: false } });
    if (url.pathname === "/api/account")
      return route.fulfill({ status: 401, json: { detail: "Sign in" } });
    const response = await route.fetch({
      url: `http://127.0.0.1:4173${url.pathname}${url.search}`,
    });
    return route.fulfill({ response });
  });
  await page.goto(`${origin}/app/login`);
  expect(
    await page.evaluate(() => ({
      secure: isSecureContext,
      locks: typeof navigator.locks,
      uuid: typeof crypto.randomUUID,
    })),
  ).toEqual({ secure: false, locks: "undefined", uuid: "undefined" });
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".auth-brand img")).toHaveJSProperty(
    "naturalWidth",
    512,
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
