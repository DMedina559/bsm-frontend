import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { resolveRelease } from "./release-version.mjs";
import { selectReleaseArchives } from "./release-artifacts.mjs";
const registry = "https://registry.npmjs.org";

/** Preflight the entire release before writing; skip only byte-identical versions. */
export function publishNpmRelease(archives, distTag, run) {
  const plan = archives.map((pkg) => {
    const metadata = run(
      [
        "view",
        `${pkg.workspace}@${pkg.npmVersion}`,
        "dist",
        "--json",
        `--registry=${registry}`,
      ],
      true,
    );
    if (metadata && metadata.integrity !== pkg.integrity)
      throw new Error(
        `Published bytes differ for ${pkg.workspace}@${pkg.npmVersion}; use a new release version`,
      );
    return { ...pkg, exists: Boolean(metadata) };
  });
  for (const pkg of plan) {
    if (!pkg.exists)
      run([
        "publish",
        pkg.archive,
        `--registry=${registry}`,
        "--ignore-scripts",
        "--access",
        "public",
        "--provenance",
        "--tag",
        distTag,
      ]);
    else {
      const tags = run([
        "view",
        pkg.workspace,
        "dist-tags",
        "--json",
        `--registry=${registry}`,
      ]);
      if (tags?.[distTag] !== pkg.npmVersion)
        run([
          "dist-tag",
          "add",
          `${pkg.workspace}@${pkg.npmVersion}`,
          distTag,
          `--registry=${registry}`,
        ]);
      console.log(`Verified existing ${pkg.workspace}@${pkg.npmVersion}`);
    }
  }
}

function npmRun(args, allowMissing = false) {
  try {
    const result = execFileSync("npm", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (args[0] === "view") return JSON.parse(result);
    process.stdout.write(result);
  } catch (error) {
    if (allowMissing) {
      let details;
      try {
        details = JSON.parse(String(error.stdout));
      } catch {
        /* Not an npm JSON error. */
      }
      if (details?.error?.code === "E404") return null;
    }
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const release = resolveRelease(
    process.env.RELEASE_TAG,
    process.env.IS_PRERELEASE === "true",
  );
  publishNpmRelease(
    selectReleaseArchives(process.argv[2] || "release-artifacts", release),
    release.distTag,
    npmRun,
  );
}
