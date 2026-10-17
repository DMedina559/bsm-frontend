import ts from "typescript";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
const root = fileURLToPath(new URL("../", import.meta.url));
const files = ["api-client", "runtime", "storage"].flatMap((name) =>
  readdirSync(`${root}/packages/${name}/src`)
    .filter((file) => file.endsWith(".js"))
    .map((file) => `${root}/packages/${name}/src/${file}`),
);
const program = ts.createProgram(files, {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  resolveJsonModule: true,
});
const errors = ts.getPreEmitDiagnostics(program);
if (errors.length) {
  process.stderr.write(
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (file) => file,
      getNewLine: () => "\n",
    }),
  );
  process.exitCode = 1;
} else
  console.log(
    `Checked ${files.length} shared JavaScript implementations against their typed boundaries.`,
  );
