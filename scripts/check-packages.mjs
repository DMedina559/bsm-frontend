import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const ts = require("typescript");
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this check with npm run packages:check");
const available = ["api-client", "runtime", "storage"];
const { values, positionals } = parseArgs({
  options: {
    "pack-destination": { type: "string" },
    smoke: { type: "boolean", default: false },
  },
  allowPositionals: true,
});
const names = positionals.length ? positionals : available;
if (names.some((name) => !available.includes(name)))
  throw new Error("Unknown package");
const temporary = mkdtempSync(join(tmpdir(), "bsm-packages-"));
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
  const imports = [
    'import assert from "node:assert/strict";',
    `for (const name of ["window", "document", "navigator", "localStorage", "sessionStorage", "WebSocket"]) {
      Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error("Browser global accessed: " + name); } });
    }`,
  ];
  let exportCount = 0;
  for (const name of names) {
    const manifest = JSON.parse(
      readFileSync(
        join(
          temporary,
          "node_modules",
          "@bedrock-server-manager",
          name,
          "package.json",
        ),
        "utf8",
      ),
    );
    if (
      manifest.private !== false ||
      manifest.publishConfig?.access !== "public"
    )
      throw new Error(`Unexpected publishing boundary: ${manifest.name}`);
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      const implementation =
        typeof target === "string" ? target : target.default;
      if (!implementation || implementation.endsWith(".d.ts")) continue;
      const declaration = typeof target === "object" && target.types;
      if (!declaration)
        throw new Error(`Missing export types: ${manifest.name}${subpath}`);
      const declarationPath = join(
        temporary,
        "node_modules",
        manifest.name,
        declaration,
      );
      const program = ts.createProgram([declarationPath], {
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      });
      const checker = program.getTypeChecker();
      const module = checker.getSymbolAtLocation(
        program.getSourceFile(declarationPath),
      );
      const values = checker
        .getExportsOfModule(module)
        .filter((symbol) => {
          const resolved =
            symbol.flags & ts.SymbolFlags.Alias
              ? checker.getAliasedSymbol(symbol)
              : symbol;
          return resolved.flags & ts.SymbolFlags.Value;
        })
        .map((symbol) => symbol.name)
        .sort();
      imports.push(
        `assert.deepEqual(Object.keys(await import(${JSON.stringify(manifest.name + (subpath === "." ? "" : subpath.slice(1)))})).sort(), ${JSON.stringify(values)});`,
      );
      exportCount++;
    }
  }
  writeFileSync(join(temporary, "check.mjs"), imports.join("\n"));
  execFileSync(process.execPath, [join(temporary, "check.mjs")], {
    stdio: "inherit",
  });
  for (const name of values.smoke ? [] : names) {
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
    `Verified ${names.length} packed packages, ${exportCount} executable exports and declarations${values.smoke ? "" : ", and consumer types"}.`,
  );
  if (values["pack-destination"]) {
    const destination = resolve(root, values["pack-destination"]);
    mkdirSync(destination, { recursive: true });
    for (const archive of archives)
      cpSync(archive, join(destination, basename(archive)));
    console.log(`Saved verified npm archives to ${destination}`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
