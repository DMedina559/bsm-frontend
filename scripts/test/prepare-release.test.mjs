import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareRelease } from "../prepare-release.mjs";
import { resolveRelease } from "../release-version.mjs";

test("sets every package and lockfile version together while keeping frontend source private", (t) => {
  const root = mkdtempSync(join(tmpdir(), "bsm-release-versions-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const release = resolveRelease("1.4.0b3");
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "fixture",
      private: true,
      workspaces: ["packages/*"],
    }),
  );
  for (const pkg of release.packages) {
    const path = join(root, "packages", pkg.product);
    mkdirSync(path, { recursive: true });
    writeFileSync(
      join(path, "package.json"),
      JSON.stringify({
        name: pkg.workspace,
        version: "0.1.0",
        private: pkg.product === "frontend",
        publishConfig: { access: "public" },
      }),
    );
  }
  execFileSync(
    process.execPath,
    [
      process.env.npm_execpath,
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--offline",
      "--no-audit",
      "--no-fund",
    ],
    { cwd: root, stdio: "pipe" },
  );
  prepareRelease(release, root);
  const lock = JSON.parse(
    readFileSync(join(root, "package-lock.json"), "utf8"),
  );
  for (const pkg of release.packages) {
    const manifest = JSON.parse(
      readFileSync(join(root, "packages", pkg.product, "package.json"), "utf8"),
    );
    assert.equal(manifest.version, release.npmVersion);
    assert.equal(manifest.private, pkg.product === "frontend");
    assert.equal(
      lock.packages[`packages/${pkg.product}`].version,
      release.npmVersion,
    );
  }
  prepareRelease(release, root); // Preparing the same release is idempotent.
});
