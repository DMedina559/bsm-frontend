import test from "node:test";
import assert from "node:assert/strict";
import { publishNpmRelease } from "../publish-npm.mjs";
const archives = ["api-client", "runtime", "storage", "frontend"].map(
  (name) => ({
    workspace: `@bedrock-server-manager/${name}`,
    npmVersion: "1.4.0-beta.1",
    archive: `/verified/${name}.tgz`,
    integrity: `sha512-${name}`,
  }),
);

test("preflights all package versions before publishing in dependency order", () => {
  const calls = [];
  publishNpmRelease(archives, "next", (args) => {
    calls.push(args);
    return null;
  });
  assert.deepEqual(
    calls.slice(0, 4).map((args) => args[0]),
    ["view", "view", "view", "view"],
  );
  assert.deepEqual(
    calls.slice(4).map((args) => args[1]),
    archives.map((pkg) => pkg.archive),
  );
  for (const args of calls.slice(4)) {
    assert.ok(args.includes("--ignore-scripts"));
    assert.ok(args.includes("--provenance"));
    assert.equal(args.at(-1), "next");
  }
});

test("a partial publication retries missing packages and verifies existing bytes", () => {
  const published = [];
  const tags = [];
  publishNpmRelease(archives, "next", (args) => {
    if (args[0] === "view" && args[2] === "dist")
      return args[1].includes("api-client")
        ? { integrity: archives[0].integrity }
        : null;
    if (args[0] === "view") return { next: "1.3.0-beta.1" };
    if (args[0] === "publish") published.push(args[1]);
    if (args[0] === "dist-tag") tags.push(args);
  });
  assert.deepEqual(
    published,
    archives.slice(1).map((pkg) => pkg.archive),
  );
  assert.equal(tags.length, 1);
  assert.equal(tags[0][2], "@bedrock-server-manager/api-client@1.4.0-beta.1");
});

test("an already complete release is a no-op", () => {
  const writes = [];
  publishNpmRelease(archives, "latest", (args) => {
    if (args[0] !== "view") writes.push(args);
    if (args[2] === "dist-tags") return { latest: "1.4.0-beta.1" };
    return {
      integrity: archives.find((pkg) => args[1].startsWith(`${pkg.workspace}@`))
        .integrity,
    };
  });
  assert.deepEqual(writes, []);
});

test("mismatched published bytes abort the whole preflight without writes", () => {
  const writes = [];
  assert.throws(
    () =>
      publishNpmRelease(archives, "next", (args) => {
        if (args[0] !== "view") writes.push(args);
        return args[1].includes("storage") ? { integrity: "different" } : null;
      }),
    /Published bytes differ/,
  );
  assert.deepEqual(writes, []);
});

test("registry failures propagate without publishing", () => {
  assert.throws(
    () =>
      publishNpmRelease(archives, "next", () => {
        throw new Error("Registry unavailable");
      }),
    /Registry unavailable/,
  );
});
