import test from "node:test";
import assert from "node:assert/strict";
import { resolveReleaseTag } from "../release-version.mjs";
test("SDK tags determine version and safe npm distribution channels", () => {
  assert.deepEqual(resolveReleaseTag("api-client", "api-client-v1.2.3"), {
    version: "1.2.3",
    distTag: "latest",
  });
  assert.deepEqual(
    resolveReleaseTag("api-client", "api-client-v1.3.0-beta.1"),
    { version: "1.3.0-beta.1", distTag: "next" },
  );
  assert.equal(
    resolveReleaseTag("api-client", "api-client-v1.2.3", true).distTag,
    "next",
  );
});
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
  for (const tag of [
    "frontend-1.3.0b7",
    "api-client-v01.2.3",
    "api-client-v1.2.3b4",
    "api-client-v1.2.3-beta.01",
    "api-client-v1.2.3-",
    "api-client-v1.2.3; echo bad",
  ])
    assert.throws(() => resolveReleaseTag("api-client", tag));
  for (const tag of [
    "1.3.0b7",
    "frontend-v1.3.0",
    "frontend-1.3.0b07",
    "api-client-v1.3.0",
  ])
    assert.throws(() => resolveReleaseTag("frontend", tag));
});
