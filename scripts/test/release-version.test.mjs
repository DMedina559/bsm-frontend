import test from "node:test";
import assert from "node:assert/strict";
import { resolveRelease, resolveReleaseTag } from "../release-version.mjs";
const libraries = ["api-client", "runtime", "storage"];
for (const product of libraries) {
  test(`${product} tags determine version and safe npm distribution channels`, () => {
    assert.deepEqual(resolveReleaseTag(product, `${product}-v1.2.3`), {
      version: "1.2.3",
      distTag: "latest",
    });
    assert.deepEqual(resolveReleaseTag(product, `${product}-v1.3.0-beta.1`), {
      version: "1.3.0-beta.1",
      distTag: "next",
    });
    assert.equal(
      resolveReleaseTag(product, `${product}-v1.2.3`, true).distTag,
      "next",
    );
  });
}
test("frontend tags share one Python and npm release with ecosystem-appropriate spelling", () => {
  assert.deepEqual(resolveReleaseTag("frontend", "frontend-1.3.0b7"), {
    version: "1.3.0b7",
    npmVersion: "1.3.0-beta.7",
    distTag: "next",
  });
  assert.equal(
    resolveReleaseTag("frontend", "frontend-2.0.0rc1").npmVersion,
    "2.0.0-rc.1",
  );
  assert.equal(
    resolveReleaseTag("frontend", "frontend-2.0.0").distTag,
    "latest",
  );
});
test("invalid, ambiguous and cross-product tags are rejected", () => {
  for (const product of libraries) {
    for (const tag of [
      "frontend-1.3.0b7",
      `${product}-v01.2.3`,
      `${product}-v1.2.3b4`,
      `${product}-v1.2.3-beta.01`,
      `${product}-v1.2.3-`,
      `${product}-v1.2.3; echo bad`,
      ...libraries
        .filter((other) => other !== product)
        .map((other) => `${other}-v1.2.3`),
    ])
      assert.throws(() => resolveReleaseTag(product, tag));
  }
  for (const tag of [
    "1.3.0b7",
    "frontend-v1.3.0",
    "frontend-1.3.0b07",
    ...libraries.map((product) => `${product}-v1.3.0`),
  ])
    assert.throws(() => resolveReleaseTag("frontend", tag));
});
test("unknown products cannot select a library publication", () => {
  assert.throws(
    () => resolveReleaseTag("unknown", "runtime-v1.2.3"),
    /Unknown release product/,
  );
});

test("release routing selects one package and its verified artifact", () => {
  for (const product of libraries) {
    assert.deepEqual(resolveRelease(`${product}-v1.2.3`), {
      product,
      workspace: `@bedrock-server-manager/${product}`,
      version: "1.2.3",
      npmVersion: "1.2.3",
      distTag: "latest",
      artifactName: "npm-package",
    });
    assert.equal(resolveRelease(`${product}-v1.2.3`, true).distTag, "next");
    assert.equal(resolveRelease(`${product}-v1.3.0-beta.1`).distTag, "next");
  }
  assert.deepEqual(resolveRelease("frontend-1.3.0b9"), {
    product: "frontend",
    workspace: "@bedrock-server-manager/frontend",
    version: "1.3.0b9",
    npmVersion: "1.3.0-beta.9",
    distTag: "next",
    artifactName: "frontend-distributions",
  });
  assert.equal(resolveRelease("frontend-1.3.0").distTag, "latest");
  assert.equal(resolveRelease("frontend-1.3.0", true).distTag, "next");
});

test("release routing rejects unsupported and malformed tags", () => {
  for (const tag of [
    "v1.2.3",
    "1.2.3",
    "unknown-v1.2.3",
    "runtime-1.2.3",
    "storage-v01.2.3",
    "api-client-v1.2.3-beta.01",
    "frontend-v1.3.0",
    "frontend-1.3.0b09",
  ])
    assert.throws(() => resolveRelease(tag));
});
