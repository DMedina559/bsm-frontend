import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this check with npm run packages:check");
const temporary = mkdtempSync(join(tmpdir(), "bsm-packages-"));
const available = ["api-client", "runtime", "storage"];
const names = process.argv.slice(2).length ? process.argv.slice(2) : available;
if (names.some((name) => !available.includes(name)))
  throw new Error("Unknown package");
const runNpm = (args) =>
  execFileSync(process.execPath, [npm, ...args], {
    cwd: root,
    encoding: "utf8",
  });
try {
  const archives = names.map((name) => {
    const result = JSON.parse(
      runNpm([
        "pack",
        `--workspace=@bedrock-server-manager/${name}`,
        "--json",
        "--pack-destination",
        temporary,
      ]),
    );
    const invalid = result[0].files.filter(
      (file) =>
        !/^(dist\/|README\.md$|LICENSE$|package\.json$)/.test(file.path) ||
        file.path.endsWith("openapi.json"),
    );
    if (invalid.length)
      throw new Error(
        `Unexpected package files: ${invalid.map((file) => file.path).join(", ")}`,
      );
    return join(temporary, result[0].filename);
  });
  writeFileSync(
    join(temporary, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  runNpm([
    "install",
    "--prefix",
    temporary,
    "--offline",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...archives,
  ]);
  const imports = [];
  for (const name of names) {
    const manifest = JSON.parse(
      readFileSync(join(root, "packages", name, "package.json"), "utf8"),
    );
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      const implementation =
        typeof target === "string" ? target : target.default;
      if (!implementation || implementation.endsWith(".d.ts")) continue;
      imports.push(
        `await import(${JSON.stringify(manifest.name + (subpath === "." ? "" : subpath.slice(1)))});`,
      );
    }
  }
  writeFileSync(join(temporary, "check.mjs"), imports.join("\n"));
  execFileSync(process.execPath, [join(temporary, "check.mjs")], {
    stdio: "inherit",
  });
  for (const name of names.filter((name) => name !== "runtime")) {
    const target = join(temporary, `${name}.mts`);
    cpSync(join(root, `packages/${name}/test/consumer.mts`), target);
    execFileSync(
      process.execPath,
      [
        require.resolve("typescript/bin/tsc"),
        "--noEmit",
        "--strict",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        target,
      ],
      { stdio: "inherit" },
    );
  }
  console.log(
    `Verified ${names.length} packed packages, ${imports.length} executable exports, and consumer types.`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
