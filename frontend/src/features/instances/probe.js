import { createApiClient } from "@bedrock-server-manager/api-client";
import { createHttpTransport } from "@bedrock-server-manager/api-client/transport";
import { createUrlResolver } from "@bedrock-server-manager/api-client/urls";
import { validateBackendUrl } from "../../app/backendUrl";

export function connectionFailure(error, url) {
  if (error.name === "TimeoutError")
    return `Connection to ${url} timed out. Check the address and whether the backend is running.`;
  if (
    error.status === 0 ||
    error instanceof TypeError ||
    /fetch|network/i.test(error.message)
  )
    return `Cannot reach ${url} from ${window.location.origin}. Open the backend to check its certificate, check connectivity, and allow ${window.location.origin} in web.cors_origins, then restart its web server. The browser cannot reliably distinguish certificate, CORS, and network failures.`;
  return error.message;
}
/** Read-only and credential-free: never send saved tokens to a candidate URL. */
export async function probeInstance(url, { fetch, signal } = {}) {
  url = validateBackendUrl(url.trim());
  const controller = new AbortController();
  const transport = createHttpTransport({
    resolveApiUrl: createUrlResolver(url),
    fetch,
    captureSession: () => ({ signal: controller.signal }),
  });
  const client = createApiClient({
    request: (path, options) =>
      transport.request(path, {
        ...options,
        signal,
        timeout: 8000,
        credentials: "omit",
        redirect: "error",
      }),
  });
  try {
    const setup = await client.callOperation("get_setup_status");
    if (typeof setup?.needs_setup !== "boolean")
      throw new Error(
        "This address did not return a compatible BSM setup response.",
      );
    if (setup.needs_setup)
      return {
        url,
        version: null,
        needsSetup: true,
        authenticationRequired: false,
      };
    try {
      const result = await client.callOperation("get_system_info");
      const version = (result.info ?? result)?.app_version;
      if (typeof version !== "string" || !version)
        throw new Error(
          "The backend responded, but its BSM version response is incompatible.",
        );
      return {
        url,
        version,
        needsSetup: setup.needs_setup,
        authenticationRequired: false,
      };
    } catch (error) {
      if ([401, 403].includes(error.status))
        return {
          url,
          version: null,
          needsSetup: setup.needs_setup,
          authenticationRequired: true,
        };
      throw error;
    }
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(connectionFailure(error, url));
  }
}
