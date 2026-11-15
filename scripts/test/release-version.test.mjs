import test from "node:test";
import assert from "node:assert/strict";
import { resolveRelease } from "../release-version.mjs";

for (const [tag, npmVersion, pythonVersion, distTag] of [
  ["v1.4.0", "1.4.0", "1.4.0", "latest"],
  ["v1.4.0-alpha.0", "1.4.0-alpha.0", "1.4.0a0", "next"],
  ["v1.4.0-beta.3", "1.4.0-beta.3", "1.4.0b3", "next"],
  ["v1.4.0-rc.1", "1.4.0-rc.1", "1.4.0rc1", "next"],
]) {
  test(`${tag} releases every package with one coordinated version`, () => {
    const release = resolveRelease(tag);
    assert.equal(release.npmVersion, npmVersion);
    assert.equal(release.pythonVersion, pythonVersion);
    assert.equal(release.distTag, distTag);
    assert.deepEqual(
      release.packages.map((pkg) => pkg.product),
      ["api-client", "runtime", "storage", "frontend"],
    );
    for (const pkg of release.packages) {
      assert.equal(pkg.workspace, `@bedrock-server-manager/${pkg.product}`);
      assert.equal(pkg.npmVersion, npmVersion);
      assert.equal(
        pkg.artifactName,
        pkg.product === "frontend"
          ? "frontend-distributions"
          : "shared-packages",
      );
    }
  });
}

test("GitHub prerelease flag keeps stable-looking versions off latest", () => {
  assert.equal(resolveRelease("v1.4.0", true).distTag, "next");
});

test("old individual tags, ambiguous versions, and unmappable Python prereleases are rejected", () => {
  for (const tag of [
    "api-client-v1.4.0",
    "runtime-v1.4.0",
    "storage-v1.4.0",
    "frontend-1.4.0",
    "frontend-1.4.0b1",
    "1.4.0",
    "v01.4.0",
    "v1.04.0",
    "v1.4.00",
    "v1.4.0b1",
    "v1.4.0-beta.01",
    "v1.4.0-beta",
    "v1.4.0-preview.1",
    "v1.4.0+build.1",
    "v1.4.0; echo bad",
    undefined,
  ])
    assert.throws(() => resolveRelease(tag));
});
