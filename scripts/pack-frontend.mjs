import {
  cpSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { resolveReleaseTag } from "./release-version.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const target = join(root, "packages/frontend");
const source = join(root, "frontend/dist");
const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
if (process.env.RELEASE_TAG)
  pkg.version = resolveReleaseTag(
    "frontend",
    process.env.RELEASE_TAG,
    process.env.IS_PRERELEASE === "true",
  ).npmVersion;
pkg.private = false;
// Never alter the committed development manifest. Pack a staging directory.
const staging = join(root, "frontend/build/npm");
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
writeFileSync(join(staging, "package.json"), JSON.stringify(pkg, null, 2));
cpSync(source, join(staging, "dist"), { recursive: true });
cpSync(join(target, "README.md"), join(staging, "README.md"));
cpSync(join(root, "LICENSE"), join(staging, "LICENSE"));
const fingerprint = (directory) =>
  readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) =>
      entry.isDirectory()
        ? fingerprint(join(directory, entry.name)).map(([name, hash]) => [
            entry.name + "/" + name,
            hash,
          ])
        : [
            [
              entry.name,
              createHash("sha256")
                .update(readFileSync(join(directory, entry.name)))
                .digest("hex"),
            ],
          ],
    );
const assets = fingerprint(source);
const pythonAssets = fingerprint(join(root, "python/src/bsm_frontend/static"));
if (JSON.stringify(assets) !== JSON.stringify(pythonAssets))
  throw new Error(
    "Python and npm frontend assets must come from the same verified build.",
  );
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run through npm run pack:frontend");
rmSync(join(root, "frontend/build/artifacts"), {
  recursive: true,
  force: true,
});
mkdirSync(join(root, "frontend/build/artifacts"), { recursive: true });
execFileSync(
  process.execPath,
  [
    npm,
    "pack",
    staging,
    "--pack-destination",
    join(root, "frontend/build/artifacts"),
    "--ignore-scripts",
  ],
  { cwd: root, stdio: "inherit" },
);
console.log(
  `Packed frontend ${pkg.version}; ${assets.length} assets match the Python distribution.`,
);
