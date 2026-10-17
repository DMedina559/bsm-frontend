import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selectReleaseArchive } from "../release-artifacts.mjs";
import { resolveRelease } from "../release-version.mjs";

function fixture(t, release, patch = {}) {
  const directory = mkdtempSync(join(tmpdir(), "bsm-release-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const contents = join(directory, "contents");
  const artifacts = join(directory, "downloaded");
  const nested = join(artifacts, "frontend", "build", "artifacts");
  mkdirSync(join(contents, "package"), { recursive: true });
  mkdirSync(nested, { recursive: true });
  writeFileSync(
    join(contents, "package", "package.json"),
    JSON.stringify({
      name: release.workspace,
      version: release.npmVersion,
      private: false,
      publishConfig: { access: "public" },
      ...patch,
    }),
  );
  const archive = join(nested, "verified.tgz");
  execFileSync("tar", ["-czf", archive, "-C", contents, "package"]);
  return { artifacts, archive, nested };
}

for (const tag of [
  "api-client-v1.2.3",
  "runtime-v1.2.3-beta.1",
  "storage-v2.0.0",
  "frontend-1.3.0b9",
]) {
  test(`${tag} selects the matching archive without changing its bytes`, (t) => {
    const release = resolveRelease(tag);
    const { artifacts, archive } = fixture(t, release);
    const hash = () =>
      createHash("sha256").update(readFileSync(archive)).digest("hex");
    const before = hash();
    writeFileSync(
      join(artifacts, "python-package.tar.gz"),
      "unrelated Python archive",
    );
    assert.equal(selectReleaseArchive(artifacts, release), archive);
    assert.equal(hash(), before);
  });
}

test("missing and multiple npm archives cannot be published", (t) => {
  const release = resolveRelease("runtime-v1.2.3");
  const { artifacts, archive } = fixture(t, release);
  writeFileSync(join(artifacts, "unexpected.tgz"), "another package");
  assert.throws(() => selectReleaseArchive(artifacts, release), /exactly one/);
  rmSync(join(artifacts, "unexpected.tgz"));
  rmSync(archive);
  assert.throws(() => selectReleaseArchive(artifacts, release), /exactly one/);
});

for (const patch of [
  { name: "@bedrock-server-manager/storage" },
  { version: "1.2.4" },
  { private: true },
  { publishConfig: { access: "restricted" } },
]) {
  test(`archive metadata mismatch is rejected: ${JSON.stringify(patch)}`, (t) => {
    const release = resolveRelease("runtime-v1.2.3");
    const { artifacts } = fixture(t, release, patch);
    assert.throws(
      () => selectReleaseArchive(artifacts, release),
      /must contain public/,
    );
  });
}
