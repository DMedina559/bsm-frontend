import { test, expect } from "@playwright/test";
import { fixtureResponse } from "../support/fixtures.js";

async function recoveryBackend(context) {
  await context.routeWebSocket(/\/ws$/, (socket) => {
    socket.onMessage((raw) => {
      if (JSON.parse(String(raw)).action === "authenticate")
        socket.send(
          JSON.stringify({
            status: "success",
            message: "Authenticated successfully",
          }),
        );
    });
  });
  await context.route(/^https:\/\/fonts\./, (route) => route.abort());
  await context.route(/\/(api|auth|themes|plugins)\//, async (route) => {
    const url = new URL(route.request().url());
    let data = fixtureResponse(url);
    if (url.pathname.startsWith("/auth/"))
      data = { access_token: "recovery-fixture", token_type: "bearer" };
    if (url.pathname === "/api/settings/get")
      data = {
        status: "success",
        settings: {
          retention: { backups: 3 },
          web: { port: 11325 },
          backups: {
            encryption: false,
            include_server_packs: true,
            safety_window_hours: 168,
            verification_interval_hours: 168,
            keep_daily: 7,
            keep_weekly: 4,
            keep_monthly: 3,
            storage_budget_bytes: 0,
            schedules: {},
            destinations: {},
          },
          custom: {},
        },
      };
    if (/\/backups$/.test(url.pathname))
      data = {
        status: "success",
        backups: [
          {
            backup_id: "fixture.bsmbackup",
            filename: "fixture.bsmbackup",
            label: "Before update",
            created_at: "2026-10-19T12:00:00Z",
            purpose: "pre_update",
            size: 1024,
            encrypted: false,
            verification: { status: "verified" },
          },
        ],
      };
    if (url.pathname.endsWith("/backups/health"))
      data = {
        status: "success",
        health: {
          readiness: "ready",
          readiness_reasons: [],
          count: 1,
          total_bytes: 1024,
          failed_count: 0,
          destination_failures: 0,
          destinations: {},
        },
      };
    if (url.pathname.endsWith("/backups/recovery"))
      data = { recovery: { active: false } };
    if (url.pathname.endsWith("/backups/report"))
      data = {
        status: "success",
        report: {
          report_version: 1,
          generated_at: "2026-10-19T12:00:00Z",
          readiness: "ready",
          archive_count: 1,
          archives_omitted: 0,
          missing_key_count: 0,
          destination_failures: 0,
          recovery_pending: false,
          archives: [],
        },
      };
    await route.fulfill({ json: data });
  });
}

test("backup report downloads and settings tabs preserve pending changes", async ({
  page,
  context,
}) => {
  await recoveryBackend(context);
  await page.goto("backups");
  await expect(page.getByRole("heading", { name: /Backups:/ })).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Recovery report", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("bsm-recovery-report.json");
  await page
    .getByRole("combobox", { name: "Filter", exact: true })
    .selectOption("pre_restore");
  await expect(page.getByText("No backups match this view.")).toBeVisible();
  await page
    .getByRole("link", { name: "Backup settings", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Backups", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Daily recovery points", { exact: true }).fill("14");
  await page.getByRole("tab", { name: "Web & access", exact: true }).click();
  await page.getByRole("tab", { name: "Backups", exact: true }).click();
  await expect(
    page.getByLabel("Daily recovery points", { exact: true }),
  ).toHaveValue("14");
});

test("backup settings remain within a narrow mobile viewport", async ({
  page,
  context,
}) => {
  await recoveryBackend(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("bsm-settings?tab=backups");
  await expect(
    page.getByRole("heading", { name: "Backup policy", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Advanced", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Advanced", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
