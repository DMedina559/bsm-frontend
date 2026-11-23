import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { resolveRelease } from "./release-version.mjs";

export function prepareRelease(
  release,
  root = fileURLToPath(new URL("../", import.meta.url)),
) {
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error("Run through npm run release:prepare");
  for (const pkg of release.packages) {
    const manifest = JSON.parse(
      readFileSync(
        resolve(root, "packages", pkg.product, "package.json"),
        "utf8",
      ),
    );
    if (
      manifest.name !== pkg.workspace ||
      manifest.publishConfig?.access !== "public" ||
      manifest.private !== (pkg.product === "frontend")
    )
      throw new Error(`Unexpected release workspace: ${pkg.workspace}`);
  }
  execFileSync(
    process.execPath,
    [
      npm,
      "version",
      release.npmVersion,
      ...release.packages.map((pkg) => `--workspace=${pkg.workspace}`),
      "--no-git-tag-version",
      "--ignore-scripts",
      "--allow-same-version",
    ],
    { cwd: root, stdio: "inherit" },
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const release = resolveRelease(
    process.env.RELEASE_TAG,
    process.env.IS_PRERELEASE === "true",
  );
  prepareRelease(release);
  if (process.env.GITHUB_ENV)
    appendFileSync(
      process.env.GITHUB_ENV,
      `SETUPTOOLS_SCM_PRETEND_VERSION_FOR_BSM_FRONTEND=${release.pythonVersion}\nBSM_FRONTEND_VERSION=${release.npmVersion}\n`,
    );
}
