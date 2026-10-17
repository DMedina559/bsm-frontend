import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isGeneratedApiCall } from "../api-call-sites.mjs";
test("API checking recognizes imported aliases and generated client methods", () => {
  const root = mkdtempSync(join(tmpdir(), "bsm-call-sites-"));
  try {
    const directory = join(root, "packages/api-client/dist");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "operations.d.ts"),
      'export declare function callOperation(id: "list_servers"): void; export declare function createApiClient(): { callOperation: typeof callOperation };',
    );
    const entry = join(root, "app.ts");
    writeFileSync(
      entry,
      'import { callOperation as invoke, createApiClient } from "./packages/api-client/dist/operations.js"; invoke("missing"); createApiClient().callOperation("missing"); Math.abs(-1);',
    );
    const program = ts.createProgram([entry], {
      noEmit: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    });
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(entry);
    const detected = [];
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        isGeneratedApiCall(node, checker, source)
      )
        detected.push(node.expression.getText(source));
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(detected.includes("invoke"));
    assert.ok(detected.includes("createApiClient().callOperation"));
    assert.ok(!detected.includes("Math.abs"));
    assert.equal(
      ts.getPreEmitDiagnostics(program).filter((error) => error.code === 2345)
        .length,
      2,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
