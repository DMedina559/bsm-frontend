import ts from "typescript";
import path from "node:path";

// Validate generated-client call signatures in the JS/JSX application.
const roots = ts.sys.readDirectory(
  "src",
  [".js", ".jsx"],
  ["**/*.test.*", "**/test/**"],
);
const application = new Set(roots.map((file) => path.resolve(file)));
const program = ts.createProgram(roots, {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  strict: true,
  noImplicitAny: false,
  skipLibCheck: true,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
});
const spans = new Map();
let calls = 0;
for (const source of program.getSourceFiles()) {
  if (!application.has(path.resolve(source.fileName))) continue;
  const ranges = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ["callOperation", "resolveOperationUrl", "writeOperation"].includes(
        node.expression.getText(source),
      )
    ) {
      ranges.push([node.getStart(source), node.end]);
      calls++;
    }
    // Include typed mutation-wrapper assignments so an incompatible wrapper
    // cannot silently discard the generated client's generic signature.
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "writeOperation"
    )
      ranges.push([node.getFullStart(), node.end]);
    ts.forEachChild(node, visit);
  };
  visit(source);
  spans.set(source.fileName, ranges);
}
const errors = ts
  .getPreEmitDiagnostics(program)
  .filter(
    (diagnostic) =>
      diagnostic.file &&
      spans
        .get(diagnostic.file.fileName)
        ?.some(
          ([start, end]) => diagnostic.start >= start && diagnostic.start < end,
        ),
  );
if (errors.length) {
  process.stderr.write(
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getCanonicalFileName: (file) => file,
      getNewLine: () => "\n",
    }),
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Generated API contract: ${calls} application calls checked.\n`,
  );
}
