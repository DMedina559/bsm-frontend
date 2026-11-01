import { createApiClient } from "@bedrock-server-manager/api-client";
import { createHttpTransport } from "@bedrock-server-manager/api-client/transport";
import { createUrlResolver } from "@bedrock-server-manager/api-client/urls";
import { validateBackendUrl } from "../../app/backendUrl";

/** Validate a candidate without cookies, ambient credentials, persistence, or logging. */
export async function authenticateIntegrationToken(
  backend,
  candidate,
  { signal, fetch: fetcher } = {},
) {
  const token = candidate.trim();
  if (!token.startsWith("bsm_it_"))
    throw new Error("Enter an integration token beginning with bsm_it_.");
  const transport = createHttpTransport({
    resolveApiUrl: createUrlResolver(validateBackendUrl(backend)),
    getToken: () => token,
    fetch: fetcher,
  });
  const client = createApiClient({
    request: (url, options) =>
      transport.request(url, {
        ...options,
        signal,
        credentials: "omit",
        headers: { "X-BSM-Auth-Mode": "bearer" },
      }),
  });
  let account;
  try {
    account = await client.callOperation("get_account", { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    if (error.status === 401)
      throw new Error("This token is invalid, expired, or revoked.");
    if (error.status === 403)
      throw new Error("This token needs account:read permission to sign in.");
    throw new Error(
      "Could not validate the token. Check the backend address and connection.",
    );
  }
  if (!account?.credential_id || !Array.isArray(account.permissions))
    throw new Error(
      "This backend did not identify a supported integration token.",
    );
  signal?.throwIfAborted();
  return { token, account };
}
