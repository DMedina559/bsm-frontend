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
const names = ["api-client", "runtime", "storage"];
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
  cpSync(
    join(root, "packages/api-client/test/consumer.mts"),
    join(temporary, "consumer.mts"),
  );
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
      join(temporary, "consumer.mts"),
    ],
    { stdio: "inherit" },
  );
  console.log(
    `Verified ${names.length} packed packages, ${imports.length} executable exports, and consumer types.`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
