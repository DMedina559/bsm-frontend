import { test, expect } from "@playwright/test";
// Drive the shipped app and real browser transports against controlled backend snapshots.
async function backend(context, role = "admin") {
  const state = {
    sockets: [],
    installed: false,
    tasks: new Map(),
    accounts: [],
    extraServers: [],
    players: [],
    writes: [],
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
            role,
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
              players: state.players,
              version: "1.0",
            },
            ...state.extraServers,
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
      else if (path.endsWith("/settings/get"))
        data = {
          settings: {
            server_info: { status: "STOPPED", installed_version: "1.0" },
            settings: {
              autostart: false,
              autoupdate: false,
              target_version: "LATEST",
            },
            custom: {},
          },
        };
      else if (path.endsWith("/settings/set"))
        state.writes.push({ path, body: JSON.parse(request.postData()) });
      else if (request.method() === "POST" && path.includes("/api/server/"))
        state.writes.push({ path, body: JSON.parse(request.postData()) });
      else if (path.endsWith("/properties/get"))
        data = {
          properties: { "server-name": decodeURIComponent(path.split("/")[3]) },
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
    page.getByRole("button", {
      name: `Open ${name}-server monitor`,
      exact: true,
    }),
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
  await expect(
    page.getByRole("button", { name: "1 active operation. View operations" }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("button", { name: "0 active operations. View operations" }),
  ).toBeVisible();
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
test("notifications synchronize messages, read state and clearing across tabs", async ({
  context,
  page,
}) => {
  await backend(context);
  await login(page, "alice");
  const second = await context.newPage();
  await login(second, "alice");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    second.getByRole("button", {
      name: "Notification history, 2 unread",
      exact: true,
    }),
  ).toBeVisible();
  await second.getByRole("button", { name: /Notification history/ }).click();
  await expect(
    second
      .getByRole("dialog")
      .getByText("Server list refreshed.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Notification history", exact: true }),
  ).toBeVisible();
  await second.getByRole("button", { name: "Clear history" }).click();
  await page
    .getByRole("button", { name: "Notification history", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("No notifications yet."),
  ).toBeVisible();
});

test("server cards open Monitor and offer settings shortcuts", async ({
  context,
  page,
}) => {
  await backend(context);
  await login(page, "alice");
  const card = page.getByRole("article", {
    name: "alice-server server",
    exact: true,
  });
  // Hover feedback must keep the card's full-area hit target stationary.
  const initialBounds = await card.boundingBox();
  await card.hover({ position: { x: 12, y: 12 } });
  await expect
    .poll(async () => {
      const hoveredBounds = await card.boundingBox();
      return Math.abs(hoveredBounds.y - initialBounds.y);
    })
    .toBeLessThan(0.5);
  // Click card padding to exercise the full-card hit area rather than its title.
  await card.click({ position: { x: 12, y: 12 } });
  await expect(page).toHaveURL(/\/monitor$/);
  await expect(page.locator("#server-select")).toHaveValue("alice-server");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "More options for alice-server" })
    .click();
  await page.getByRole("button", { name: "Properties", exact: true }).click();
  await expect(page).toHaveURL(/\/server-properties$/);
  await expect(page.locator("#server-select")).toHaveValue("alice-server");
});

