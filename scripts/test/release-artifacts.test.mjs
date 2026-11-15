import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selectReleaseArchives } from "../release-artifacts.mjs";
import { resolveRelease } from "../release-version.mjs";

function fixture(t, patch = {}) {
  const directory = mkdtempSync(join(tmpdir(), "bsm-release-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const release = resolveRelease("1.4.0-beta.3");
  const artifacts = join(directory, "downloaded");
  const paths = release.packages.map((pkg) => {
    const contents = join(directory, pkg.product);
    const nested = join(artifacts, pkg.artifactName);
    mkdirSync(join(contents, "package"), { recursive: true });
    mkdirSync(nested, { recursive: true });
    writeFileSync(
      join(contents, "package", "package.json"),
      JSON.stringify({
        name: pkg.workspace,
        version: release.npmVersion,
        private: false,
        publishConfig: { access: "public" },
        ...(pkg.product === "runtime" ? patch : {}),
      }),
    );
    const archive = join(nested, `${pkg.product}.tgz`);
    execFileSync("tar", ["-czf", archive, "-C", contents, "package"]);
    return archive;
  });
  return { artifacts, release, paths };
}

test("selects all verified packages in publication order without changing bytes", (t) => {
  const { artifacts, release, paths } = fixture(t);
  const before = paths.map((path) => readFileSync(path));
  writeFileSync(join(artifacts, "python.tar.gz"), "not an npm archive");
  const selected = selectReleaseArchives(artifacts, release);
  assert.deepEqual(
    selected.map((pkg) => pkg.archive),
    paths,
  );
  selected.forEach((pkg, index) => {
    assert.match(pkg.integrity, /^sha512-/);
    assert.deepEqual(readFileSync(pkg.archive), before[index]);
  });
});

test("rejects missing or extra packages before publication", (t) => {
  const { artifacts, release, paths } = fixture(t);
  const extra = join(artifacts, "extra.tgz");
  writeFileSync(extra, "unexpected");
  assert.throws(
    () => selectReleaseArchives(artifacts, release),
    /exactly four/,
  );
  rmSync(extra);
  rmSync(paths[0]);
  assert.throws(
    () => selectReleaseArchives(artifacts, release),
    /exactly four/,
  );
});

for (const patch of [
  { name: "@bedrock-server-manager/storage" },
  { name: "other" },
  { version: "1.4.0" },
  { private: true },
  { publishConfig: { access: "restricted" } },
]) {
  test(`rejects duplicate or invalid package metadata: ${JSON.stringify(patch)}`, (t) => {
    const { artifacts, release } = fixture(t, patch);
    assert.throws(
      () => selectReleaseArchives(artifacts, release),
      /unique public release/,
    );
  });
}
