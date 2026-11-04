import * as generated from "./build/generated/index.js";
import { ApiError } from "../../packages/api-client/src/transport.js";

/** Prototype only: per-instance generated SDK with BSM bearer/error adapters. */
export function createPrototypeClient({
  baseUrl,
  getToken = () => null,
  fetch: fetchApi = globalThis.fetch,
}) {
  const basePath = baseUrl.replace(/\/+$/, "");
  const configuration = new generated.Configuration({
    basePath,
    fetchApi,
    credentials: "omit",
    // A single adapter avoids the generator's differing OAuth2 and HTTP bearer
    // callback conventions. No generated files or templates are patched.
    middleware: [
      {
        async pre({ url, init }) {
          init.signal?.throwIfAborted();
          const headers = new Headers(init.headers);
          const login =
            new URL(url).pathname ===
            new URL(`${basePath}/auth/token`).pathname;
          if (login) {
            headers.delete("Authorization");
            headers.set("X-BSM-Auth-Mode", "bearer");
          } else {
            const token = await getToken();
            if (token) headers.set("Authorization", `Bearer ${token}`);
          }
          init.signal?.throwIfAborted();
          return { url, init: { ...init, headers } };
        },
        async post({ response }) {
          if (response.ok) return response;
          let data;
          try {
            data = await response.json();
          } catch {
            data = null;
          }
          throw new ApiError(
            data?.error?.message ?? data?.message ?? `HTTP ${response.status}`,
            response.status,
            data,
          );
        },
        async onError({ error, init }) {
          if (init.signal?.aborted) throw init.signal.reason;
          throw new ApiError(error?.message ?? "Connection failed", 0, null);
        },
      },
    ],
  });
  return Object.fromEntries(
    Object.entries(generated)
      .filter(([name]) => name.endsWith("Api"))
      .map(([name, Api]) => [name, new Api(configuration)]),
  );
}