function diagnosticsSnapshot() {
  const now = Date.now() / 1000;
  const data = {
    runtime: {
      kind: "runtime",
      ready: true,
      phase: "ready",
      stage: null,
      pid: 1234,
      uptime_seconds: 450,
      version: "4.0",
      python_version: "3.14",
    },
    events: {
      kind: "events",
      truncated: false,
      activity: {
        emitted: 125,
        pending_workers: 0,
        pending_waits: 0,
        active: [],
        recent: [],
      },
      capacity: { max_active: 256 },
    },
    state: {
      kind: "state",
      counts: { servers: 2, plugins: 8, users: 1 },
      pending_changes: { servers: 0, plugins: 0, users: 0, settings: 0 },
    },
    storage: {
      kind: "storage",
      attempts: 24,
      successes: 24,
      failures: 0,
      active: 0,
      last_error_type: null,
      lock_waiters: 0,
    },
    tasks: {
      kind: "tasks",
      active: 0,
      tasks: [],
      accepting: true,
      capacity: 100,
    },
    plugins: {
      kind: "plugins",
      plugins: [
        {
          name: "backup_on_start",
          status: "UNKNOWN",
          generation: 0,
          draining: false,
        },
      ],
      total: 1,
      truncated: false,
    },
    transport: {
      kind: "transport",
      connected_clients: 1,
      successful_sends: 52,
      failed_sends: 0,
      pending_sends: 0,
      queue_limit_per_client: 64,
    },
    metrics: {
      kind: "metrics",
      attempts: 151,
      successes: 151,
      failures: 0,
      warming_up: false,
    },
    processes: {
      kind: "processes",
      registered: 2,
      observed_running: 0,
      processes: [],
      truncated: false,
    },
  };
  return {
    schema_version: 1,
    snapshot_id: "snapshot",
    instance_id: "instance",
    collected_at: now,
    counter_scope: "current_instance",
    summary: {
      status: "ok",
      ready: true,
      counts_by_status: { ok: 9 },
      findings: [],
      truncated: false,
    },
    sections: Object.entries(data).map(([name, value]) => ({
      name,
      owner: "application",
      status: "ok",
      collected_at: now,
      observed_at: now,
      last_success_at: now,
      age_seconds: 0,
      stale: false,
      issues: [],
      data: value,
    })),
    collection: {
      status: "ok",
      requests: 2,
      collections: 2,
      failures: 0,
      periodic_status: "disabled",
    },
    persistence: {
      queued: 0,
      queue_limit: 256,
      dropped: 0,
      writer_status: "running",
      history_limit: 1000,
      retention_days: 7,
    },
    registry: {
      registered: 9,
      pending: 0,
      max_providers: 128,
      max_providers_per_owner: 8,
    },
    environment: {
      backend_version: "4.0",
      frontend_version: "4.0",
      python_version: "3.14",
      operating_system: "Linux",
    },
    recent: {
      failures: 0,
      timeouts: 0,
      cancelled: 0,
      window_seconds: 300,
      bucket_seconds: 10,
    },
  };
}
test("administrators inspect diagnostics, compare snapshots and download a report", async ({
  page,
  context,
}, testInfo) => {
  await backend(context);
  let revision = 0;
  await context.route("**/api/metrics", async (route) => {
    const sample = {
      timestamp: Date.now() / 1000,
      epoch: "browser-metrics",
      revision: (revision += 8),
      app_cpu_percent: 12.4,
      app_ram_mb: 248,
      uptime_seconds: 8100,
      thread_count: 6,
      background_task_count: 0,
      asyncio_task_count: 10,
      loop_lag_ms: 0,
      servers: [],
    };
    await route.fulfill({
      json: {
        latest: sample,
        history: Array.from({ length: 8 }, (_, index) => ({
          ...sample,
          timestamp: sample.timestamp - (7 - index) * 3,
          revision: sample.revision - 7 + index,
          app_cpu_percent: index === 7 ? 12.4 : 8 + index,
          app_ram_mb: 240 + index,
        })),
        interval_seconds: 3,
        history_limit: 180,
      },
    });
  });
  let calls = 0;
  await context.route("**/api/diagnostics**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    calls++;
    const snapshot = diagnosticsSnapshot();
    let data = snapshot;
    if (path.endsWith("/history"))
      data = {
        available: true,
        records: [
          {
            id: "record",
            timestamp: snapshot.collected_at,
            subsystem: "events",
            operation: "listener",
            outcome: "failed",
            correlation_id: "trace",
          },
        ],
        truncated: false,
        next_cursor: null,
      };
    if (path.endsWith("/runs"))
      data = { available: true, runs: [], truncated: false };
    if (path.includes("/trace/"))
      data = {
        events: null,
        events_available: false,
        tasks: [],
        tasks_available: true,
        history: { available: true, records: [] },
        issues: [],
        truncated: true,
      };
    if (path.endsWith("/report"))
      data = {
        report_id: "browser-report",
        snapshot,
        history: { records: [], available: true },
      };
    if (path.endsWith("/compare"))
      data = { same_instance: true, changes: [], truncated: false };
    await route.fulfill({ json: data });
  });
  await login(page, "alice");
  await page.goto("application-monitor");
  expect(calls).toBe(0);
  await expect(page.getByText("12.4%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause updates" }).click();
  await expect(page.getByText("View paused", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume updates" }).click();
  await page.screenshot({
    path: testInfo.outputPath("metrics-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("metrics-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("tab", { name: "Diagnostics" }).click();
  await expect(
    page.getByRole("definition").filter({ hasText: /^Ready$/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByRole("button", { name: "Save comparison baseline" }).click();
  await page.getByRole("button", { name: "Compare with baseline" }).click();
  await expect(page.getByText("No changes in compared fields.")).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download support report" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(
    "bsm-diagnostics-browser-report.json",
  );
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "listener" })
    .getByRole("button", { name: "Inspect trace" })
    .click();
  await expect(page.getByText(/Events: unavailable/)).toBeVisible();
  await page.getByRole("button", { name: "Subsystems", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search plugins" }).fill("backup");
  await expect(
    page.getByText("Status not reported", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("diagnostics-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("diagnostics-mobile.png"),
    fullPage: true,
  });
});
test("non-administrators cannot open diagnostics or fetch its endpoints", async ({
  context,
  page,
}) => {
  await backend(context, "user");
  let calls = 0;
  await context.route("**/api/diagnostics**", async (route) => {
    calls++;
    await route.fulfill({
      status: 403,
      json: { error: { code: "forbidden", message: "Admin required" } },
    });
  });
  await login(page, "viewer");
  await page.goto("application-monitor");
  await expect(
    page.getByRole("heading", { name: "Metrics", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Diagnostics" })).toHaveCount(0);
  expect(calls).toBe(0);
});

test("tabs share one socket, receive the same accepted update and take over after the owner closes", async ({
  context,
  page,
}) => {
  const state = await backend(context);
  await login(page, "alice");
  await expect.poll(() => state.sockets.length).toBe(1);
  const second = await context.newPage();
  await login(second, "alice");
  await expect(second.getByLabel("WebSocket health")).toHaveText("Live");
  expect(state.sockets.length).toBe(1);
  state.sockets[0].send(
    JSON.stringify({
      type: "event",
      topic: "event:after_server_status_change",
      epoch: "shared",
      revision: 1,
      data: {
        result: {
          server_name: "alice-server",
          status: "success",
          new_status: "RUNNING",
        },
      },
    }),
  );
  await expect(
    page.getByRole("button", { name: "Stop alice-server", exact: true }),
  ).toBeVisible();
  await expect(
    second.getByRole("button", { name: "Stop alice-server", exact: true }),
  ).toBeVisible();
  await page.close();
  await expect.poll(() => state.sockets.length).toBe(2);
  await expect(second.getByLabel("WebSocket health")).toHaveText("Live");
});

test("shows a dated read-only cached fleet and never queues offline changes", async ({
  context,
  page,
}) => {
  await backend(context);
  await login(page, "alice");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise((resolve) => {
          const request = indexedDB.open("bsm-view-state", 2);
          request.onsuccess = () => resolve(request.result);
        });
        return new Promise((resolve) => {
          const request = db
            .transaction("records")
            .objectStore("records")
            .getAll();
          request.onsuccess = () => {
            db.close();
            resolve(request.result.some((record) => record.kind === "offline"));
          };
        });
      }),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByText(/Viewing a stale fleet snapshot from/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start alice-server", exact: true }),
  ).toBeDisabled();
  await context.setOffline(false);
  await expect(
    page.getByText(/Viewing a stale fleet snapshot from/),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start alice-server", exact: true }),
  ).toBeEnabled();
});

test("restores opt-in drafts after reload without persisting secrets or writing automatically", async ({
  context,
  page,
}) => {
  await backend(context);
  let saved = 0;
  await context.route("**/api/settings/**", async (route) => {
    if (route.request().method() !== "GET") saved++;
    await route.fulfill({
      json: {
        settings: {
          monitoring: { app_metrics_interval_sec: 3 },
          web: { jwt_secret_key: "private-secret" },
        },
      },
    });
  });
  await login(page, "alice");
  await page.goto("account");
  await page.getByLabel("Recover unsaved settings and properties").check();
  await page.goto("bsm-settings");
  await page
    .getByLabel("Application metrics interval", { exact: true })
    .fill("12");
  await page.getByRole("tab", { name: "Web & access", exact: true }).click();
  await page
    .getByLabel("jwt secret key", { exact: true })
    .fill("changed-secret");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise((resolve) => {
          const request = indexedDB.open("bsm-view-state", 2);
          request.onsuccess = () => resolve(request.result);
        });
        return new Promise((resolve) => {
          const request = db
            .transaction("records")
            .objectStore("records")
            .getAll();
          request.onsuccess = () => {
            db.close();
            resolve(
              JSON.stringify(
                request.result.filter((record) => record.kind === "draft"),
              ),
            );
          };
        });
      }),
    )
    .toContain('"value":12');
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Restore edits", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "General", exact: true }).click();
  await expect(
    page.getByLabel("Application metrics interval", { exact: true }),
  ).toHaveValue("3");
  await page
    .getByRole("button", { name: "Restore edits", exact: true })
    .click();
  await expect(
    page.getByLabel("Application metrics interval", { exact: true }),
  ).toHaveValue("12");
  await page.getByRole("tab", { name: "Web & access", exact: true }).click();
  await expect(page.getByLabel("jwt secret key", { exact: true })).toHaveValue(
    "private-secret",
  );
  expect(saved).toBe(0);
});

test("administrators can inspect bounded frontend rejection diagnostics without payloads", async ({
  context,
  page,
}) => {
  const state = await backend(context);
  await login(page, "alice");
  await page.goto("application-monitor");
  await page.getByRole("tab", { name: "Diagnostics", exact: true }).click();
  await page
    .getByRole("button", { name: "Frontend runtime", exact: true })
    .click();
  await page
    .getByLabel("Record frontend observations", { exact: true })
    .check();
  await page.getByLabel("Keep history across reloads", { exact: true }).check();
  await expect(page.getByLabel("WebSocket health")).toHaveText("Live");
  state.sockets.at(-1).send(
    JSON.stringify({
      type: "task_update",
      data: {
        id: "private-identity",
        status: "invalid",
        token: "never-display",
      },
    }),
  );
  await expect(page.getByRole("cell", { name: /invalid-task/ })).toBeVisible();
  await expect(
    page.getByText("never-display", { exact: false }),
  ).not.toBeVisible();
  // Flush on navigation and restore the sanitized journal in a new browser session.
  await page.goto("application-monitor?view=diagnostics&category=frontend");
  await expect(page.getByRole("cell", { name: /invalid-task/ })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Previous session", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Record frontend observations", { exact: true }),
  ).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  const recordingControl = page.getByRole("link", {
    name: "Frontend diagnostics recording is enabled",
    exact: true,
  });
  await expect(recordingControl).toBeVisible();
  await expect
    .poll(async () => (await recordingControl.boundingBox())?.width)
    .toBe(44);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await expect(
    page.getByText(/Waiting for frontend observations/),
  ).toBeVisible();
});

test("server changes protect drafts, including changes requested by another tab", async ({
  context,
  page,
}) => {
  const state = await backend(context);
  state.extraServers.push({ name: "beta", status: "stopped", players: [] });
  await login(page, "alice");
  await page.getByRole("link", { name: "Properties", exact: true }).click();
  await page.locator("#server-name").fill("Unsaved alpha edit");
  await page.locator("#server-select").selectOption("beta");
  await expect(page.getByRole("dialog")).toContainText(
    "Discard unsaved changes and switch servers?",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#server-select")).toHaveValue("alice-server");
  await expect(page.locator("#server-name")).toHaveValue("Unsaved alpha edit");
  const second = await context.newPage();
  await login(second, "alice");
  await second.locator("#server-select").selectOption("beta");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#server-name")).toHaveValue("Unsaved alpha edit");
  await page.locator("#server-select").selectOption("beta");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator("#server-name")).toHaveValue("beta");
  await second.close();
});
test("a cross-tab server switch closes a player action before it can target another server", async ({
  context,
  page,
}) => {
  const state = await backend(context);
  state.extraServers.push({ name: "beta", status: "running", players: [] });
  state.players.push({ name: "AlicePlayer", xuid: "12345" });
  await login(page, "alice");
  await page.getByRole("link", { name: "Online Players", exact: true }).click();
  await page.getByRole("button", { name: "Ban", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Ban AlicePlayer");
  const second = await context.newPage();
  await login(second, "alice");
  await second.locator("#server-select").selectOption("beta");
  await expect(page.locator("#server-select")).toHaveValue("beta");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toEqual([]);
  await second.close();
});
test("saving one server setting sends only that writable field", async ({
  context,
  page,
}) => {
  const state = await backend(context);
  await login(page, "alice");
  await page.locator('a[href="/app/server-config"]').click();
  await page.getByLabel("target version", { exact: true }).fill("PREVIEW");
  await page
    .getByRole("button", { name: "Save Settings", exact: true })
    .click();
  await expect
    .poll(() => state.writes)
    .toEqual([
      {
        path: "/api/server/alice-server/settings/set",
        body: { key: "settings.target_version", value: "PREVIEW" },
      },
    ]);
});

test("administrators inspect global activity and follow operation traces", async ({
  context,
  page,
}, testInfo) => {
  await backend(context);
  const operation = {
    operation_id: "operation",
    sequence_id: "sequence",
    root_operation_id: "root",
    parent_operation_id: "root",
    correlation_id: "activity-trace",
    name: "server.start",
    server_name: "alpha",
    status: "finished",
    outcome: "started",
  };
  const requests = [];
  await context.route("**/api/diagnostics**", async (route) => {
    const url = new URL(route.request().url());
    let data = diagnosticsSnapshot();
    if (url.pathname.endsWith("/activity")) {
      requests.push(url);
      data = {
        scope: "application",
        events: { active: [], recent: [] },
        operations: { active: [], recent: [operation] },
        subscriptions: {
          total: 1,
          items: [
            {
              listener_id: "plugin:listener",
              owner: "plugin:example",
              name: "before_server_start",
              priority: 100,
              unresolved_after: ["other:missing"],
            },
          ],
        },
        truncated: true,
      };
    } else if (url.pathname.includes("/trace/"))
      data = {
        events: null,
        events_available: false,
        operations: { active: [], recent: [operation] },
        operations_available: true,
        tasks: [],
        tasks_available: true,
        history: { available: true, records: [] },
        issues: [],
      };
    else if (url.pathname.endsWith("/history"))
      data = { available: true, records: [], truncated: false };
    else if (url.pathname.endsWith("/runs"))
      data = { available: true, runs: [], truncated: false };
    await route.fulfill({ json: data });
  });
  await login(page, "alice");
  await page.goto("application-monitor");
  await page.getByRole("tab", { name: "Diagnostics" }).click();
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByText("server.start · alpha · finished")).toBeVisible();
  await expect(page.getByText(/This view is partial/)).toBeVisible();
  await page.getByLabel("Server", { exact: true }).fill("alpha");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("server_name"))
    .toBe("alpha");
  await page.getByText("server.start · alpha · finished").click();
  await expect(page.getByText("started", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("global-activity-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Inspect trace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Correlated trace" }),
  ).toBeFocused();
  await expect(page.getByText(/Operations: available/)).toBeVisible();
});
