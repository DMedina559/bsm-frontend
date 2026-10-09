import { test, expect } from "@playwright/test";
// Drive the shipped app and real browser transports against controlled backend snapshots.
async function backend(context) {
  const state = {
    sockets: [],
    installed: false,
    tasks: new Map(),
    accounts: [],
  };
  await context.routeWebSocket(/\/ws$/, (socket) => {
    state.sockets.push(socket);
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      if (message.action === "authenticate")
        socket.send(
          JSON.stringify({
            status: "success",
            message: "Authenticated successfully",
          }),
        );
    });
  });
  await context.route(
    /^http:\/\/127\.0\.0\.1:4173\/(api|auth|themes|plugins)\//,
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const identity = request.headers().authorization?.replace("Bearer ", "");
      let data = { status: "success" };
      let status = 200;
      if (path === "/api/setup/status") data = { needs_setup: false };
      else if (path === "/auth/token")
        data = {
          access_token: new URLSearchParams(request.postData()).get("username"),
          token_type: "bearer",
        };
      else if (path === "/api/account") {
        if (!identity) {
          status = 401;
          data = { detail: "Sign in" };
        } else {
          data = {
            id: identity,
            username: identity,
            role: "admin",
            theme: "default",
          };
          state.accounts.push(identity);
        }
      } else if (path === "/api/servers")
        data = {
          status: "success",
          servers: [
            {
              name: `${identity}-server`,
              status: "stopped",
              players: [],
              version: "1.0",
            },
            ...(state.installed
              ? [{ name: "NewServer", status: "stopped", players: [] }]
              : []),
          ],
        };
      else if (path === "/api/tasks/list") data = [...state.tasks.values()];
      else if (path.startsWith("/api/tasks/status/"))
        data = state.tasks.get(path.split("/").at(-1)) ?? {
          id: "install-task",
          status: "running",
        };
      else if (path === "/api/server/install") {
        state.tasks.set("install-task", {
          id: "install-task",
          status: "running",
        });
        data = { status: "accepted", task_id: "install-task" };
      } else if (path === "/api/downloads/list") data = { custom_zips: [] };
      else if (path.endsWith("/properties/get"))
        data = {
          properties: { "server-name": "NewServer" },
          raw_content: "server-name=NewServer",
        };
      else if (path.includes("themes")) data = { themes: [] };
      else if (path.includes("plugins")) data = { plugins: {} };
      await route.fulfill({ status, json: data });
    },
  );
  return state;
}
async function login(page, name) {
  await page.goto("login");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `Open ${name}-server monitor` }),
  ).toBeVisible();
}
test("login, logout and a different account clear the previous fleet", async ({
  context,
  page,
}) => {
  await backend(context);
  await login(page, "alice");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await login(page, "bob");
  await expect(page.getByText("alice-server", { exact: true })).toHaveCount(0);
});
test("installation survives navigation and reconnect then resumes setup", async ({
  context,
  page,
}) => {
  const state = await backend(context);
  await login(page, "alice");
  await page.getByRole("link", { name: /Install Server/ }).click();
  await page.getByLabel("Server Name").fill("NewServer");
  await page.getByRole("button", { name: /Install Server/ }).click();
  await expect(page.getByText("1 active operations")).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect.poll(() => state.sockets.length).toBeGreaterThan(0);
  const connections = state.sockets.length;
  state.sockets.at(-1).close();
  await expect.poll(() => state.sockets.length).toBeGreaterThan(connections);
  state.installed = true;
  state.tasks.set("install-task", {
    id: "install-task",
    status: "completed",
    result: { status: "success" },
  });
  state.sockets.at(-1).send(
    JSON.stringify({
      type: "task_update",
      topic: "task:install-task",
      data: {
        task_id: "install-task",
        status: "completed",
        result: { status: "success" },
      },
    }),
  );
  await expect(page.getByText("0 active operations")).toBeVisible();
  await page.getByRole("link", { name: /Install Server/ }).click();
  await expect(page).toHaveURL(/server-properties/);
});
test("layout preferences synchronize between tabs for the same account", async ({
  context,
  page,
}) => {
  await backend(context);
  await login(page, "alice");
  const second = await context.newPage();
  await login(second, "alice");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(
    second.getByRole("button", { name: "List", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await second.close();
});
