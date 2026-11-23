import { expect, it, vi } from "vitest";
import { authenticateIntegrationToken } from "../../../../src/features/instances/tokenAuthentication";

const account = {
  id: 1,
  username: "owner",
  credential_id: "token-id",
  permissions: ["account:read"],
  credential_name: "Dashboard",
  credential_expires_at: null,
};
it("validates only against the requested backend, without cookies or persistence", async () => {
  const fetch = vi.fn(async () => Response.json(account));
  const before = { ...localStorage };
  const result = await authenticateIntegrationToken(
    "https://backend.test/prefix",
    " bsm_it_example ",
    { fetch },
  );
  expect(result.account.credential_expires_at).toBeNull();
  expect(result.account.credential_name).toBe("Dashboard");
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe("https://backend.test/prefix/api/account");
  expect(options.credentials).toBe("omit");
  expect(new Headers(options.headers).get("Authorization")).toBe(
    "Bearer bsm_it_example",
  );
  expect({ ...localStorage }).toEqual(before);
});
it.each([401, 403])(
  "rejects refused tokens without echoing or saving the candidate (%s)",
  async (status) => {
    const fetch = vi.fn(async () =>
      Response.json({ detail: "refused" }, { status }),
    );
    await expect(
      authenticateIntegrationToken("https://backend.test", "bsm_it_secret", {
        fetch,
      }),
    ).rejects.toThrow(
      status === 403 ? /account:read/ : /invalid, expired, or revoked/,
    );
    expect(JSON.stringify({ ...localStorage })).not.toContain("bsm_it_secret");
  },
);
it("requires integration identity metadata rather than accepting a password session", async () => {
  await expect(
    authenticateIntegrationToken("https://backend.test", "bsm_it_example", {
      fetch: async () =>
        Response.json({ username: "owner", permissions: ["account:read"] }),
    }),
  ).rejects.toThrow(/supported integration token/);
});
it("rejects an aborted validation even if the fetcher returns a late response", async () => {
  const abort = new AbortController();
  const fetch = async () => {
    abort.abort();
    return Response.json(account);
  };
  await expect(
    authenticateIntegrationToken("https://backend.test", "bsm_it_example", {
      fetch,
      signal: abort.signal,
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
});
