import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export function selectReleaseArchive(directory, release) {
  const collect = (path) =>
    readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
      const child = join(path, entry.name);
      if (entry.isDirectory()) return collect(child);
      return entry.isFile() && entry.name.endsWith(".tgz") ? [child] : [];
    });
  const archives = collect(resolve(directory));
  if (archives.length !== 1)
    throw new Error("Expected exactly one verified npm archive");
  const archive = archives[0];
  const manifest = JSON.parse(
    execFileSync("tar", ["-xOf", archive, "package/package.json"], {
      encoding: "utf8",
    }),
  );
  if (
    manifest.name !== release.workspace ||
    manifest.version !== release.npmVersion ||
    manifest.private !== false ||
    manifest.publishConfig?.access !== "public"
  )
    throw new Error(
      `Archive must contain public ${release.workspace}@${release.npmVersion}`,
    );
  return archive;
}
