import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repository = "DMedina559/bedrock-server-manager";
const ref = "a".repeat(40);
const script = readFileSync(new URL("../backend-source.mjs", import.meta.url));

function fixture(t, source = { repository, ref }) {
  const directory = mkdtempSync(join(tmpdir(), "bsm-backend-source-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "scripts"));
  mkdirSync(join(directory, "packages", "api-client"), { recursive: true });
  const entry = join(directory, "scripts", "backend-source.mjs");
  const output = join(directory, "outputs");
  writeFileSync(entry, script);
  writeFileSync(
    join(directory, "packages", "api-client", "backend-source.json"),
    JSON.stringify(source),
  );
  return {
    output,
    run(env = {}) {
      return spawnSync(process.execPath, [entry], {
        encoding: "utf8",
        env: { ...process.env, GITHUB_OUTPUT: output, ...env },
      });
    },
  };
}

test("backend resolution appends only the committed immutable revision", (t) => {
  const { output, run } = fixture(t);
  writeFileSync(output, "existing=value\n");
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(
    readFileSync(output, "utf8"),
    `existing=value\nrevision=${ref}\n`,
  );
});

test("runtime ref overrides cannot change the supported backend pin", (t) => {
  const { output, run } = fixture(t);
  for (const override of ["dev", "refs/pull/191/head", "b".repeat(40)]) {
    const result = run({ BSM_BACKEND_REF: override });
    assert.equal(result.status, 0, result.stderr);
  }
  assert.equal(readFileSync(output, "utf8"), `revision=${ref}\n`.repeat(3));
});

for (const source of [
  { repository: "untrusted/bedrock-server-manager", ref },
  { repository: "DMedina559/another-repository", ref },
  { repository, ref: "dev" },
  { repository, ref: "refs/pull/191/head" },
  { repository, ref: "a".repeat(39) },
  { repository, ref: `${ref}\nrevision=another-target` },
]) {
  test(`rejects unsupported backend source ${JSON.stringify(source)}`, (t) => {
    const { output, run } = fixture(t, source);
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /supported backend must identify/);
    assert.equal(existsSync(output), false);
  });
}
