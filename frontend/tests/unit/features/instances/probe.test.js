import { expect, it, vi } from "vitest";
import { probeInstance } from "../../../../src/features/instances/probe";
it("tests BSM compatibility without credentials and identifies sign-in requirements", async () => {
  const fetch = vi.fn(async (url, options) => {
    expect(options.credentials).toBe("omit");
    expect(new Headers(options.headers).has("Authorization")).toBe(false);
    if (url.endsWith("/api/setup/status"))
      return Response.json({ needs_setup: false });
    return Response.json({ detail: "Sign in" }, { status: 401 });
  });
  expect(
    await probeInstance("https://bsm.test/prefix", { fetch }),
  ).toMatchObject({
    url: "https://bsm.test/prefix",
    authenticationRequired: true,
  });
  expect(fetch.mock.calls[0][0]).toBe(
    "https://bsm.test/prefix/api/setup/status",
  );
});
it("rejects incompatible servers and reports certificate/CORS troubleshooting honestly", async () => {
  await expect(
    probeInstance("https://wrong.test", {
      fetch: async () => Response.json({ hello: "world" }),
    }),
  ).rejects.toThrow(/compatible BSM/);
  await expect(
    probeInstance("https://unreachable.test", {
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    }),
  ).rejects.toThrow(/cannot reliably distinguish/);
});

it("recognizes an instance needing setup without probing protected routes", async () => {
  const fetch = vi.fn(async () => Response.json({ needs_setup: true }));
  expect(await probeInstance("https://new.test", { fetch })).toMatchObject({
    needsSetup: true,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
