import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/** Reject missing, extra, duplicate, or mismatched artifacts before any publication. */
export function selectReleaseArchives(directory, release) {
  const collect = (path) =>
    readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
      const child = join(path, entry.name);
      if (entry.isDirectory()) return collect(child);
      return entry.isFile() && entry.name.endsWith(".tgz") ? [child] : [];
    });
  const archives = collect(resolve(directory));
  if (archives.length !== release.packages.length)
    throw new Error("Expected exactly four verified npm archives");
  const selected = new Map();
  for (const archive of archives) {
    const manifest = JSON.parse(
      execFileSync("tar", ["-xOf", archive, "package/package.json"], {
        encoding: "utf8",
      }),
    );
    const pkg = release.packages.find(
      (candidate) => candidate.workspace === manifest.name,
    );
    if (
      !pkg ||
      selected.has(manifest.name) ||
      manifest.version !== release.npmVersion ||
      manifest.private !== false ||
      manifest.publishConfig?.access !== "public"
    )
      throw new Error(
        `Archive must contain a unique public release package at ${release.npmVersion}`,
      );
    selected.set(pkg.workspace, {
      ...pkg,
      archive,
      integrity:
        "sha512-" +
        createHash("sha512").update(readFileSync(archive)).digest("base64"),
    });
  }
  return release.packages.map((pkg) => selected.get(pkg.workspace));
}
