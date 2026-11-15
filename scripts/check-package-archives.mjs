import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run through npm run check:archives");
const run = (args, cwd = root) =>
  execFileSync(process.execPath, args, { cwd, stdio: "inherit" });
const directory = mkdtempSync(join(tmpdir(), "bsm-package-consumer-"));
try {
  run([npm, "run", "build:packages"]);
  const packages = ["api-client", "runtime", "storage"];
  const archives = packages.map((name) => {
    const output = execFileSync(
      process.execPath,
      [
        npm,
        "pack",
        "--json",
        "--ignore-scripts",
        "--pack-destination",
        directory,
      ],
      {
        cwd: join(root, "packages", name),
        encoding: "utf8",
      },
    );
    return join(directory, JSON.parse(output)[0].filename);
  });
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  run(
    [
      npm,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      ...archives,
    ],
    directory,
  );
  const tests = [];
  const consumers = [];
  const exports = [];
  for (const name of packages) {
    const installed = join(
      directory,
      "node_modules",
      "@bedrock-server-manager",
      name,
    );
    const manifest = JSON.parse(
      readFileSync(join(installed, "package.json"), "utf8"),
    );
    for (const [subpath, entry] of Object.entries(manifest.exports)) {
      if (typeof entry === "object" && entry.default)
        exports.push(manifest.name + (subpath === "." ? "" : subpath.slice(1)));
    }
    const testDirectory = join(directory, name);
    cpSync(join(root, "packages", name, "test"), testDirectory, {
      recursive: true,
    });
    tests.push(
      ...readdirSync(testDirectory)
        .filter((file) => file.endsWith(".test.js"))
        .map((file) => join(testDirectory, file)),
    );
    consumers.push(join(testDirectory, "consumer.mts"));
  }
  writeFileSync(
    join(directory, "exports.mjs"),
    `
for (const name of ["window", "document", "navigator", "localStorage", "sessionStorage"]) {
  Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error("Browser dependency: " + name); } });
}
for (const specifier of ${JSON.stringify(exports)}) await import(specifier);
console.log("All executable package exports imported without browser globals.");
`,
  );
  run([join(directory, "exports.mjs")], directory);
  run(["--test", ...tests], directory);
  run(
    [
      join(root, "node_modules", "typescript", "bin", "tsc"),
      "--noEmit",
      "--strict",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      ...consumers,
    ],
    directory,
  );
  console.log(
    "Installed archives passed export, behavior, and consumer type checks outside the workspace.",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
